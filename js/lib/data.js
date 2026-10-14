// Small helpers for loading JSON and building HTML safely.

/** Fetch a JSON file. Returns null instead of throwing, so one missing file never breaks the page. */
export async function loadJSON(path) {
  try {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.warn(`Kunde inte läsa ${path}:`, err);
    return null;
  }
}

/** Escape text before putting it into innerHTML. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** localStorage can throw (private mode, blocked storage) — never let it crash the page. */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
  },
};
