// Market table. Rows whose price changed since the last render flash green/red.

import { esc } from "../lib/data.js";
import { timeAgo } from "../lib/time.js";

const num = (v, digits) =>
  v == null ? "–" : v.toLocaleString("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const previous = new Map(); // name -> last rendered price

export function renderMarket(table, stamp, data) {
  if (!data?.rows?.length) {
    table.innerHTML = `<tr><td class="muted">Ingen data än – den hämtas av GitHub Actions.</td></tr>`;
    return;
  }
  let html = "";
  let group = null;
  for (const r of data.rows) {
    if (r.group !== group) {
      group = r.group;
      html += `<tr><th colspan="3">${esc(group)}</th></tr>`;
    }
    const before = previous.get(r.name);
    const flash = before != null && r.price != null && before !== r.price
      ? (r.price > before ? "flash-up" : "flash-down") : "";
    previous.set(r.name, r.price);

    const digits = r.group === "Valuta" ? 3 : r.price >= 1000 ? 0 : 2;
    const dir = r.change == null ? "" : r.change >= 0 ? "up" : "down";
    const sign = r.change > 0 ? "+" : "";
    html += `<tr class="${flash}">
      <td>${esc(r.name)}</td>
      <td>${num(r.price, digits)}</td>
      <td class="chg ${dir && `chg--${dir}`}">${r.change == null ? "" : `${sign}${num(r.change, 1)} %`}</td>
    </tr>`;
  }
  table.innerHTML = html;
  const live = data.liveCrypto ? " · krypto live" : "";
  stamp.textContent = `Uppdaterad ${timeAgo(data.updated)}${live} · fördröjda kurser`;
}
