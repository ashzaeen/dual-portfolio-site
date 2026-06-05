"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/lib/useScrollLock";
import Postcard from "./Postcard";
import styles from "./AllStopsBook.module.css";

const TAPE_COLORS = [
  "rgba(196,160,80,0.40)",
  "rgba(130,175,130,0.36)",
  "rgba(185,125,95,0.34)",
  "rgba(95,145,185,0.30)",
  "rgba(175,155,95,0.36)",
  "rgba(160,100,130,0.32)",
  "rgba(100,165,160,0.30)",
];

const TAPE_ANGLES = [-1.8, 1.3, -0.9, 2.0, -1.4, 0.7, -2.1, 1.6, -0.6, 1.9];

const ROTATIONS = [-2.8, 1.4, -1.1, 2.2, -0.8, 1.9, -2.2, 0.7, -1.5, 2.5];

// Earliest 4-digit year across all postcard locations. Year fields are
// free-form ("2024 –", "Apr 2026", "Roots", "2025"); we scan for any 4-digit
// year and take the minimum, ignoring entries without one. Drives the spine
// label so it tracks the postcards automatically.
function earliestYear(locations) {
  let min = null;
  for (const loc of locations) {
    const matches = String(loc.year ?? "").match(/\d{4}/g);
    if (!matches) continue;
    for (const y of matches) {
      const n = parseInt(y, 10);
      if (n >= 1900 && n <= 2100 && (min === null || n < min)) min = n;
    }
  }
  return min;
}

function groupLocations(locations) {
  const map = new Map();
  for (const loc of locations) {
    const group = loc.regionGroup ?? "Other";
    if (!map.has(group)) {
      map.set(group, {
        regionGroup: group,
        regionOrder: loc.regionOrder ?? 99,
        regionFlag: loc.regionFlag ?? "🌍",
        locations: [],
      });
    }
    map.get(group).locations.push(loc);
  }
  return [...map.values()].sort((a, b) => a.regionOrder - b.regionOrder);
}

export default function AllStopsBook({
  open,
  onClose,
  locations = [],
  locationStories = {},
  onViewStory,
  ignoreEsc = false,
}) {
  useEffect(() => {
    if (!open || ignoreEsc) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, ignoreEsc, onClose]);

  useScrollLock(open);

  // Field Journal flips the natural ascending Order so the most recent
  // (higher Order) postcards land at the top of each region group.
  const groups = groupLocations([...locations].reverse());
  const startYear = earliestYear(locations);
  let cardIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Field Journal — All Stops"
        >
          <motion.div
            className={styles.book}
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.9 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Leather spine ── */}
            <div className={styles.spine}>
              <div className={styles.spineOrn}>✦</div>
              <div className={styles.spineTitle}>Field Journal</div>
              <div className={styles.spineRule} />
              <div className={styles.spineYear}>
                {startYear ? `${startYear} — Present` : "Present"}
              </div>
              <div className={styles.spineOrn}>✦</div>
            </div>

            {/* ── Parchment page ── */}
            <div className={styles.page}>
              <div className={styles.pageHeader}>
                <div className={styles.pageHeaderLabel}>— Ashzaeen&apos;s —</div>
                <div className={styles.pageTitle}>All Stops</div>
                <div className={styles.pageRule} />
                <div className={styles.pageSubtitle}>
                  A record of every place visited, from economy class.
                </div>
              </div>

              {groups.map((group) => (
                <div key={group.regionGroup} className={styles.regionGroup}>
                  <div className={styles.regionDivider}>
                    <span className={styles.regionFlag}>{group.regionFlag}</span>
                    <span className={styles.regionName}>{group.regionGroup}</span>
                    <div className={styles.regionLine} />
                    <span className={styles.regionCount}>
                      {group.locations.length}{" "}
                      {group.locations.length === 1 ? "stop" : "stops"}
                    </span>
                  </div>

                  <div className={styles.cardGrid}>
                    {group.locations.map((loc) => {
                      const idx = cardIdx++;
                      return (
                        <div key={loc.id} className={styles.cardWrap}>
                          <div
                            className={styles.tape}
                            style={{
                              background: TAPE_COLORS[idx % TAPE_COLORS.length],
                              transform: `translateX(-50%) rotate(${TAPE_ANGLES[idx % TAPE_ANGLES.length]}deg)`,
                            }}
                          />
                          <Postcard
                            loc={loc}
                            storySlugs={locationStories[loc.id] ?? []}
                            rotation={ROTATIONS[idx % ROTATIONS.length]}
                            onViewStory={onViewStory}
                            style={{ width: "100%" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className={styles.pageFooter}>
                <div className={styles.pageFooterRule} />
                <span className={styles.pageFooterText}>
                  Field Journal · Personal Record
                </span>
              </div>
            </div>

            {/* ── Wax-seal close button ── */}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close journal"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
