// News feeds with category tabs. createFeeds() wires the tabs once; update() can be called
// again whenever new data arrives (refresh button, auto-refresh).

import { esc, store } from "../lib/data.js";
import { timeAgo } from "../lib/time.js";

const TAB_KEY = "startsida.feedTab";

function itemsHTML(items) {
  return items.length
    ? items.slice(0, 12).map((i) => `
      <li>
        <a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>
        <span class="feed__meta">${esc(i.source)}${i.date ? ` · ${esc(timeAgo(i.date))}` : ""}${
          i.comments ? ` · <a href="${esc(i.comments)}" target="_blank" rel="noopener">${i.points ?? 0} p</a>` : ""}</span>
      </li>`).join("")
    : `<li class="muted">Inget i det här flödet just nu.</li>`;
}

export function createFeeds({ tabsEl, listEl, stampEl }) {
  let categories = {};
  let active = store.get(TAB_KEY);

  function draw() {
    const names = Object.keys(categories);
    if (!names.length) {
      listEl.innerHTML = `<li class="muted">Ingen data än – den hämtas av GitHub Actions.</li>`;
      return;
    }
    if (!names.includes(active)) active = names[0];
    tabsEl.innerHTML = names.map((n) =>
      `<button class="tab" role="tab" aria-selected="${n === active}" data-tab="${esc(n)}">${esc(n)}</button>`).join("");
    // Re-adding the class restarts the staggered entrance animation.
    listEl.classList.remove("stagger");
    void listEl.offsetWidth;
    listEl.innerHTML = itemsHTML(categories[active]);
    listEl.classList.add("stagger");
  }

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    active = btn.dataset.tab;
    store.set(TAB_KEY, active);
    draw();
  });

  return {
    update(data) {
      categories = data?.categories || {};
      draw();
      if (data?.updated) {
        const errs = data.errors?.length ? ` · ${data.errors.length} källa(or) svarade inte` : "";
        stampEl.textContent = `Uppdaterad ${timeAgo(data.updated)}${errs}`;
      }
    },
  };
}
