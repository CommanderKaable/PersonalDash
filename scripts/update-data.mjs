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
  if (feed.type === "gnews") return googleNews(feed.query, feed.name, 10);
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
      .slice(0, 25);
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

// Whole-league standings: one row per team.
async function fetchNHLStandings() {
  const st = await getJSON("https://api-web.nhle.com/v1/standings/now");
  return st.standings.map((r) => ({
    team: r.teamAbbrev?.default,
    name: r.teamCommonName?.default || r.teamName?.default || r.teamAbbrev?.default,
    conference: r.conferenceName,
    division: r.divisionName,
    divisionRank: r.divisionSequence,
    leagueRank: r.leagueSequence,
    gp: r.gamesPlayed,
    w: r.wins,
    l: r.losses,
    otl: r.otLosses,
    pts: r.points,
    gd: r.goalDifferential,
    streak: r.streakCode ? `${r.streakCode}${r.streakCount}` : null,
  }));
}

// Today's (or the latest) games across the league.
async function fetchNHLScores() {
  const data = await getJSON("https://api-web.nhle.com/v1/score/now");
  return {
    date: data.currentDate || null,
    games: (data.games || []).map((g) => ({
      start: g.startTimeUTC,
      state: g.gameState,
      home: g.homeTeam?.abbrev,
      away: g.awayTeam?.abbrev,
      homeScore: g.homeTeam?.score ?? null,
      awayScore: g.awayTeam?.score ?? null,
      period: g.periodDescriptor?.number ?? null,
      lastPeriod: g.gameOutcome?.lastPeriodType || null,
    })),
  };
}

async function fetchNHL({ team, name }) {
  const sched = await getJSON(`https://api-web.nhle.com/v1/club-schedule-season/${team}/now`);
  const games = sched.games.map((g) => nhlGame(g, team));
  const [standings, scores] = await Promise.allSettled([fetchNHLStandings(), fetchNHLScores()]);
  const table = standings.status === "fulfilled" ? standings.value : [];
  const row = table.find((r) => r.team === team);
  return {
    team,
    name,
    live: games.find((g) => g.state === "LIVE" || g.state === "CRIT") || null,
    last: games.filter((g) => g.state === "FINAL" || g.state === "OFF").slice(-3).reverse(),
    next: games.filter((g) => g.state === "FUT" || g.state === "PRE").slice(0, 2),
    standing: row
      ? { division: row.division, divisionRank: row.divisionRank, points: row.pts, gp: row.gp, record: `${row.w}-${row.l}-${row.otl}` }
      : null,
    standings: table,
    scores: scores.status === "fulfilled" ? scores.value : null,
  };
}

// ----- SHL -----
// SHL has no open API. The table is read from the season's Wikipedia article (updated by volunteers,
// usually within a day). If that fails, the page simply shows news and a link to shl.se.

function stripTags(html) {
  return decodeEntities(html.replace(/<sup[\s\S]*?<\/sup>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function currentSeason(date = new Date()) {
  const y = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1; // season starts in autumn
  return `${y}–${String((y + 1) % 100).padStart(2, "0")}`;
}

function parseStandingsTable(html) {
  const tables = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/gi) || [];
  for (const t of tables) {
    const rows = t.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 5) continue;
    const head = (rows[0].match(/<th[\s\S]*?<\/th>/gi) || []).map(stripTags);
    const col = (...names) => head.findIndex((h) => names.includes(h.replace(/\s/g, "")));
    const iTeam = col("Team", "Lag");
    const iPts = col("Pts", "P", "Poäng");
    const iGp = col("GP", "Pld", "M", "GP[a]");
    if (iTeam < 0 || iPts < 0 || iGp < 0) continue;
    const iGd = col("GD", "+/-", "±", "Diff");
    const out = [];
    for (const r of rows.slice(1)) {
      const cells = (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) || []).map(stripTags);
      if (cells.length < head.length - 1) continue;
      // Some tables put the position in a <th> that the header row doesn't count; align from the right.
      const shift = cells.length - head.length;
      const at = (i) => cells[i + shift];
      const team = (at(iTeam) || "").replace(/\s*\([A-Z, ]+\)\s*$/, "").trim();
      const pts = parseInt(at(iPts), 10);
      if (!team || Number.isNaN(pts)) continue;
      out.push({
        rank: out.length + 1,
        team,
        gp: parseInt(at(iGp), 10) || 0,
        gd: iGd >= 0 ? (at(iGd) || "").replace("−", "-") : null,
        pts,
      });
    }
    if (out.length >= 10) return out;
  }
  return null;
}

async function fetchSHLTable() {
  const page = encodeURIComponent(`${currentSeason()} SHL season`);
  const data = await getJSON(`https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=text&format=json&formatversion=2&redirects=1`);
  if (data.error) throw new Error(data.error.info);
  const table = parseStandingsTable(data.parse.text);
  if (!table) throw new Error("hittade ingen tabell på Wikipedia");
  return { table, source: `https://en.wikipedia.org/wiki/${page}` };
}

async function googleNews(query, label = "Google Nyheter", n = 8) {
  const q = encodeURIComponent(query);
  const xml = await getText(`https://news.google.com/rss/search?q=${q}&hl=sv&gl=SE&ceid=SE:sv`);
  return parseFeed(xml, label).slice(0, n);
}

async function fetchSHL({ name, newsQuery, link }) {
  const [tbl, news] = await Promise.allSettled([fetchSHLTable(), googleNews(newsQuery, "Google Nyheter", 6)]);
  return {
    name,
    link,
    table: tbl.status === "fulfilled" ? tbl.value.table : null,
    tableSource: tbl.status === "fulfilled" ? tbl.value.source : null,
    tableError: tbl.status === "rejected" ? tbl.reason.message : null,
    news: news.status === "fulfilled" ? news.value : [],
  };
}

async function updateHockey() {
  const errors = [];
  const [nhl, shl] = await Promise.allSettled([fetchNHL(config.hockey.nhl), fetchSHL(config.hockey.shl)]);
  if (nhl.status === "rejected") errors.push(`NHL: ${nhl.reason.message}`);
  if (shl.status === "rejected") errors.push(`SHL: ${shl.reason.message}`);
  if (shl.status === "fulfilled" && shl.value.tableError) errors.push(`SHL-tabell: ${shl.value.tableError}`);
  await save("hockey", {
    nhl: nhl.status === "fulfilled" ? nhl.value : null,
    shl: shl.status === "fulfilled" ? shl.value : { name: config.hockey.shl.name, link: config.hockey.shl.link, news: [], table: null },
    errors,
  });
}

// ---------- run ----------

await Promise.all([updateFeeds(), updateMarket(), updateHockey()]);
