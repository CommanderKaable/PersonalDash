// "Mina lag": team cards for Penguins (NHL API) and Växjö Lakers (table position + news).

import { esc } from "../lib/data.js";
import { timeAgo } from "../lib/time.js";

const fmtGameTime = (iso) =>
  new Date(iso).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const PERIOD = { OT: " (förl.)", SO: " (straff.)" };

function penguinsHTML(nhl) {
  if (!nhl) return `<p class="muted">Ingen NHL-data än.</p>`;
  const s = nhl.standing;
  const standing = s
    ? `<p class="team__standing">${s.divisionRank}:a i ${esc(s.division)} · ${s.points} p · ${esc(s.record)}</p>`
    : "";

  const live = nhl.live
    ? `<div class="game"><span><span class="game__res game__res--live">LIVE</span>${nhl.live.home ? "vs" : "@"} ${esc(nhl.live.opponent)}</span>
       <span class="game__score">${nhl.live.us ?? 0}–${nhl.live.them ?? 0}</span></div>`
    : "";

  const last = (nhl.last || []).map((g) => {
    const win = g.us > g.them;
    return `<div class="game">
      <span><span class="game__res game__res--${win ? "w" : "l"}">${win ? "V" : "F"}</span>${g.home ? "vs" : "@"} ${esc(g.opponent)}</span>
      <span class="game__score">${g.us}–${g.them}${PERIOD[g.lastPeriod] || ""}</span>
    </div>`;
  }).join("");

  const next = (nhl.next || []).map((g) => `
    <div class="game">
      <span>${g.home ? "vs" : "@"} ${esc(g.opponentName)}</span>
      <span class="game__when">${esc(fmtGameTime(g.start))}</span>
    </div>`).join("");

  return `${standing}${live}${last}${next}`;
}

function lakersHTML(shl, standing = "") {
  if (!shl) return "";
  const news = (shl.news || []).slice(0, 4).map((n) => `
    <li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      <span class="feed__meta">${esc(timeAgo(n.date))}</span></li>`).join("");
  return `${standing}${news ? `<ul class="team__news">${news}</ul>` : `<p class="muted">Inga nyheter än.</p>`}
    <p class="stamp"><a href="${esc(shl.link)}" target="_blank" rel="noopener">Tabell och matcher på shl.se →</a></p>`;
}

/** Penguins + Lakers cards. */
export function hockeyHTML(data, { shlStanding = "" } = {}) {
  if (!data) return `<p class="muted">Ingen hockeydata än – den hämtas av GitHub Actions.</p>`;
  return `
    <div class="team">
      <h3 class="team__name">${esc(data.nhl?.name || "Pittsburgh Penguins")}</h3>
      ${penguinsHTML(data.nhl)}
    </div>
    <div class="team">
      <h3 class="team__name">${esc(data.shl?.name || "Växjö Lakers")}</h3>
      ${lakersHTML(data.shl, shlStanding)}
    </div>`;
}
