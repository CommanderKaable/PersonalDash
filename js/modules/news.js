// News & Sport panel.
//   Main sections (config.sections): Nyheter → Världen, Tech   |   Sport → NHL, SHL, Mina lag
// The body auto-scrolls. When you haven't touched the panel for a while, it cycles through
// every tab on its own after each full pass. Your own clicks are remembered; auto-cycling isn't.

import { esc, store } from "../lib/data.js";
import { timeAgo } from "../lib/time.js";
import { autoScroll } from "../lib/autoscroll.js";
import { nhlHTML, shlHTML, myTeamsHTML } from "./sports.js";

const KEY = "startsida.newsView";

function listHTML(items, empty = "Inga rubriker just nu.") {
  if (!items?.length) return `<p class="muted">${empty}</p>`;
  return `<ul class="feed stagger">${items.slice(0, 25).map((i) => `
    <li>
      <a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>
      <span class="feed__meta">${esc(i.source)}${i.date ? ` · ${esc(timeAgo(i.date))}` : ""}${
        i.comments ? ` · <a href="${esc(i.comments)}" target="_blank" rel="noopener">${i.points ?? 0} p</a>` : ""}</span>
    </li>`).join("")}</ul>`;
}

export function createNews({ panelEl, sectionsEl, tabsEl, bodyEl, stampEl, sections, hockeyConfig, autoCycle }) {
  let feeds = null;
  let hockey = null;

  // Every (section, tab) pair in order — the auto-cycle walks through this list.
  const views = sections.flatMap((s) => s.tabs.map((tab) => ({ section: s.name, tab })));
  const saved = store.get(KEY);
  let index = Math.max(0, views.findIndex((v) => v.section === saved?.section && v.tab === saved?.tab));

  // ----- idle detection -----
  let lastTouch = 0; // 0 = never touched, so cycling may start right away
  for (const ev of ["pointerdown", "pointermove", "wheel", "keydown", "focusin"]) {
    panelEl.addEventListener(ev, () => { lastTouch = performance.now(); }, { passive: true });
  }
  const idle = () => performance.now() - lastTouch > (autoCycle?.idleSeconds ?? 45) * 1000;

  const scroller = autoScroll(bodyEl, {
    speed: 22,
    dwell: (autoCycle?.dwellSeconds ?? 25) * 1000,
    onEnd: () => {
      if (!autoCycle?.enabled || !idle()) return false;
      go((index + 1) % views.length, { auto: true });
      return true;
    },
  });

  function bodyFor({ section, tab }) {
    const cats = feeds?.categories || {};
    const myNHL = hockeyConfig?.nhl?.team;
    const mySHL = hockeyConfig?.shl?.match;
    if (section === "Sport") {
      if (tab === "NHL") return `<div class="stagger">${nhlHTML(hockey, myNHL)}</div><h3 class="news-sub">Rubriker</h3>${listHTML(cats.NHL)}`;
      if (tab === "SHL") return `<div class="stagger">${shlHTML(hockey, mySHL)}</div><h3 class="news-sub">Rubriker</h3>${listHTML(cats.SHL)}`;
      return `<div class="stagger">${myTeamsHTML(hockey, mySHL)}</div>`;
    }
    return listHTML(cats[tab]);
  }

  function draw() {
    const view = views[index];
    sectionsEl.innerHTML = sections.map((s) =>
      `<button class="section-tab" role="tab" aria-selected="${s.name === view.section}" data-section="${esc(s.name)}">${esc(s.name)}</button>`).join("");
    const current = sections.find((s) => s.name === view.section);
    tabsEl.innerHTML = current.tabs.map((t) =>
      `<button class="tab" role="tab" aria-selected="${t === view.tab}" data-tab="${esc(t)}">${esc(t)}</button>`).join("");

    bodyEl.innerHTML = bodyFor(view);
    scroller.reset();

    const times = [feeds?.updated, view.section === "Sport" ? hockey?.updated : null].filter(Boolean).sort();
    const errs = feeds?.errors?.length ? ` · ${feeds.errors.length} källa(or) svarade inte` : "";
    stampEl.textContent = times.length ? `Uppdaterad ${timeAgo(times[0])}${errs}` : "Ingen data än – den hämtas av GitHub Actions.";
  }

  function go(i, { auto = false } = {}) {
    index = i;
    panelEl.classList.toggle("is-cycling", auto);
    if (!auto) store.set(KEY, views[index]);
    draw();
  }

  sectionsEl.addEventListener("click", (e) => {
    const name = e.target.closest("[data-section]")?.dataset.section;
    if (!name) return;
    // Jump to the first tab of that section (or stay if already there).
    if (views[index].section !== name) go(views.findIndex((v) => v.section === name));
  });
  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]")?.dataset.tab;
    if (!tab) return;
    go(views.findIndex((v) => v.section === views[index].section && v.tab === tab));
  });

  return {
    update(next) {
      feeds = next.feeds ?? feeds;
      hockey = next.hockey ?? hockey;
      draw();
    },
  };
}
