"use client";

import { cloneElement, useEffect, useState } from "react";

// Maps section id → URL the close button should leave the user on.
// Clean URLs (no hash) — the user's already scrolled to the section, so
// the URL bar shouldn't carry redundant anchor clutter. Refreshing at
// the clean URL lands at page top; the scroll preservation trade-off is
// worth the visual cleanliness.
const CLOSE_URL = {
  projects: "/",
  experience: "/",
  travel: "/personal",
  writing: "/personal",
  gallery: "/personal",
};

// Shared-link arrival choreography:
//   1. Wait for layout to stabilize (async-loaded components — D3 map,
//      pinboard wall, dnd-kit, dynamic imports — shift section positions as
//      they mount; scrolling before they settle lands you at the wrong place)
//   2. Programmatic anchor click — same code path as a navbar `<a href="#x">`,
//      so scroll-behavior:smooth + scroll-padding-top from globals.css give
//      pixel-perfect parity with a navbar click
//   3. Detect scroll settle via RAF polling on scrollY (not a fixed timer,
//      which can't know how long a particular distance takes)
//   4. Mount the modal once scroll has truly stopped
//
// Modal mount + close are managed locally — close = unmount + replaceState,
// NEVER router.replace. router.replace would unmount + re-hydrate the
// landing tree, blocking interaction for hundreds of ms.
export default function SlugLandingChoreography({ sectionId, children }) {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section) {
      setShowModal(true);
      return;
    }

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reducedMotion) {
      section.scrollIntoView({ block: "start" });
      setShowModal(true);
      return;
    }

    let cancelled = false;
    let stabilityInterval = null;
    let stabilityFallback = null;
    let rafId = null;

    // Step 3+4: wait for scroll position to stabilize, then mount the modal.
    function waitForScrollSettle() {
      if (cancelled) return;
      const startMs = performance.now();
      let lastY = window.scrollY;
      let stableSince = null;
      let scrollStarted = false;

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();

        // Hard ceiling — never strand the user
        if (now - startMs > 5000) {
          setShowModal(true);
          return;
        }

        const currentY = window.scrollY;
        const moved = Math.abs(currentY - lastY) >= 1;

        if (moved) {
          scrollStarted = true;
          stableSince = null;
          lastY = currentY;
        } else if (scrollStarted) {
          // Stable for SETTLE_MS after scroll started → done
          if (stableSince === null) stableSince = now;
          if (now - stableSince >= 200) {
            setShowModal(true);
            return;
          }
        } else if (now - startMs > 700) {
          // Scroll never started — page was already at target
          setShowModal(true);
          return;
        }

        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    // Step 2: trigger native anchor scroll, then start settle detection.
    function triggerScroll() {
      if (cancelled) return;
      const a = document.createElement("a");
      a.href = `#${sectionId}`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Strip the hash the click added — keep the slug URL clean
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );

      waitForScrollSettle();
    }

    // Step 1: wait for layout to stabilize before scrolling. Poll
    // document.documentElement.scrollHeight every 100ms; once it's unchanged
    // for 300ms we consider async components done mounting.
    let lastHeight = 0;
    let stableHeightTicks = 0;
    const REQUIRED_STABLE = 3;

    stabilityInterval = setInterval(() => {
      if (cancelled) return;
      const h = document.documentElement.scrollHeight;
      if (h === lastHeight) {
        stableHeightTicks++;
        if (stableHeightTicks >= REQUIRED_STABLE) {
          clearInterval(stabilityInterval);
          clearTimeout(stabilityFallback);
          triggerScroll();
        }
      } else {
        stableHeightTicks = 0;
        lastHeight = h;
      }
    }, 100);

    // If layout never stabilizes (e.g., something is constantly resizing)
    // proceed anyway after 2s so we never strand.
    stabilityFallback = setTimeout(() => {
      clearInterval(stabilityInterval);
      triggerScroll();
    }, 2000);

    return () => {
      cancelled = true;
      if (stabilityInterval) clearInterval(stabilityInterval);
      if (stabilityFallback) clearTimeout(stabilityFallback);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sectionId]);

  // Local close — no route change, no re-hydration. URL bar is swapped
  // via replaceState so refreshing lands on the clean landing URL.
  function handleClose() {
    setShowModal(false);
    const target = CLOSE_URL[sectionId];
    if (target) {
      window.history.replaceState(null, "", target);
    }
  }

  if (!showModal) return null;

  // Inject onClose so the modal's close button / ESC / backdrop click
  // call our local close handler instead of doing their own router.back.
  return cloneElement(children, { onClose: handleClose });
}
