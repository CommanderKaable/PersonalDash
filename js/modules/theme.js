// Light/dark switch. The initial theme is set by a tiny script in <head> (no flash);
// this module wires up the button and remembers the choice.

import { store } from "../lib/data.js";

const KEY = "startsida.theme";

export function initTheme(button, labelEl) {
  const root = document.documentElement;

  const apply = (theme) => {
    root.dataset.theme = theme;
    // The label names the theme you will switch TO.
    labelEl.textContent = theme === "dark" ? "Ljust" : "Mörkt";
    button.setAttribute("aria-pressed", String(theme === "dark"));
  };

  apply(root.dataset.theme || "light");

  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    store.set(KEY, next);
    apply(next);
  });

  // If you never chose manually, follow the operating system when it changes.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (store.get(KEY) === null) apply(e.matches ? "dark" : "light");
  });
}
