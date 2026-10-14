// Auto-scrolling strip with prices, the latest Penguins result and top headlines.
// The content is rendered twice in a row; CSS slides it left by 50% and loops seamlessly.

import { esc } from "../lib/data.js";

function items({ market, hockey, feeds }) {
  const out = [];

  for (const r of market?.rows || []) {
    if (r.price == null) continue;
    const dir = r.change == null ? "" : r.change >= 0 ? "up" : "down";
    const chg = r.change == null ? "" : `${r.change >= 0 ? "▲" : "▼"} ${Math.abs(r.change).toFixed(1)}%`;
    const digits = r.group === "Valuta" ? 3 : r.price >= 1000 ? 0 : 2;
    out.push(`<span class="ticker__item"><span class="ticker__tag">${esc(r.name)}</span>
      ${r.price.toLocaleString("sv-SE", { maximumFractionDigits: digits })}
      <span class="ticker__${dir}">${chg}</span></span>`);
  }

  const last = hockey?.nhl?.last?.[0];
  if (last) {
    out.push(`<span class="ticker__item"><span class="ticker__tag ticker__tag--m">PIT</span>
      ${last.home ? "vs" : "@"} ${esc(last.opponent)} ${last.us}–${last.them}</span>`);
  }

  for (const [cat, list] of Object.entries(feeds?.categories || {})) {
    for (const n of list.slice(0, 3)) {
      out.push(`<span class="ticker__item"><span class="ticker__tag ticker__tag--m">${esc(cat)}</span>
        <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a></span>`);
    }
  }
  return out;
}

export function renderTicker(wrap, track, data) {
  const list = items(data);
  if (!list.length) {
    wrap.classList.add("is-empty");
    return;
  }
  wrap.classList.remove("is-empty");
  const html = list.join("");
  track.innerHTML = html + html; // twice, for the seamless loop
  // Keep a steady reading speed (~60 px/s) whatever the amount of content.
  requestAnimationFrame(() => {
    const seconds = Math.max(30, track.scrollWidth / 2 / 60);
    wrap.style.setProperty("--ticker-duration", `${seconds.toFixed(0)}s`);
  });
}
