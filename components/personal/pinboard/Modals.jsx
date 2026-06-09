"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Pinboard.module.css";
import { PHOTOS_FOR_COMPASS } from "@/data/pinboard";
import WallRichText from "./WallRichText";
import { useScrollLock } from "@/lib/useScrollLock";
import { navSignal } from "@/lib/navSignal";

// Shared modal chrome: close on Escape + freeze background scroll while open.
// Returns a `close` function — use it for backdrop clicks and X buttons so the
// navbar turns transparent-off INSTANTLY on tap, not after the exit animation.
function useEscape(onClose) {
  useEffect(() => {
    navSignal.modalOpened();
    return () => navSignal.modalClosed(); // fallback if component unmounts unexpectedly
  }, []);

  // Fires the navbar signal immediately, then delegates to onClose.
  // Cleanup above may fire modalClosed() a second time on unmount — harmless.
  const close = useCallback(() => {
    navSignal.modalClosed();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [close]);

  useScrollLock();
  return close;
}

// ─── Photo modal ─────────────────────────────────────────────
// Large photo + label + story. The image is the hero — gets the
// majority of the vertical space (see .modalImg max-height in CSS).
export function PhotoModal({ item, onClose }) {
  const isAged = item.sub === "aged";
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.modalBg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className={styles.modalBox}
        initial={{ scale: 0.88, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.modalX} onClick={close} aria-label="Close">×</button>
        <img src={item.src} alt={item.label} className={`${styles.modalImg}${isAged ? " " + styles.agedModal : ""}`} />
        <div className={styles.modalTxt}>
          <div className={styles.modalLbl}>{item.label}</div>
          <p className={styles.modalStory}>{item.story}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Poster modal (cinema treatment) ─────────────────────────
export function PosterModal({ item, onClose }) {
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.cinemaBg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <div className={styles.cinemaGrain} />
      <button className={styles.cinemaX} onClick={close} aria-label="Close">×</button>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.06, type: "spring", stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, position: "relative", zIndex: 2, marginTop: "auto", marginBottom: "auto" }}
      >
        <img src={item.src} alt={item.label} className={styles.cinemaPoster} />
        <div className={styles.cinemaCard}>
          <div className={styles.cinemaLabel}>{item.label}</div>
          <div className={styles.cinemaPoem}>{item.poem}</div>
          <p className={styles.cinemaStory}>{item.story}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Trip modal (boarding pass → travel journal) ─────────────
// Optionally accepts an `image` prop. When set, the photo renders at
// the top of the journal page above the trip stamp — used by the hero
// polaroid click-through to give the modal a visual anchor in addition
// to the writing.
export function TripModal({ onClose, image, imageAlt = "", body }) {
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.tripBg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className={styles.tripJournal}
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.tripX} onClick={close} aria-label="Close">×</button>
        {image && (
          <img src={image} alt={imageAlt} draggable={false} className={styles.tripImage} />
        )}
        <div className={styles.tripStamp}>
          <div className={styles.tripStampDot} />VISITED<div className={styles.tripStampDot} />
        </div>
        <div className={styles.tripDate}>APRIL 23, 2026 · F9 1847 · DFW → MSY</div>
        <div className={styles.tripCity}>New Orleans</div>
        <div className={styles.tripSub}>CRA UR2PHD SHOWCASE · LOUISIANA</div>
        <div className={styles.tripRule} />
        <div className={styles.tripBody}>
          {body?.length ? (
            <WallRichText richText={body} paragraphs />
          ) : (
            <>
              <p>Got off the plane and the city hit first. That specific smell — jasmine and old wood and something frying somewhere in the distance. This is not a city that plays it cool.</p>
              <p>Presented the research at the CRA UR2PhD Showcase. Panel went well. Spent the rest of the conference trying to hold intelligent conversations while thinking about where to eat next.</p>
              <p>Walked the French Quarter at night. Café Du Monde at 2AM. Beignets and a café au lait while a trumpet player did something unreasonable on the corner.</p>
              <p>Three days. Went back to Dallas smelling like jazz and fried things. No complaints.</p>
            </>
          )}
        </div>
        <div className={styles.tripFooter}>
          <span>Seat 22B · Economy</span>
          <span>Gate B14 · Boards 15:30</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Subway modal — the receipt's "memory" side ──────────────
// Shows the exact order from the receipt with a hand-written note
// explaining how the user actually likes their sandwich. Edit the
// PLACEHOLDER lines below with real bread / cheese / veggies / sauces.
export function SubwayModal({ onClose, data }) {
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.subwayBg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className={styles.subwayCard}
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.subwayX} onClick={close} aria-label="Close">×</button>

        <div className={styles.subwayBrand}>
          <div className={styles.subwayBrandName}>SUBWAY®</div>
          <div className={styles.subwayBrandSub}>1234 University Dr · Arlington, TX</div>
        </div>

        <div className={styles.subwayDivider} />
        <div className={styles.subwayMeta}>04/23/2026 · #0847 · Reg 2</div>
        <div className={styles.subwayDivider} />

        <div className={styles.subwayOrder}>
          <div className={styles.subwayLine}><span>1 FT TUNA</span><span>$8.99</span></div>
          <div className={styles.subwayLine}><span>1 LRG TEA</span><span>$2.49</span></div>
        </div>

        <div className={styles.subwayDivider} />

        <div className={styles.subwayHowI}>— how I order it —</div>
        {/* Recipe + note come from the Curated DB (`subway` row): Caption →
            recipe (italic → green), Note → handwritten note. Falls back to
            the hardcoded copy below when the Notion fields are empty. */}
        <div className={styles.subwayDetail}>
          {data?.bodyRich?.length ? (
            <WallRichText richText={data.bodyRich} />
          ) : (
            <>
              <em>Footlong tuna</em>, Italian Herbs &amp; Cheese, toasted with provolone.
              Lettuce, spinach, tomatoes, cucumbers, olives, jalapeños. Mayo + chipotle southwest.
              Salt, pepper, a heavy pour of oregano.
            </>
          )}
        </div>

        <div className={styles.subwayNote}>
          {data?.noteRich?.length ? (
            <WallRichText richText={data.noteRich} />
          ) : (
            <>
              Same order, every time, since freshman year. The cashier at this location knows my face.
              It&apos;s the closest thing I have to a routine.
            </>
          )}
        </div>

        <div className={styles.subwayDivider} />
        <div className={styles.subwayTotal}><span>TOTAL</span><span>$12.43</span></div>
        <div className={styles.subwayDivider} />
        <div className={styles.subwayThanks}>THANK YOU · EAT FRESH ®</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Compass modal ───────────────────────────────────────────
// Click the wall compass → this opens. User reads the instruction,
// taps "spin", the dial spins for ~2.2s, then the modal closes and
// onSpin(item) is invoked with a random photo for the wall to pan to.
export function CompassModal({ onClose, onSpin }) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);

  // Manual lifecycle — spinning state blocks close, so we can't use useEscape directly.
  useEffect(() => {
    navSignal.modalOpened();
    return () => navSignal.modalClosed();
  }, []);
  useScrollLock();

  const close = useCallback(() => {
    if (spinning) return;
    navSignal.modalClosed();
    onClose();
  }, [spinning, onClose]);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [close]);

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return {
      x1: 120 + Math.cos(a) * 96,
      y1: 120 + Math.sin(a) * 96,
      x2: 120 + Math.cos(a) * 110,
      y2: 120 + Math.sin(a) * 110,
    };
  });

  const onSpinClick = () => {
    if (spinning) return;
    const extra = 1440 + Math.random() * 720;
    setAngle((a) => a + extra);
    setSpinning(true);
    // Pick the destination NOW so the random walk is committed when the
    // animation finishes (no "lying" about where the needle landed).
    const chosen = PHOTOS_FOR_COMPASS[Math.floor(Math.random() * PHOTOS_FOR_COMPASS.length)];
    setTimeout(() => {
      navSignal.modalClosed(); // signal immediately when spin completes
      onClose();
      onSpin(chosen);
    }, 2200);
  };

  return (
    <motion.div
      className={styles.compassBg}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        className={styles.compassCard}
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.compassX} onClick={close} aria-label="Close" disabled={spinning}>×</button>
        <div className={styles.compassEyebrow}>+ THE COMPASS</div>
        <div className={styles.compassTitle}>Spin to find a memory.</div>
        <p className={styles.compassInstruction}>
          Wherever the needle lands, that&apos;s the photo I&apos;ll show you.
          One spin per try — no take-backs.
        </p>

        <div className={styles.compassDial}>
          <svg width="240" height="240">
            <circle cx="120" cy="120" r="118" fill="#1a1008" stroke="rgba(196,160,80,.5)" strokeWidth="2" />
            <circle cx="120" cy="120" r="100" fill="none" stroke="rgba(196,160,80,.18)" strokeWidth="1" strokeDasharray="2 6" />
            {ticks.map((t, i) => (
              <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(196,160,80,.45)" strokeWidth={i % 3 === 0 ? 2.5 : 1.5} />
            ))}
            {[["N", 120, 32], ["S", 120, 214], ["W", 30, 124], ["E", 210, 124]].map(([l, x, y]) => (
              <text key={l} x={x} y={y} fill="rgba(196,160,80,.7)" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontFamily="var(--font-mono)" letterSpacing="2">
                {l}
              </text>
            ))}
            <g
              style={{
                transform: `rotate(${angle}deg)`,
                transformOrigin: "120px 120px",
                transition: spinning ? "transform 2.2s cubic-bezier(0.12,0.6,0.22,1)" : "none",
              }}
            >
              <polygon points="120,28 113,120 120,128 127,120" fill="rgba(185,50,30,.9)" />
              <polygon points="120,212 113,120 120,112 127,120" fill="rgba(245,240,232,.5)" />
            </g>
            <circle cx="120" cy="120" r="6" fill="rgba(196,160,80,.95)" />
            <circle cx="120" cy="120" r="2.2" fill="#0e0703" />
          </svg>
        </div>

        <button
          className={styles.compassSpinBtn}
          onClick={onSpinClick}
          disabled={spinning}
        >
          {spinning ? "spinning…" : "— spin the compass —"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Dual clock modal — 7-segment LCD readouts ───────────────
// Two amber LCD clocks side by side (DFW + DHK), styled like an 80s
// clock radio mounted in a dark wood frame. Updates once per second.

// Segment maps for 0-9. Letters a-g follow standard 7-segment naming.
const SEG_ON = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

function Digit({ char, w = 26, h = 48 }) {
  const lit = SEG_ON[char] || [];
  // Each segment is a stroke with rounded caps. Stroke width scales w/ size.
  const sw = Math.round(h * 0.08);
  const pad = sw / 2 + 1;
  const segs = {
    a: { x1: pad + 2, y1: pad,           x2: w - pad - 2, y2: pad },
    g: { x1: pad + 2, y1: h / 2,         x2: w - pad - 2, y2: h / 2 },
    d: { x1: pad + 2, y1: h - pad,       x2: w - pad - 2, y2: h - pad },
    f: { x1: pad,     y1: pad + 2,       x2: pad,         y2: h / 2 - 2 },
    b: { x1: w - pad, y1: pad + 2,       x2: w - pad,     y2: h / 2 - 2 },
    e: { x1: pad,     y1: h / 2 + 2,     x2: pad,         y2: h - pad - 2 },
    c: { x1: w - pad, y1: h / 2 + 2,     x2: w - pad,     y2: h - pad - 2 },
  };
  const on  = "#f5b540";
  const off = "rgba(245,181,64,0.07)";
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {Object.entries(segs).map(([k, s]) => {
        const isOn = lit.includes(k);
        return (
          <line
            key={k}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={isOn ? on : off}
            strokeWidth={sw}
            strokeLinecap="round"
            style={isOn ? { filter: "drop-shadow(0 0 3px rgba(255,180,60,0.7))" } : undefined}
          />
        );
      })}
    </svg>
  );
}

