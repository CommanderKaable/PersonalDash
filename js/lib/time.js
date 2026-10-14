// Date and time helpers. Everything runs in the browser's local time (Europe/Stockholm for Rob).

export const DAY_NAMES = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

/** ISO 8601 week: weeks start on Monday, week 1 contains the year's first Thursday. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;          // Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - day);  // move to the Thursday of this week
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { year, week };
}

/** Key used in yearplan.json, e.g. "2026-42". */
export function weekKey(date) {
  const { year, week } = isoWeek(date);
  return `${year}-${String(week).padStart(2, "0")}`;
}

/** "2026-10-14" in local time. */
export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoDay(date) {
  return date.getDay() || 7;
}

/** "08:30" -> Date on the same day as `base`. */
export function atTime(base, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** 83 -> "1 h 23 min", 12 -> "12 min" */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "för 3 h sedan" style relative time. */
export function timeAgo(iso, now = new Date()) {
  if (!iso) return "";
  const min = (now - new Date(iso)) / 60000;
  if (min < 1) return "nyss";
  if (min < 60) return `${Math.round(min)} min sedan`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h sedan`;
  const days = Math.round(min / 1440);
  return days === 1 ? "i går" : `${days} dagar sedan`;
}

export const fmtTime = (d) => d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
export const fmtDate = (d, opts) => d.toLocaleDateString("sv-SE", opts);
