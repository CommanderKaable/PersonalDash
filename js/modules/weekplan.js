// "Veckans plan": this week's and next week's topic per course, from yearplan.json.

import { esc } from "../lib/data.js";
import { weekKey, isoWeek, addDays, dateKey } from "../lib/time.js";

export function renderWeekplan(el, yearplan, now = new Date()) {
  if (!yearplan) {
    el.innerHTML = `<p class="error">Kunde inte läsa data/yearplan.json.</p>`;
    return;
  }
  const nextDate = addDays(now, 7);
  const thisWeek = yearplan.weeks[weekKey(now)] || {};
  const nextWeek = yearplan.weeks[weekKey(nextDate)] || {};
  const wNow = isoWeek(now).week;
  const wNext = isoWeek(nextDate).week;

  const cell = (week, key) => (week.break ? week.break : week.topics?.[key] || "–");

  const rows = Object.entries(yearplan.courses).map(([key, name]) => `
    <tr>
      <th scope="row">${esc(name)}</th>
      <td>${esc(cell(thisWeek, key))}</td>
      <td class="is-next">${esc(cell(nextWeek, key))}</td>
    </tr>`).join("");

  // Notes for this week: the week's "Övrigt" plus any special days that fall in it.
  const monday = addDays(now, 1 - (now.getDay() || 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i)));
  const specials = (yearplan.specialDays || [])
    .filter((s) => weekDates.includes(s.date))
    .map((s) => `${s.label} (${new Date(s.date).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })})`);
  const notes = [thisWeek.note, ...specials].filter(Boolean);

  el.innerHTML = `
    <table class="plan">
      <thead><tr><th>Kurs</th><th>V${wNow} · denna vecka</th><th>V${wNext} · nästa</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${notes.length ? `<p class="plan__note">${notes.map(esc).join(" · ")}</p>` : ""}`;
}
