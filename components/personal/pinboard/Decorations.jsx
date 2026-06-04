"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Pinboard.module.css";
import { WALL_W, WALL_H } from "@/data/pinboard";

// ─── Pin / Tape primitives ───────────────────────────────────
export function Pin({ color = "#c4a050" }) {
  return (
    <div
      className={styles.pin}
      style={{
        background: `radial-gradient(circle at 33% 30%,#f5e070,${color} 42%,#7a5618 72%,#2e1606 100%)`,
      }}
    />
  );
}
export function Tape() {
  return <div className={styles.tape} />;
}

// ─── String lights running along the top edge of the wall ────
// One <svg> with N bulbs spaced ~82px apart; each bulb pulses on its
// own delay+duration so the whole strand twinkles asynchronously.
export function StringLights({ width = 3700 }) {
  const bulbs = useMemo(() => {
    const count = Math.floor(width / 82);
    return Array.from({ length: count }, (_, i) => ({
      x: 42 + i * 82 + Math.sin(i * 1.9) * 18,
      y: 30 + Math.sin(i * 0.55) * 11,
      col:
        i % 6 === 0 ? "#ff8840" :
        i % 4 === 0 ? "#ffcc44" :
        i % 3 === 0 ? "#ff5533" : "#ffe570",
      delay: (i * 0.17) % 2.5,
      dur: 1.7 + (i % 5) * 0.28,
    }));
  }, [width]);

  const wirePts = bulbs
    .map((b, i) => {
      const nx = i < bulbs.length - 1 ? bulbs[i + 1].x : width;
      const ny = i < bulbs.length - 1 ? bulbs[i + 1].y : 30;
      return `Q ${b.x + (nx - b.x) * 0.5},${Math.min(b.y, ny) - 8} ${nx},${ny}`;
    })
    .join(" ");

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height: 75,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "visible",
      }}
    >
      <path
        d={`M 0,22 Q 21,14 ${bulbs[0]?.x || 42},${bulbs[0]?.y || 30} ${wirePts}`}
        fill="none"
        stroke="rgba(90,55,15,.65)"
        strokeWidth="1.5"
      />
      {bulbs.map((b, i) => (
        <g key={i}>
          <line x1={b.x} y1={b.y - 5} x2={b.x} y2={b.y + 3} stroke="rgba(90,55,15,.55)" strokeWidth="1.5" />
          <ellipse
            cx={b.x}
            cy={b.y + 10}
            rx="4.5"
            ry="6.5"
            fill={b.col}
            style={{ animation: `pinboardGlow ${b.dur}s ease-in-out ${b.delay}s infinite` }}
          />
          <ellipse cx={b.x - 1.2} cy={b.y + 7.5} rx="1.4" ry="2" fill="rgba(255,255,255,.42)" />
        </g>
      ))}
    </svg>
  );
}

// ─── Hand-drawn red string between two photo pins ────────────
// Decorative: in the static board only (the immersive wall has more room).
export function StringConnection() {
  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 15,
        overflow: "visible",
      }}
    >
      <path
        d="M 209,590 C 360,542 484,548 635,604"
        fill="none"
        stroke="rgba(185,50,30,.65)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="209" cy="590" r="3.5" fill="rgba(196,160,80,.9)" />
      <circle cx="635" cy="604" r="3.5" fill="rgba(196,160,80,.9)" />
    </svg>
  );
}

// ─── Dust particles ──────────────────────────────────────────
// Drift slowly across the wall like sunlight catching dust. When the
// user is dragging an item (dragPos is non-null in wall-local coords)
// any particle within DRAG_R px gets a one-frame radial impulse
// pointing away from the drag point. Impulses decay back to baseline
// drift in a few frames.
//
// Performance: 55 particles, 1 canvas the full size of the wall (drawn
// only when in viewport via the overlay transform — browser handles
// composite). No React state churn in the loop.
export function DustParticles({ dragPos = null }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  // Keep ref in sync with prop so the rAF loop sees latest pos without re-binding.
  useEffect(() => {
    dragRef.current = dragPos;
  }, [dragPos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = WALL_W;
    const H = WALL_H;
    const DRAG_R = 90;
    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.06,
      vy: -(Math.random() * 0.04 + 0.01),
      bx: 0, by: 0, // base drift to ease back toward
      r: Math.random() * 1.2 + 0.4,
      op: Math.random() * 0.18 + 0.06,
    }));
    pts.forEach((p) => { p.bx = p.vx; p.by = p.vy; });
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const dp = dragRef.current;
      pts.forEach((p) => {
        if (dp) {
          const dx = p.x - dp.x;
          const dy = p.y - dp.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < DRAG_R * DRAG_R && d2 > 0.5) {
            const d = Math.sqrt(d2);
            const force = (1 - d / DRAG_R) * 1.4;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }
        // Spring vx/vy back toward the base drift values so puffs settle.
        p.vx += (p.bx - p.vx) * 0.04;
        p.vy += (p.by - p.vy) * 0.04;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,165,75,${p.op})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WALL_W}
      height={WALL_H}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 6,
      }}
    />
  );
}

