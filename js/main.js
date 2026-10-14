// Entry point: draw the page from cached data at once, then fetch fresh data straight away
// (on every load and reload), on button press, and every 10 minutes.

import { loadJSON } from "./lib/data.js";
import { autoScroll } from "./lib/autoscroll.js";
import { initMasthead } from "./modules/masthead.js";
import { initTheme } from "./modules/theme.js";
import { initWeather } from "./modules/weather.js";
import { initSchedule } from "./modules/schedule.js";
import { renderWeekplan } from "./modules/weekplan.js";
import { renderMarket } from "./modules/market.js";
import { createNews } from "./modules/news.js";
import { renderTicker } from "./modules/ticker.js";
import { initNotes } from "./modules/notes.js";
import { liveHackerNews, liveCrypto, liveNHL } from "./modules/live.js";

const $ = (id) => document.getElementById(id);
const AUTO_REFRESH_MIN = 10;

initMasthead({ editionEl: $("edition"), weekEl: $("week"), clockEl: $("clock") });
initTheme($("theme-toggle"), $("theme-label"));
initNotes($("notes"), $("notes-status"));

// Hand-edited data (in the repo) and the latest cache written by GitHub Actions.
const [config, timetable, yearplan, hockey, market, feeds] = await Promise.all([
  loadJSON("data/config.json"),
  loadJSON("data/timetable.json"),
  loadJSON("data/yearplan.json"),
  loadJSON("data/live/hockey.json"),
  loadJSON("data/live/market.json"),
  loadJSON("data/live/feeds.json"),
]);

const state = { hockey, market, feeds };
const news = createNews({
  tabsEl: $("news-tabs"),
  bodyEl: $("news"),
  stampEl: $("news-stamp"),
  tabs: config?.newsTabs || ["Världen", "Tech", "Sport"],
});
const marketScroll = autoScroll($("market-scroll"), { speed: 12 });

const draw = {
  news: () => news.update({ feeds: state.feeds, hockey: state.hockey }),
  market: () => { renderMarket($("market"), $("market-stamp"), state.market); marketScroll.reset(); },
  ticker: () => renderTicker($("ticker"), $("ticker-track"), state),
};

initSchedule({ timetable, yearplan, nowEl: $("now"), agendaEl: $("agenda") });
renderWeekplan($("weekplan"), yearplan);
Object.values(draw).forEach((fn) => fn());
initWeather($("weather"), config?.locations || []);

// ---------- Refreshing ----------
// Each refresher re-reads the cache from the latest Action run, then tops it up with
// whatever the browser is allowed to fetch live. Returns true if anything arrived.

async function topUpHackerNews(base) {
  const hn = config?.feeds?.find((f) => f.type === "hn");
  if (!hn) return false;
  try {
    const fresh = await liveHackerNews(hn.name);
    const others = (base.categories[hn.category] || []).filter((i) => i.source !== hn.name);
    base.categories[hn.category] = others.concat(fresh)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 25);
    return true;
  } catch (err) {
    console.warn("Hacker News live:", err);
    return false;
  }
}

async function topUpNHL(base) {
  if (!config?.hockey?.nhl) return false;
  try {
    const fresh = await liveNHL(config.hockey.nhl);
    base.nhl = { ...base.nhl, ...fresh }; // keep the cached standings
    return true;
  } catch (err) {
    console.info("NHL live ej tillgängligt i webbläsaren – använder cache.", err.message);
    return false;
  }
}

const refreshers = {
  async news() {
    const [cachedFeeds, cachedHockey] = await Promise.all([
      loadJSON("data/live/feeds.json"),
      loadJSON("data/live/hockey.json"),
    ]);
    const feedsBase = cachedFeeds || state.feeds || { categories: {} };
    const hockeyBase = cachedHockey || state.hockey || {};
    const [hnOk, nhlOk] = await Promise.all([topUpHackerNews(feedsBase), topUpNHL(hockeyBase)]);
    state.feeds = feedsBase;
    state.hockey = hockeyBase;
    return Boolean(cachedFeeds || cachedHockey) || hnOk || nhlOk;
  },

  async market() {
    const cached = await loadJSON("data/live/market.json");
    const base = cached || state.market || { rows: [] };
    let liveOk = false;
    try {
      const crypto = await liveCrypto(config?.market?.crypto || []);
      base.rows = base.rows.filter((r) => r.group !== "Krypto").concat(crypto);
      base.liveCrypto = true;
      liveOk = true;
    } catch (err) {
      console.warn("Krypto live:", err);
    }
    state.market = base;
    return Boolean(cached) || liveOk;
  },
};

async function refresh(name) {
  const button = document.querySelector(`[data-refresh="${name}"]`);
  button?.classList.remove("is-done", "is-failed");
  button?.classList.add("is-loading");
  const ok = await refreshers[name]();
  draw[name]();
  draw.ticker();
  if (!button) return;
  button.classList.remove("is-loading");
  button.classList.add(ok ? "is-done" : "is-failed");
  setTimeout(() => button.classList.remove("is-done", "is-failed"), 1500);
}

const refreshAll = () => Promise.all(Object.keys(refreshers).map(refresh));

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-refresh]");
  if (btn && !btn.classList.contains("is-loading")) refresh(btn.dataset.refresh);
});

// Fetch fresh data right away on every load/reload, then keep it fresh while the tab is open.
refreshAll();
setInterval(refreshAll, AUTO_REFRESH_MIN * 60_000);

// Coming back to a tab that has been in the background for a while? Refresh immediately.
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) refreshAll();
});
