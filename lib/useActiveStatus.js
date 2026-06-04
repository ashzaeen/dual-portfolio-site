"use client";

import { useEffect, useState } from "react";
import { pickSlot, fillStatus } from "./liveStatus";

// Given the hero `status` ({ text, generatedAt, schedule, tz }), returns the
// currently-active { text, slotKey, generatedAt }:
//   • text     — the active slot's sentence with [TIME] swapped for the live clock
//   • slotKey  — stable per slot, so the hero animates (scramble/fade) only when
//                the SLOT changes, not every minute when the clock ticks
//   • generatedAt — derived from how long the active slot has been live, so the
//                pro hero's "Updated X ago" resets near 0 right after a rotation
// Re-runs every 30s to advance the clock and roll over to the next slot.
// Initializes from the server-rendered text to avoid a hydration mismatch.
export function useActiveStatus(status) {
  const [active, setActive] = useState({
    text: status?.text ?? "",
    slotKey: "init",
    generatedAt: status?.generatedAt ?? null,
  });

  useEffect(() => {
    const slots = status?.schedule;
    const tz = status?.tz || "America/Chicago";

    const apply = () => {
      if (Array.isArray(slots) && slots.length > 0) {
        const s = pickSlot(slots, tz);
        if (!s) return;
        setActive({
          text: fillStatus(s.text, tz),
          slotKey: s.time,
          generatedAt: new Date(Date.now() - s.elapsedMin * 60000).toISOString(),
        });
      } else {
        // No batch (fallback / pre-first-run): a single static sentence.
        setActive({
          text: fillStatus(status?.text ?? "", tz),
          slotKey: "static",
          generatedAt: status?.generatedAt ?? null,
        });
      }
    };

    apply();
    const id = setInterval(apply, 30000);
    return () => clearInterval(id);
  }, [status]);

  return active;
}