// ─── Compass icon on the wall (click → opens modal) ──────────
// The actual spinning happens in CompassModal so the user can see the
// dial up close, read the instructions, and tap "spin" themselves.
// Wall version is just a stylized button.
export function Compass({ onClick }) {
  // Slow ambient breath on the needle so the parked compass still feels alive.
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return {
      x1: 50 + Math.cos(a) * 38,
      y1: 50 + Math.sin(a) * 38,
      x2: 50 + Math.cos(a) * 44,
      y2: 50 + Math.sin(a) * 44,
    };
  });

  return (
    <div
      className={styles.wallDeco}
      style={{ left: 970, top: 180, cursor: "pointer" }}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tape />
      <svg
        width="100"
        height="100"
        style={{ display: "block", borderRadius: "50%", boxShadow: "0 4px 18px rgba(0,0,0,.65)" }}
      >
        <circle cx="50" cy="50" r="49" fill="#1a1008" stroke="rgba(196,160,80,.5)" strokeWidth="1.5" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(196,160,80,.35)" strokeWidth="1.5" />
        ))}
        {[["N", 50, 16], ["S", 50, 90], ["W", 16, 54], ["E", 84, 54]].map(([l, x, y]) => (
          <text
            key={l}
            x={x}
            y={y}
            fill="rgba(196,160,80,.6)"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            {l}
          </text>
        ))}
        <g style={{ transformOrigin: "50px 50px" }}>
          <polygon points="50,14 47,50 50,54 53,50" fill="rgba(185,50,30,.85)" />
          <polygon points="50,86 47,50 50,46 53,50" fill="rgba(245,240,232,.3)" />
        </g>
        <circle cx="50" cy="50" r="3" fill="rgba(196,160,80,.8)" />
        <text x="50" y="108" fill="rgba(196,160,80,.35)" textAnchor="middle" fontSize="6.5" fontFamily="var(--font-mono)">
          FIND A MEMORY
        </text>
      </svg>
    </div>
  );
}

// ─── Dual clock — DFW (gold) + DHK (cream) on the same face ──
// Click opens a digital-LCD modal showing both timezones side by side.
export function DualClock({ onClick }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const anglesFor = (tzOff) => {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const loc = new Date(utcMs + tzOff * 3600000);
    const h = (loc.getHours() % 12) + loc.getMinutes() / 60;
    const m = loc.getMinutes() + loc.getSeconds() / 60;
    const s = loc.getSeconds();
    return { h: h * 30, m: m * 6, s: s * 6 };
  };
  const dfwA = anglesFor(-5); // Arlington
  const dhkA = anglesFor(6);  // Dhaka

  const hand = (a, len, sw, col) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return (
      <line
        x1="50"
        y1="50"
        x2={50 + Math.cos(rad) * len}
        y2={50 + Math.sin(rad) * len}
        stroke={col}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    );
  };
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return {
      x1: 50 + Math.cos(a) * 38,
      y1: 50 + Math.sin(a) * 38,
      x2: 50 + Math.cos(a) * 44,
      y2: 50 + Math.sin(a) * 44,
    };
  });
  return (
    <div
      className={styles.wallDeco}
      style={{ left: 180, top: 460, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Pin color="#c4a050" />
      <svg width="100" height="112" style={{ display: "block" }}>
        <circle cx="50" cy="50" r="48" fill="#160e06" stroke="rgba(196,160,80,.45)" strokeWidth="1.5" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(196,160,80,.32)" strokeWidth="1.5" />
        ))}
        {/* Dhaka hands — faint cream (the "other home") */}
        {hand(dhkA.h, 20, 2, "rgba(245,240,232,.45)")}
        {hand(dhkA.m, 28, 1.5, "rgba(245,240,232,.38)")}
        {/* Arlington hands — gold (the "here") */}
        {hand(dfwA.h, 22, 2.2, "#c4a050")}
        {hand(dfwA.m, 30, 1.8, "#c4a050")}
        {hand(dfwA.s, 33, 1, "rgba(196,160,80,.55)")}
        <circle cx="50" cy="50" r="2.2" fill="rgba(196,160,80,.8)" />
        <text x="50" y="106" fill="rgba(196,160,80,.35)" textAnchor="middle" fontSize="6.5" fontFamily="var(--font-mono)">
          DFW · DHK
        </text>
      </svg>
    </div>
  );
}

