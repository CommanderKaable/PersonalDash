// Tabbed news panel: Världen / Tech / Sport. The Sport tab starts with the hockey block.
// The list box auto-scrolls; switching tab or getting new data starts it from the top.

import { esc, store } from "../lib/data.js";
import { timeAgo } from "../lib/time.js";
import { autoScroll } from "../lib/autoscroll.js";
import { hockeyHTML } from "./hockey.js";

const TAB_KEY = "startsida.newsTab";

function listHTML(items) {
  if (!items?.length) return `<p class="muted">Inga rubriker just nu.</p>`;
  return `<ul class="feed stagger">${items.slice(0, 25).map((i) => `
    <li>
      <a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>
      <span class="feed__meta">${esc(i.source)}${i.date ? ` · ${esc(timeAgo(i.date))}` : ""}${
        i.comments ? ` · <a href="${esc(i.comments)}" target="_blank" rel="noopener">${i.points ?? 0} p</a>` : ""}</span>
    </li>`).join("")}</ul>`;
}

export function createNews({ tabsEl, bodyEl, stampEl, tabs }) {
  let feeds = null;
  let hockey = null;
  let active = store.get(TAB_KEY);
  const scroller = autoScroll(bodyEl);

  function draw({ keepPosition = false } = {}) {
    if (!tabs.includes(active)) active = tabs[0];
    tabsEl.innerHTML = tabs.map((t) =>
      `<button class="tab" role="tab" aria-selected="${t === active}" data-tab="${esc(t)}">${esc(t)}</button>`).join("");

    const items = feeds?.categories?.[active] || [];
    bodyEl.innerHTML = active === "Sport"
      ? `<div class="stagger">${hockeyHTML(hockey)}</div><h3 class="news-sub">Sportnyheter</h3>${listHTML(items)}`
      : listHTML(items);
    if (!keepPosition) scroller.reset();

    const times = [feeds?.updated, active === "Sport" ? hockey?.updated : null].filter(Boolean).sort();
    const errs = feeds?.errors?.length ? ` · ${feeds.errors.length} källa(or) svarade inte` : "";
    stampEl.textContent = times.length ? `Uppdaterad ${timeAgo(times[0])}${errs}` : "Ingen data än – den hämtas av GitHub Actions.";
  }

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    active = btn.dataset.tab;
    store.set(TAB_KEY, active);
    draw();
  });

  return {
    update(next) {
      feeds = next.feeds ?? feeds;
      hockey = next.hockey ?? hockey;
      draw();
    },
  };
}
