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
 *
 * On touchend, if the relay was active on the last frame, we compute
 * velocity from recent touch samples and run an iOS-style inertia loop
 * so the page decelerates naturally instead of stopping dead.
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
    // deltaY convention:
    //   finger up   → deltaY > 0 → content scrolls down (scrollTop ↑)
    //   finger down → deltaY < 0 → content scrolls up   (scrollTop ↓)
    let lastY = 0;
    // True only when the most recent touchmove event triggered the relay.
    // Cleared on touchstart and whenever the inner scroll is not at its boundary.
    let wasRelaying = false;
    // Sliding window of { t, y } samples; kept to last ~80 ms for velocity.
    const samples = [];
    let rafId = null;

    const cancelMomentum = () => {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };

    const onTouchStart = (e) => {
      lastY = e.touches[0].clientY;
      wasRelaying = false;
      samples.length = 0;
      samples.push({ t: performance.now(), y: lastY });
      cancelMomentum();
    };

    const onTouchMove = (e) => {
      const y      = e.touches[0].clientY;
      const deltaY = lastY - y;
      lastY = y;

      const now = performance.now();
      samples.push({ t: now, y });
      // Discard samples older than 80 ms so velocity reflects recent movement.
      while (samples.length > 1 && now - samples[0].t > 80) samples.shift();

      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop    = scrollTop <= 1;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        e.preventDefault();
        // "instant" keeps the relay exactly 1:1 with finger movement —
        // "auto" can trigger smooth-scroll and feel sluggish on some browsers.
        window.scrollBy({ top: deltaY, behavior: "instant" });
        wasRelaying = true;
      } else {
        wasRelaying = false;
      }
    };

    const onTouchEnd = () => {
      if (!wasRelaying || samples.length < 2) return;

      // Velocity from the most recent 80 ms of samples (px / ms).
      // finger up → y decreases → first.y > last.y → positive velocity → page scrolls down.
      const first = samples[0];
      const last  = samples[samples.length - 1];
      const dt = last.t - first.t;
      if (dt < 5) return;
      const velocity = (first.y - last.y) / dt; // px/ms, sign matches scrollBy direction

      // iOS-style deceleration: 0.996 per ms gives ~500 ms coast at typical swipe speeds.
      // Adjust toward 0.998 for faster/longer coasts, 0.993 for shorter.
      const DECEL = 0.996;
      let v = velocity;
      let prevTime = performance.now();

      const tick = (now) => {
        const elapsed = now - prevTime;
        prevTime = now;
        v *= Math.pow(DECEL, elapsed);
        if (Math.abs(v) < 0.05) { rafId = null; return; }
        window.scrollBy({ top: v * elapsed, behavior: "instant" });
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    el.addEventListener("wheel",       onWheel,         { passive: false });
    el.addEventListener("touchstart",  onTouchStart,    { passive: true  });
    el.addEventListener("touchmove",   onTouchMove,     { passive: false });
    el.addEventListener("touchend",    onTouchEnd,      { passive: true  });
    el.addEventListener("touchcancel", cancelMomentum,  { passive: true  });

    return () => {
      el.removeEventListener("wheel",       onWheel);
      el.removeEventListener("touchstart",  onTouchStart);
      el.removeEventListener("touchmove",   onTouchMove);
      el.removeEventListener("touchend",    onTouchEnd);
      el.removeEventListener("touchcancel", cancelMomentum);
      cancelMomentum();
    };
  }, [ref]);
}
