// Slowly scrolls a box downwards, pauses at the bottom, glides back to the top and repeats.
// Stops while the mouse is over it, and gives control to you for a while if you scroll yourself.
// Optional onEnd(): called after each full pass (or after `dwell` ms if nothing needs scrolling).
// Return true from it if you replaced the content (e.g. switched tab) — then reset() is expected.

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export function autoScroll(el, { speed = 16, pauseTop = 3000, pauseBottom = 3500, userPause = 8000, dwell = 20000, onEnd = null } = {}) {
  let pos = 0;              // float position (scrollTop rounds to whole pixels)
  let waitUntil = performance.now() + pauseTop;
  let atBottom = false;
  let hovered = false;
  let last = performance.now();
  let expected = 0;         // where we last asked the box to be
  let smoothUntil = 0;      // ignore scroll events while gliding back to the top

  el.addEventListener("mouseenter", () => { hovered = true; el.classList.add("is-paused"); });
  el.addEventListener("mouseleave", () => { hovered = false; el.classList.remove("is-paused"); });
  el.addEventListener("focusin", () => { hovered = true; });
  el.addEventListener("focusout", () => { hovered = false; });

  // Your own scrolling (wheel, touch, keyboard) wins: take over from where you left it.
  el.addEventListener("scroll", () => {
    if (performance.now() < smoothUntil || Math.abs(el.scrollTop - expected) <= 2) return; // our own movement
    pos = el.scrollTop;
    atBottom = false;
    waitUntil = performance.now() + userPause;
  }, { passive: true });

  const setTop = (value, smooth = false) => {
    expected = value;
    if (smooth) smoothUntil = performance.now() + 1200;
    el.scrollTo({ top: value, behavior: smooth ? "smooth" : "auto" });
  };

  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    const max = el.scrollHeight - el.clientHeight;

    const canScroll = max > 4 && !reducedMotion.matches;

    if (!hovered && now >= waitUntil) {
      if (canScroll) {
        if (atBottom) {
          if (!onEnd?.()) {          // nobody switched the content: glide back up and go again
            pos = 0;
            atBottom = false;
            setTop(0, true);
            waitUntil = now + pauseTop;
          }
        } else {
          pos = Math.min(max, pos + (speed * dt) / 1000);
          setTop(pos);
          if (pos >= max - 0.5) {
            atBottom = true;
            waitUntil = now + pauseBottom;
          }
        }
      } else if (onEnd && now >= waitUntil + dwell) {
        if (!onEnd()) waitUntil = now + dwell;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    /** Call after replacing the content: start again from the top. */
    reset() {
      pos = 0;
      atBottom = false;
      setTop(0);
      waitUntil = performance.now() + pauseTop;
    },
  };
}
