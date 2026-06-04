"use client";

import { useEffect } from "react";
import { analytics } from "@/lib/analytics";

// Section anchor ids per side (mirror the Navbar link sets). The hero has no
// id, so it's tracked implicitly as "time before the first section".
const SECTION_IDS = {
  personal: ["travel", "writing", "music", "series", "gallery"],
  professional: ["stack", "projects", "experience", "credentials"],
};

const SCROLL_MILESTONES = [25, 50, 75, 100];

// One tracker mounted per landing. Answers the "how long do people hang
// around X" question generically, without instrumenting every section:
//   • section_dwell — accumulated time each section was ≥50% in view, flushed
//     when it leaves the viewport / the page is hidden / on unmount.
//   • scroll_depth  — 25/50/75/100% milestones, each fired once.
export default function EngagementTracker({ side }) {
  useEffect(() => {
    const ids = SECTION_IDS[side] ?? [];
    const els = ids
      .map((id) => ({ id, el: document.getElementById(id) }))
      .filter((x) => x.el);

    // Per-section dwell accounting. `enteredAt` is non-null while the section
    // is currently considered "in view".
    const state = new Map(
      els.map(({ id }) => [id, { total: 0, enteredAt: null }])
    );

    const flush = (id) => {
      const s = state.get(id);
      if (!s || s.enteredAt == null) return;
      s.total += performance.now() - s.enteredAt;
      s.enteredAt = null;
    };

    // Deepest scroll % reached so far — attached to each section_dwell so we
    // know how far a lingering visitor actually got. Declared before the
    // observer because its callback closes over it.
    let maxDepth = 0;
    const fired = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          const s = state.get(id);
          if (!s) continue;
          if (entry.isIntersecting && s.enteredAt == null) {
            s.enteredAt = performance.now();
          } else if (!entry.isIntersecting && s.enteredAt != null) {
            s.total += performance.now() - s.enteredAt;
            s.enteredAt = null;
            // Emit incrementally as the section leaves view, so we capture
            // engagement even for visitors who never trigger unmount.
            if (s.total >= 1000) {
              analytics.sectionDwell(id, side, Math.round(s.total), maxDepth);
              s.total = 0;
            }
          }
        }
      },
      { threshold: [0, 0.5] }
    );
    els.forEach(({ el }) => observer.observe(el));

    // ── Scroll depth ──
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      if (pct > maxDepth) maxDepth = pct;
      for (const m of SCROLL_MILESTONES) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m);
          analytics.scrollDepth(side, m);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Flush any in-progress dwell when the tab is hidden (PostHog flushes
    // queued events on pagehide, so this captures last-section time too).
    const onHide = () => {
      for (const { id } of els) {
        const s = state.get(id);
        if (!s || s.enteredAt == null) continue;
        flush(id);
        if (s.total >= 1000) {
          analytics.sectionDwell(id, side, Math.round(s.total), maxDepth);
          s.total = 0;
        }
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      onHide(); // unmount (e.g. side switch) flushes remaining dwell
    };
  }, [side]);

  return null;
}
