// Entry point: load the data files, start each module, wire up refresh buttons.

import { loadJSON } from "./lib/data.js";
import { initMasthead } from "./modules/masthead.js";
import { initTheme } from "./modules/theme.js";
import { initWeather } from "./modules/weather.js";
import { initSchedule } from "./modules/schedule.js";
import { renderWeekplan } from "./modules/weekplan.js";
import { renderHockey } from "./modules/hockey.js";
import { renderMarket } from "./modules/market.js";
import { createFeeds } from "./modules/feeds.js";
import { renderTicker } from "./modules/ticker.js";
import { initNotes } from "./modules/notes.js";
import { liveHackerNews, liveCrypto } from "./modules/live.js";

const $ = (id) => document.getElementById(id);
const AUTO_REFRESH_MIN = 10;

initMasthead({ editionEl: $("edition"), weekEl: $("week"), clockEl: $("clock") });
initTheme($("theme-toggle"), $("theme-label"));
initNotes($("notes"), $("notes-status"));

// Hand-edited data (in the repo) and live data (written by GitHub Actions every 30 min).
const [config, timetable, yearplan, hockey, market, feeds] = await Promise.all([
  loadJSON("data/config.json"),
  loadJSON("data/timetable.json"),
  loadJSON("data/yearplan.json"),
  loadJSON("data/live/hockey.json"),
  loadJSON("data/live/market.json"),
  loadJSON("data/live/feeds.json"),
]);

const state = { hockey, market, feeds };
const feedsView = createFeeds({ tabsEl: $("feed-tabs"), listEl: $("feed"), stampEl: $("feed-stamp") });

const draw = {
  hockey: () => renderHockey($("hockey"), state.hockey),
  market: () => renderMarket($("market"), $("market-stamp"), state.market),
  feeds: () => feedsView.update(state.feeds),
  ticker: () => renderTicker($("ticker"), $("ticker-track"), state),
};

initSchedule({ timetable, yearplan, nowEl: $("now"), agendaEl: $("agenda") });
renderWeekplan($("weekplan"), yearplan);
Object.values(draw).forEach((fn) => fn());
initWeather($("weather"), config?.locations || []);

// ---------- Refreshing ----------
// Each refresher re-reads the cached file from the latest Action run, then tops it up with
// anything the browser is allowed to fetch live. Returns true if anything was fetched.

const refreshers = {
  async hockey() {
    const cached = await loadJSON("data/live/hockey.json");
    if (cached) state.hockey = cached;
    return Boolean(cached);
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

  async feeds() {
    const cached = await loadJSON("data/live/feeds.json");
    const base = cached || state.feeds || { categories: {} };
    const hn = config?.feeds?.find((f) => f.type === "hn");
    let liveOk = false;
    if (hn) {
      try {
        const fresh = await liveHackerNews(hn.name);
        const list = (base.categories[hn.category] || []).filter((i) => i.source !== hn.name);
        base.categories[hn.category] = list.concat(fresh)
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .slice(0, 15);
        liveOk = true;
      } catch (err) {
        console.warn("Hacker News live:", err);
      }
    }
    state.feeds = base;
    return Boolean(cached) || liveOk;
  },
};

async function refresh(name, button) {
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

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-refresh]");
  if (btn && !btn.classList.contains("is-loading")) refresh(btn.dataset.refresh, btn);
});

// Quiet background refresh, for when the tab stays open all day.
setInterval(() => Object.keys(refreshers).forEach((name) => refresh(name)), AUTO_REFRESH_MIN * 60_000);
