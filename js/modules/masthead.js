// Masthead: the weekday as the headline, "Vecka 42 · 14 oktober 2026" under it, the clock on the right.

import { isoWeek, fmtTime, fmtDate } from "../lib/time.js";

export function initMasthead({ dayEl, editionEl, clockEl }) {
  const tick = () => {
    const now = new Date();
    const [hh, mm] = fmtTime(now).split(":");
    clockEl.innerHTML = `${hh}<span class="blink">:</span>${mm}`;
    clockEl.dateTime = now.toISOString();

    const day = fmtDate(now, { weekday: "long" });
    if (dayEl.textContent !== day) {
      dayEl.textContent = day;
      dayEl.dataset.text = day; // used by the CSS glitch effect
    }
    editionEl.textContent = `Vecka ${isoWeek(now).week} · ${fmtDate(now, { day: "numeric", month: "long", year: "numeric" })}`;
  };
  tick();
  // Re-sync to the start of each minute.
  setTimeout(() => { tick(); setInterval(tick, 60_000); }, (60 - new Date().getSeconds()) * 1000);
}
