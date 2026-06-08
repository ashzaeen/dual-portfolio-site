"use client";
import { useEffect } from "react";

/**
 * When the referenced scroll container reaches its top or bottom boundary,
 * relay the remaining wheel delta to the page instead of trapping it.
 * Works around browsers that don't natively chain scroll past overflow:hidden
 * ancestors (TechStack) or inconsistent touch-pad propagation.
 */
export function useScrollChain(ref) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const onWheel = (e) => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const atTop    = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((e.deltaY > 0 && atBottom) || (e.deltaY < 0 && atTop)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
