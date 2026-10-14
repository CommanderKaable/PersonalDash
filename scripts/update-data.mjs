// Fetches external data (markets, hockey, news feeds) and writes it to data/live/*.json.
// Runs in GitHub Actions on a schedule, but can also be run locally: node scripts/update-data.mjs
// No dependencies: uses Node 20+'s built-in fetch.

import { readFile, writeFile, mkdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT_DIR = new URL("data/live/", ROOT);
const UA = "Mozilla/5.0 (startsida dashboard; +https://github.com)";

const config = JSON.parse(await readFile(new URL("data/config.json", ROOT), "utf8"));

// ---------- helpers ----------

async function getText(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function getJSON(url) {
  return JSON.parse(await getText(url));
}

async function save(name, data) {
  await mkdir(OUT_DIR, { recursive: true });
  const body = { updated: new Date().toISOString(), ...data };
  await writeFile(new URL(`${name}.json`, OUT_DIR), JSON.stringify(body, null, 2));
  console.log(`wrote data/live/${name}.json`);
}

function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

// Minimal RSS 2.0 + Atom parser — enough for headlines.
function parseFeed(xml, source) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let link = tag(b, "link");
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? alt[1] : "";
    }
    const dateStr = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const date = dateStr ? new Date(dateStr) : null;
    return {
      title: tag(b, "title"),
      link,
      source,
      date: date && !isNaN(date) ? date.toISOString() : null,
    };
  }).filter((i) => i.title && i.link);
}

// ---------- feeds ----------

async function fetchFeed(feed) {
  if (feed.type === "hn") {
    const data = await getJSON("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12");
    return data.hits.map((h) => ({
      title: h.title,
      link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      comments: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points,
      source: feed.name,
      date: h.created_at,
    }));
  }
  return parseFeed(await getText(feed.url), feed.name).slice(0, 10);
}

async function updateFeeds() {
  const categories = {};
  const errors = [];
  const results = await Promise.allSettled(config.feeds.map(fetchFeed));
  results.forEach((r, i) => {
    const feed = config.feeds[i];
    categories[feed.category] ??= [];
    if (r.status === "fulfilled") categories[feed.category].push(...r.value);
    else errors.push(`${feed.name}: ${r.reason.message}`);
  });
  for (const key of Object.keys(categories)) {
    categories[key] = categories[key]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 15);
  }
  await save("feeds", { categories, errors });
}

// ---------- market ----------

async function fetchYahoo(item) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?range=5d&interval=1d`;
  const data = await getJSON(url);
  const meta = data.chart.result[0].meta;
  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  // Yahoo's 5d "chartPreviousClose" is 5 days back; use the second-to-last daily close instead when present.
  const closes = data.chart.result[0].indicators?.quote?.[0]?.close?.filter((c) => c != null) || [];
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : prev;
  return {
    name: item.name,
    group: item.group,
    price,
    change: prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    currency: meta.currency,
  };
}

async function fetchCrypto(list) {
  const ids = list.map((c) => c.id).join(",");
  const data = await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=sek&include_24hr_change=true`);
  return list.map((c) => ({
    name: c.name,
    group: "Krypto",
    price: data[c.id]?.sek ?? null,
    change: data[c.id]?.sek_24h_change ?? null,
    currency: "SEK",
  }));
}

async function updateMarket() {
  const errors = [];
  const rows = [];
  const yahoo = await Promise.allSettled(config.market.yahoo.map(fetchYahoo));
  yahoo.forEach((r, i) => {
    if (r.status === "fulfilled") rows.push(r.value);
    else errors.push(`${config.market.yahoo[i].name}: ${r.reason.message}`);
  });
  try {
    rows.push(...(await fetchCrypto(config.market.crypto)));
  } catch (e) {
    errors.push(`Krypto: ${e.message}`);
  }
  await save("market", { rows, errors });
}

// ---------- hockey ----------

function nhlGame(g, team) {
  const home = g.homeTeam.abbrev === team;
  const us = home ? g.homeTeam : g.awayTeam;
  const them = home ? g.awayTeam : g.homeTeam;
  return {
    start: g.startTimeUTC,
    state: g.gameState, // FUT, PRE, LIVE, CRIT, FINAL, OFF
    home,
    opponent: them.abbrev,
    opponentName: them.placeName?.default || them.abbrev,
    us: us.score ?? null,
    them: them.score ?? null,
    lastPeriod: g.gameOutcome?.lastPeriodType || null, // REG, OT, SO
  };
}

async function fetchNHL({ team, name }) {
  const sched = await getJSON(`https://api-web.nhle.com/v1/club-schedule-season/${team}/now`);
  const games = sched.games.map((g) => nhlGame(g, team));
  const live = games.find((g) => g.state === "LIVE" || g.state === "CRIT") || null;
  const finished = games.filter((g) => g.state === "FINAL" || g.state === "OFF");
  const upcoming = games.filter((g) => g.state === "FUT" || g.state === "PRE");
  let standing = null;
  try {
    const st = await getJSON("https://api-web.nhle.com/v1/standings/now");
    const row = st.standings.find((s) => s.teamAbbrev?.default === team);
    if (row) {
      standing = {
        division: row.divisionName,
        divisionRank: row.divisionSequence,
        points: row.points,
        gp: row.gamesPlayed,
        record: `${row.wins}-${row.losses}-${row.otLosses}`,
      };
    }
  } catch { /* standings are optional */ }
  return {
    team,
    name,
    live,
    last: finished.slice(-3).reverse(),
    next: upcoming.slice(0, 2),
    standing,
  };
}

async function fetchSHLNews({ name, newsQuery, link }) {
  const q = encodeURIComponent(newsQuery);
  const xml = await getText(`https://news.google.com/rss/search?q=${q}&hl=sv&gl=SE&ceid=SE:sv`);
  return { name, link, news: parseFeed(xml, "Google Nyheter").slice(0, 5) };
}

async function updateHockey() {
  const errors = [];
  const [nhl, shl] = await Promise.allSettled([fetchNHL(config.hockey.nhl), fetchSHLNews(config.hockey.shl)]);
  if (nhl.status === "rejected") errors.push(`NHL: ${nhl.reason.message}`);
  if (shl.status === "rejected") errors.push(`SHL: ${shl.reason.message}`);
  await save("hockey", {
    nhl: nhl.status === "fulfilled" ? nhl.value : null,
    shl: shl.status === "fulfilled" ? shl.value : { name: config.hockey.shl.name, link: config.hockey.shl.link, news: [] },
    errors,
  });
}

// ---------- run ----------

await Promise.all([updateFeeds(), updateMarket(), updateHockey()]);