// ─── Easter egg — a gilded, faintly glowing egg tucked in the far corner.
// Big enough to read as "a discovery" once you pan over to it, small enough
// that you still have to go hunting. Glow + twinkle + bob reward the find.
export function EasterEgg({ onFind }) {
  return (
    <div
      className={`${styles.wallDeco} ${styles.eggHotspot}`}
      style={{ left: 3434, top: 2342, cursor: "pointer" }}
      onClick={onFind}
      onPointerDown={(e) => e.stopPropagation()}
      title="?"
      role="button"
      aria-label="A hidden easter egg"
    >
      <span className={styles.eggGlow} aria-hidden="true" />
      <svg width="34" height="42" viewBox="0 0 34 42" className={styles.eggSvg}>
        <defs>
          <radialGradient id="eggShell" cx="42%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#fff4d6" />
            <stop offset="46%" stopColor="#e6c266" />
            <stop offset="100%" stopColor="#a9842f" />
          </radialGradient>
        </defs>
        <path
          d="M17 1.5 C25.5 1.5 31 14 31 24 C31 34 25 40.5 17 40.5 C9 40.5 3 34 3 24 C3 14 8.5 1.5 17 1.5 Z"
          fill="url(#eggShell)"
          stroke="rgba(80,50,10,.55)"
          strokeWidth="1"
        />
        {/* filigree bands */}
        <path d="M4 20 Q17 26 30 20" fill="none" stroke="rgba(80,50,10,.42)" strokeWidth="1.1" />
        <path d="M5 27 Q17 33 29 27" fill="none" stroke="rgba(80,50,10,.32)" strokeWidth="1" />
        <g stroke="rgba(120,80,20,.42)" strokeWidth="0.9" fill="none">
          <path d="M11 9 l3 4 l-3 4 l-3 -4 z" />
          <path d="M22.5 12 l2.4 3.4 l-2.4 3.4 l-2.4 -3.4 z" />
        </g>
        {/* sheen */}
        <ellipse cx="13" cy="11" rx="3.6" ry="6" fill="rgba(255,255,255,.4)" transform="rotate(-18 13 11)" />
      </svg>
      <span className={styles.eggTwinkle} aria-hidden="true">✦</span>
    </div>
  );
}

// Marker left behind once the egg is found — a steady glowing medallion.
export function EasterEggFound() {
  return (
    <div className={`${styles.wallDeco} ${styles.eggFound}`} style={{ left: 3436, top: 2344 }} onPointerDown={(e) => e.stopPropagation()}>
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="11" fill="rgba(196,160,80,.2)" stroke="rgba(196,160,80,.6)" strokeWidth="1" />
        <text x="15" y="20" textAnchor="middle" fontSize="13" fill="rgba(245,225,170,.95)">✦</text>
      </svg>
    </div>
  );
}

// ─── Confetti — fires once on easter-egg find ────────────────
export function ConfettiOverlay({ onDone }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 62 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        dur: 0.8 + Math.random() * 0.6,
        color: ["#c4a050", "#f5e070", "#ff8844", "#5b7fa3", "#7a9e74", "#f0ece4"][i % 6],
        w: Math.random() * 10 + 5,
        h: Math.random() * 6 + 3,
        rot: Math.random() * 360,
      })),
    []
  );
  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-20px",
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: 2,
            animation: `pinboardConfetti ${p.dur}s ease-in ${p.delay}s both`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

