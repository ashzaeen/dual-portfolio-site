"use client";

import { useCallback, useEffect, useRef } from "react";

// Fires `fire(durationMs)` exactly once when `active` flips from true→false
// OR when the component unmounts while still active. Powers every *_closed /
// duration event for in-place (non-route) surfaces: the immersive wall,
// expanded experiences, the writing archive overlay, open postcards, etc.
//
// `fire` is read through a ref so callers can pass an inline arrow without
// retriggering the timer on every render.
export function useDwellDuration(active, fire) {
  const startRef = useRef(null);
  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    return () => {
      if (startRef.current == null) return;
      fireRef.current(Math.round(performance.now() - startRef.current));
      startRef.current = null;
    };
  }, [active]);
}

// Returns `{ onMouseEnter, onMouseLeave }` that fire `fire(durationMs)` on
// mouse-leave, but only when the pointer dwelled at least `minMs` (filters out
// drive-by passes). Compose with a component's existing hover handlers.
export function useHoverDwell(fire, minMs = 500) {
  const startRef = useRef(0);
  const fireRef = useRef(fire);
  fireRef.current = fire;

  const onMouseEnter = useCallback(() => {
    startRef.current = performance.now();
  }, []);

  const onMouseLeave = useCallback(() => {
    if (!startRef.current) return;
    const d = Math.round(performance.now() - startRef.current);
    startRef.current = 0;
    if (d >= minMs) fireRef.current(d);
  }, [minMs]);

  return { onMouseEnter, onMouseLeave };
}
