"use client";

import { useEffect, useState } from "react";
import { pickSlot } from "./liveStatus";

// Given the hero `status` ({ text, generatedAt, schedule, tz }), returns the
// currently-active { text, generatedAt }, re-selecting as slot times arrive.
// `generatedAt` is derived from how long the active slot has been live, so the
// pro hero's "Updated X ago" label resets near 0 right after each rotation.
// Initializes from the server-rendered text to avoid a hydration mismatch.
export function useActiveStatus(status) {
  const [active, setActive] = useState({
    text: status?.text ?? "",
    generatedAt: status?.generatedAt ?? null,
  });

  useEffect(() => {
    const slots = status?.schedule;
    const tz = status?.tz;
    if (!Array.isArray(slots) || slots.length === 0 || !tz) {
      setActive({ text: status?.text ?? "", generatedAt: status?.generatedAt ?? null });
      return;
    }
    const apply = () => {
      const s = pickSlot(slots, tz);
      if (!s) return;
      setActive({
        text: s.text,
        generatedAt: new Date(Date.now() - s.elapsedMin * 60000).toISOString(),
      });
    };
    apply();
    const id = setInterval(apply, 30000);
    return () => clearInterval(id);
  }, [status]);

  return active;
}