function LCDClock({ city, sub, tzOffset }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const loc = new Date(utcMs + tzOffset * 3600000);
  const hh = String(loc.getHours() % 12 === 0 ? 12 : loc.getHours() % 12).padStart(2, "0");
  const mm = String(loc.getMinutes()).padStart(2, "0");
  const ss = String(loc.getSeconds()).padStart(2, "0");
  const meridian = loc.getHours() >= 12 ? "P.M." : "A.M.";
  const day = loc.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();

  return (
    <div className={styles.lcdClock}>
      <div className={styles.lcdLabel}>
        <div className={styles.lcdCity}>{city}</div>
        <div className={styles.lcdSub}>{sub}</div>
      </div>
      <div className={styles.lcdScreen}>
        <div className={styles.lcdScan} />
        <div className={styles.lcdDigits}>
          <Digit char={hh[0]} />
          <Digit char={hh[1]} />
          <span className={`${styles.lcdColon}${ss % 2 === 0 ? "" : " " + styles.lcdColonDim}`}>:</span>
          <Digit char={mm[0]} />
          <Digit char={mm[1]} />
          <span className={`${styles.lcdColon}${ss % 2 === 0 ? "" : " " + styles.lcdColonDim}`}>:</span>
          <Digit char={ss[0]} />
          <Digit char={ss[1]} />
        </div>
        <div className={styles.lcdMeta}>
          <span>{meridian}</span>
          <span>{day}</span>
        </div>
      </div>
    </div>
  );
}

