// Sport views for the news panel: NHL (games + standings), SHL (table) and "Mina lag".

import { esc } from "../lib/data.js";
import { hockeyHTML } from "./hockey.js";

const STATE_SV = { FUT: "", PRE: "Snart", LIVE: "LIVE", CRIT: "LIVE", FINAL: "Slut", OFF: "Slut" };
const fmtStart = (iso) => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

function nhlGamesHTML(scores, myTeam) {
  const games = scores?.games || [];
  if (!games.length) return `<p class="muted">Inga NHL-matcher just nu.</p>`;
  return `<div class="games">${games.map((g) => {
    const mine = g.home === myTeam || g.away === myTeam;
    const started = g.homeScore != null && g.state !== "FUT" && g.state !== "PRE";
    const live = g.state === "LIVE" || g.state === "CRIT";
    const extra = g.lastPeriod === "OT" ? " ÖT" : g.lastPeriod === "SO" ? " S" : "";
    return `<div class="gm ${mine ? "is-mine" : ""}">
      <span class="gm__teams">${esc(g.away)} <span class="muted">@</span> ${esc(g.home)}</span>
      <span class="gm__score">${started ? `${g.awayScore}–${g.homeScore}${extra}` : fmtStart(g.start)}</span>
      <span class="gm__state ${live ? "is-live" : ""}">${live ? `P${g.period ?? ""}` : esc(STATE_SV[g.state] ?? "")}</span>
    </div>`;
  }).join("")}</div>`;
}

function standingsTable(rows, isMine, cols) {
  return `<table class="tbl">
    <thead><tr><th>#</th><th>Lag</th>${cols.map((c) => `<th class="num">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r, i) => `
      <tr class="${isMine(r) ? "is-mine" : ""}">
        <td class="num">${r.rank ?? i + 1}</td>
        <td>${esc(r.name || r.team)}</td>
        ${cols.map((c) => `<td class="num">${esc(r[c.key] ?? "")}</td>`).join("")}
      </tr>`).join("")}
    </tbody></table>`;
}

export function nhlHTML(hockey, myTeam) {
  const nhl = hockey?.nhl;
  if (!nhl) return `<p class="muted">Ingen NHL-data än – den hämtas av GitHub Actions.</p>`;
  const table = nhl.standings || [];
  const divisions = [...new Set(table.map((r) => r.division))];
  // Put my team's division first.
  const mine = table.find((r) => r.team === myTeam)?.division;
  divisions.sort((a, b) => (b === mine) - (a === mine));
  const cols = [{ key: "gp", label: "M" }, { key: "gd", label: "+/-" }, { key: "pts", label: "P" }];
  const tables = divisions.map((d) => {
    const rows = table.filter((r) => r.division === d)
      .sort((a, b) => a.divisionRank - b.divisionRank)
      .map((r) => ({ ...r, rank: r.divisionRank }));
    return `<h4 class="news-sub">${esc(d)}</h4>${standingsTable(rows, (r) => r.team === myTeam, cols)}`;
  }).join("");
  return `<h3 class="news-sub">Matcher${nhl.scores?.date ? ` · ${esc(nhl.scores.date)}` : ""}</h3>
    ${nhlGamesHTML(nhl.scores, myTeam)}
    <h3 class="news-sub">Tabell</h3>
    ${tables || `<p class="muted">Ingen tabell än.</p>`}`;
}

export function shlHTML(hockey, match) {
  const shl = hockey?.shl;
  const isMine = (r) => match && r.team.toLowerCase().includes(match.toLowerCase());
  const table = shl?.table?.length
    ? standingsTable(shl.table, isMine, [{ key: "gp", label: "M" }, { key: "gd", label: "+/-" }, { key: "pts", label: "P" }])
      + (shl.tableSource ? `<p class="stamp">Källa: <a href="${esc(shl.tableSource)}" target="_blank" rel="noopener">Wikipedia</a></p>` : "")
    : `<p class="muted">Tabellen kunde inte hämtas just nu.</p>`;
  return `<h3 class="news-sub">Tabell</h3>${table}
    <p class="stamp"><a href="${esc(shl?.link || "https://www.shl.se/")}" target="_blank" rel="noopener">Matcher och statistik på shl.se →</a></p>`;
}

export function myTeamsHTML(hockey, match) {
  const row = hockey?.shl?.table?.find((r) => match && r.team.toLowerCase().includes(match.toLowerCase()));
  const shlPos = row ? `<p class="team__standing">${row.rank}:a i SHL · ${row.pts} p på ${row.gp} matcher</p>` : "";
  return hockeyHTML(hockey, { shlStanding: shlPos });
}
