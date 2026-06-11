"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Pinboard.module.css";
import m from "./PinboardMobile.module.css";
import { StaticItem } from "./Items";
import { StringLights } from "./Decorations";
import { FLEX_ROWS, SPOS } from "@/data/pinboard";

// Mobile static-board preview. Renders the full curated set in the same
// FLEX_ROWS order and at the same sizing as before (dH × 0.8, or × 0.65 on
// narrow phones), inside the reused corkboard frame. The frame is already
// promoted to a single composited layer with its animated bits frozen on
// mobile (Pinboard.module.css ≤1100 rules), so this paints once and scrolls
// without jitter. Each item stays individually tappable (opens its modal via
// onAnyClick), exactly like the desktop board.
export default function PinboardBoardMobile({ itemsById, onAnyClick }) {
  const ref = useRef(null);
  // Measure our own width (SSR-safe replacement for the old window.innerWidth
  // check) to pick the row scale and the string-light span.
  const [cw, setCw] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => setCw(el.clientWidth);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sc = cw && cw < 500 ? 0.65 : 0.8;
  const lightsW = cw || 520;

  return (
    <div ref={ref} className={styles.boardFrame}>
      <div className={styles.nail} />
      <StringLights width={lightsW} />

      <div className={m.rows}>
        {FLEX_ROWS.map((row, ri) => (
          <div key={ri} className={m.row}>
            {row.map((id) => {
              const item = itemsById[id];
              if (!item) return null;
              return (
                <StaticItem
                  key={id}
                  item={{ ...item, dH: Math.round((item.dH || 220) * sc) }}
                  onAnyClick={onAnyClick}
                  rotation={SPOS[id]?.rot || 0}
                  style={{ transformOrigin: item.mount === "pin" ? "top center" : "center center" }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className={`${styles.nail} ${styles.nailBottom}`} />
    </div>
  );
}
