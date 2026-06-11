"use client";

import { useEffect, useState } from "react";

// Viewport selector for the Gallery's mobile rebuild. Returns `false` until
// the component has mounted so the server render and the first client render
// always agree (no hydration mismatch); after mount it reflects the live
// match and updates on viewport changes.
//
// 768px = true phones. The 769–1100px tablet band intentionally keeps the
// desktop board's flex fallback — the mobile rebuild targets phones, where
// the gesture/scroll pain actually lives.
export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    setMounted(true);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [maxWidth]);

  return { isMobile, mounted };
}