export function DualClockModal({ onClose }) {
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.clockBg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className={styles.clockCard}
        initial={{ scale: 0.92, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.clockX} onClick={close} aria-label="Close">×</button>
        <div className={styles.clockEyebrow}>+ DUAL TIMEZONE</div>
        <div className={styles.clockTitle}>Two homes, one wall.</div>
        <div className={styles.clockGrid}>
          <LCDClock city="ARLINGTON" sub="CST · UTC−5" tzOffset={-5} />
          <LCDClock city="DHAKA"     sub="BST · UTC+6" tzOffset={6}  />
        </div>
        <div className={styles.clockFoot}>+11 hours apart · always on, simultaneously</div>
      </motion.div>
    </motion.div>
  );
}

// ─── Easter-egg found modal ──────────────────────────────────
export function EggFoundModal({ onClose }) {
  const close = useEscape(onClose);
  return (
    <motion.div className={styles.eggModal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        className={styles.eggCard}
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.eggIcon}>✦</div>
        <div className={styles.eggTitle}>You found the egg.</div>
        <div className={styles.eggMsg}>
          You actually explored the whole wall — every photo, every far corner.
          Thanks for staying a while.
        </div>
        <div className={styles.eggHint}>
          <span className={styles.eggHintLabel}>One more thing</span>
          There&apos;s another little something hidden back at the writing desk.
          Go poke around the lamp, the tea, the polaroids…
        </div>
        <div className={styles.eggSig}>— A</div>
        <button onClick={close} className={styles.eggClose}>close</button>
      </motion.div>
    </motion.div>
  );
}
