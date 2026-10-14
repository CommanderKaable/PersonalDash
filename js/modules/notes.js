// Quick-capture notes, saved in localStorage (this browser only — never published).

import { store } from "../lib/data.js";

const KEY = "startsida.notes";

export function initNotes(textarea, statusEl) {
  textarea.value = store.get(KEY, "");
  let timer;
  textarea.addEventListener("input", () => {
    statusEl.textContent = "Skriver …";
    clearTimeout(timer);
    timer = setTimeout(() => {
      store.set(KEY, textarea.value);
      statusEl.textContent = "Sparat";
    }, 400);
  });
}
