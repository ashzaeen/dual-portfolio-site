"use client";
import { useEffect } from "react";

/**
 * When a scroll container reaches its top or bottom boundary, relay the
 * remaining movement to the page instead of trapping it.
 *
 * Covers both wheel (desktop) and touch (mobile). Touch requires
 * { passive: false } on touchmove so we can call preventDefault() to
 * suppress the inner container's elastic overscroll before handing off
 * to window.scrollBy().
 */
export function useScrollChain(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    // ── Wheel (desktop / trackpad) ──────────────────────────────────────────
    const onWheel = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop    = scrollTop <= 1;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };

    // ── Touch (mobile) ──────────────────────────────────────────────────────
    // deltaY convention used here:
    //   finger moves UP   → deltaY > 0 → content scrolls DOWN (scrollTop ↑)
    //   finger moves DOWN → deltaY < 0 → content scrolls UP   (scrollTop ↓)
    // So relay conditions:
    //   atTop    && deltaY < 0  (finger going down, can't scroll further up)
    //   atBottom && deltaY > 0  (finger going up,   can't scroll further down)
    let lastY = 0;

    const onTouchStart = (e) => {
      lastY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      const y      = e.touches[0].clientY;
      const deltaY = lastY - y; // positive = finger moved up = content scrolls down
      lastY = y;

      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop    = scrollTop <= 1;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        e.preventDefault();
        window.scrollBy({ top: deltaY, behavior: "auto" });
      }
    };

    el.addEventListener("wheel",      onWheel,      { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true  });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });

    return () => {
      el.removeEventListener("wheel",      onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
    };
  }, [ref]);
}
