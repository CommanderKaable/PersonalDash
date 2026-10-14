// Date line, week number and clock (the colon blinks via CSS).

import { isoWeek, fmtTime, fmtDate } from "../lib/time.js";

export function initMasthead({ editionEl, weekEl, clockEl }) {
  const tick = () => {
    const now = new Date();
    const [hh, mm] = fmtTime(now).split(":");
    clockEl.innerHTML = `${hh}<span class="blink">:</span>${mm}`;
    clockEl.dateTime = now.toISOString();
    weekEl.textContent = `Vecka ${isoWeek(now).week}`;
    editionEl.textContent = fmtDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };
  tick();
  // Re-sync to the start of each minute.
  setTimeout(() => { tick(); setInterval(tick, 60_000); }, (60 - new Date().getSeconds()) * 1000);
}
