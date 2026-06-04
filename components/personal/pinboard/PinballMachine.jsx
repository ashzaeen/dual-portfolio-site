"use client";

import { useEffect, useRef } from "react";
import styles from "./Pinboard.module.css";

// Tiny playable pinball wedged into the wall.
//   Z          → left flipper
//   / or →     → right flipper
//   on-screen buttons also work (mobile)
//
// Bumpers are photo-themed: each one is a circular clip of a wall photo,
// with a gold ring that flashes when the ball strikes it.
//
// Mounted lazily by ImmersiveWall (skip on tiny screens to save battery).

const BUMPER_IMGS = [
  "/pinboard-photos/posters/yjhd-poster.png", // top center bumper
  "/pinboard-photos/family.png",              // bottom-left bumper
  "/pinboard-photos/us-friends-boys-suit.png",// bottom-right bumper
];

// Game / physics constants live at module scope so the useEffect
// dependency-array linter doesn't flag them as missing deps.
const BALL_R = 6;
const LW = 10;
const RW = 210;
const TW = 42;
const W = 220;
const H = 305;
const GRAVITY = 0.22;
const WALL_BOUNCE_X = 0.84;
const WALL_BOUNCE_Y = 0.80;
const BUMPER_KICK = 1.22;
const FLIPPER_HIT_VY = -8.4;
const MAX_SPEED = 10.5;
const FLIP_SMOOTH = 0.32;

export function PinballMachine() {
  const canvasRef = useRef(null);
  // Game state in a ref so the rAF loop reads/writes mutable values
  // without forcing React re-renders. Tuned physics constants for a
  // SMOOTHER feel than the original (softer reflections, gentler
  // gravity, interpolated flipper angles, ball motion trail).
  const G = useRef({
    ball: { x: 110, y: 65, vx: 0.8, vy: 0 },
    trail: [],            // last N positions for motion blur
    lUp: false,
    rUp: false,
    // smoothed flipper angles, lerped each frame toward target
    lFlipA: 12,
    rFlipA: -168,
    score: 0,
    lives: 3,
    bumpers: [
      { x: 110, y: 100, r: 16, fl: 0 },
      { x: 70,  y: 158, r: 14, fl: 0 },
      { x: 150, y: 152, r: 14, fl: 0 },
    ],
    imgs: [],
    raf: null,
    lastT: 0,
  });
  const getFlipper = (side, lFlipA, rFlipA) => {
    if (side === "l") {
      const a = (lFlipA * Math.PI) / 180;
      return { x1: 50, y1: 268, x2: 50 + Math.cos(a) * 55, y2: 268 + Math.sin(a) * 55 };
    }
    const a = (rFlipA * Math.PI) / 180;
    return { x1: 170, y1: 268, x2: 170 + Math.cos(a) * 55, y2: 268 + Math.sin(a) * 55 };
  };

  const distSeg = (px, py, { x1, y1, x2, y2 }) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    const cx = x1 + t * dx,
      cy = y1 + t * dy;
    return { dist: Math.sqrt((px - cx) ** 2 + (py - cy) ** 2), cx, cy };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const g = G.current;

    // HiDPI canvas — sharper on retina/scaled displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Preload the 3 bumper photos so we can drawImage them once ready.
    g.imgs = BUMPER_IMGS.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    const drawPhotoBumper = (bmp, img) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(bmp.x, bmp.y, bmp.r - 2, 0, Math.PI * 2);
      ctx.clip();
      if (img.complete && img.naturalWidth > 0) {
        const size = (bmp.r - 2) * 2;
        const ratio = Math.max(size / img.naturalWidth, size / img.naturalHeight);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;
        ctx.drawImage(img, bmp.x - w / 2, bmp.y - h / 2, w, h);
      } else {
        ctx.fillStyle = "rgba(30,18,8,1)";
        ctx.fillRect(bmp.x - bmp.r, bmp.y - bmp.r, bmp.r * 2, bmp.r * 2);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(bmp.x, bmp.y, bmp.r, 0, Math.PI * 2);
      ctx.strokeStyle = bmp.fl > 0 ? "#ffe070" : "rgba(196,160,80,.6)";
      ctx.lineWidth = bmp.fl > 0 ? 2.2 : 1.5;
      ctx.stroke();
      if (bmp.fl > 0) {
        ctx.beginPath();
        ctx.arc(bmp.x, bmp.y, bmp.r + 3 + (14 - bmp.fl) * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,224,112,${(bmp.fl / 14) * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    g.lastT = performance.now();
    const loop = (now) => {
      // Delta-time stepping so visuals stay smooth even if the rAF
      // tick is irregular. Clamp to 2x normal frame to avoid huge jumps
      // when tab regains focus.
      const dt = Math.min((now - g.lastT) / 16.6667, 2);
      g.lastT = now;

      // ── PHYSICS ──
      const b = g.ball;
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Smooth flipper angle toward target (eases the snap)
      const lTarget = g.lUp ? -45 : 12;
      const rTarget = g.rUp ? -135 : -168;
      g.lFlipA += (lTarget - g.lFlipA) * FLIP_SMOOTH * dt;
      g.rFlipA += (rTarget - g.rFlipA) * FLIP_SMOOTH * dt;

      // Walls
      if (b.x - BALL_R < LW) { b.x = LW + BALL_R; b.vx = Math.abs(b.vx) * WALL_BOUNCE_X; }
      if (b.x + BALL_R > RW) { b.x = RW - BALL_R; b.vx = -Math.abs(b.vx) * WALL_BOUNCE_X; }
      if (b.y - BALL_R < TW) { b.y = TW + BALL_R; b.vy = Math.abs(b.vy) * WALL_BOUNCE_Y; }
      if (b.y > 310) {
        g.lives = Math.max(0, g.lives - 1);
        b.x = 110; b.y = 65; b.vx = (Math.random() - 0.5) * 1.6; b.vy = 0;
        g.trail.length = 0;
        if (!g.lives) { g.score = 0; g.lives = 3; }
      }

      // Bumpers
      g.bumpers.forEach((bmp) => {
        const dx = b.x - bmp.x, dy = b.y - bmp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_R + bmp.r) {
          const nx = dx / dist, ny = dy / dist;
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * BUMPER_KICK;
          b.vy = (b.vy - 2 * dot * ny) * BUMPER_KICK;
          b.x = bmp.x + nx * (BALL_R + bmp.r + 1);
          b.y = bmp.y + ny * (BALL_R + bmp.r + 1);
          bmp.fl = 14;
          g.score += 100;
        }
        if (bmp.fl > 0) bmp.fl -= dt;
      });

      // Flippers
      ["l", "r"].forEach((side) => {
        const seg = getFlipper(side, g.lFlipA, g.rFlipA);
        const { dist, cx, cy } = distSeg(b.x, b.y, seg);
        if (dist < BALL_R + 3) {
          const nx = (b.x - cx) / Math.max(dist, 0.1);
          const ny = (b.y - cy) / Math.max(dist, 0.1);
          b.x = cx + nx * (BALL_R + 4);
          b.y = cy + ny * (BALL_R + 4);
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          const isUp = side === "l" ? g.lUp : g.rUp;
          if (isUp && ny < 0) b.vy = Math.min(b.vy, FLIPPER_HIT_VY);
        }
      });

      // Cap speed (soft taper just under cap so it doesn't snap)
      const spd = Math.sqrt(b.vx ** 2 + b.vy ** 2);
      if (spd > MAX_SPEED) {
        const k = MAX_SPEED / spd;
        b.vx *= k;
        b.vy *= k;
      }

      // Update trail (keep last 5 positions when ball is moving)
      if (spd > 1.5) {
        g.trail.push({ x: b.x, y: b.y });
        if (g.trail.length > 5) g.trail.shift();
      } else if (g.trail.length) {
        g.trail.shift();
      }

      // ── DRAW ──
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0d0806";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0a0503";
      ctx.fillRect(0, 0, W, TW - 2);

      ctx.fillStyle = "rgba(196,160,80,.78)";
      ctx.font = "bold 12px ui-monospace, 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(g.score, W / 2, 18);
      ctx.fillStyle = "rgba(196,160,80,.45)";
      ctx.font = "9px serif";
      ctx.fillText("★".repeat(g.lives) + "☆".repeat(3 - g.lives), W / 2, 34);

      g.bumpers.forEach((bmp, i) => drawPhotoBumper(bmp, g.imgs[i]));

      // Walls
      ctx.strokeStyle = "rgba(196,160,80,.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(LW, TW); ctx.lineTo(LW, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(RW, TW); ctx.lineTo(RW, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(LW, TW); ctx.lineTo(RW, TW); ctx.stroke();
      // Inlanes
      ctx.strokeStyle = "rgba(196,160,80,.22)";
      ctx.beginPath(); ctx.moveTo(LW, H - 55); ctx.lineTo(38, H - 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(RW, H - 55); ctx.lineTo(RW - 28, H - 18); ctx.stroke();

      // Flippers (smoothed)
      ["l", "r"].forEach((side) => {
        const seg = getFlipper(side, g.lFlipA, g.rFlipA);
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.strokeStyle = "rgba(196,160,80,.88)";
        ctx.lineWidth = 5.2;
        ctx.lineCap = "round";
        ctx.stroke();
        // tiny pivot stud
        ctx.beginPath();
        ctx.arc(seg.x1, seg.y1, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(196,160,80,.55)";
        ctx.fill();
      });

      // Ball motion trail (faded blobs behind ball)
      g.trail.forEach((p, i) => {
        const alpha = ((i + 1) / g.trail.length) * 0.22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL_R * (0.55 + (i / g.trail.length) * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,232,212,${alpha})`;
        ctx.fill();
      });

      // Ball — soft inner highlight gives the metal a roundness, makes
      // sub-pixel motion read as motion rather than jitter.
      const grad = ctx.createRadialGradient(b.x - 1.6, b.y - 2, 0.5, b.x, b.y, BALL_R);
      grad.addColorStop(0, "rgba(255,250,235,1)");
      grad.addColorStop(0.55, "rgba(232,222,200,1)");
      grad.addColorStop(1, "rgba(170,158,135,1)");
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(60,40,18,.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      g.raf = requestAnimationFrame(loop);
    };
    g.raf = requestAnimationFrame(loop);

    const kd = (e) => {
      if (e.key === "z" || e.key === "Z") g.lUp = true;
      if (e.key === "/" || e.key === "ArrowRight") { e.preventDefault(); g.rUp = true; }
    };
    const ku = (e) => {
      if (e.key === "z" || e.key === "Z") g.lUp = false;
      if (e.key === "/" || e.key === "ArrowRight") g.rUp = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      cancelAnimationFrame(g.raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  return (
    <div
      className={styles.wallDeco}
      style={{
        left: 1000,
        top: 290,
        background: "#0a0503",
        border: "2px solid rgba(196,160,80,.38)",
        borderRadius: "4px 4px 8px 8px",
        overflow: "hidden",
        boxShadow: "0 8px 28px rgba(0,0,0,.7)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          textAlign: "center",
          padding: "6px 0 4px",
          fontFamily: "var(--font-mono)",
          fontSize: 7.5,
          letterSpacing: ".2em",
          color: "rgba(196,160,80,.6)",
          textTransform: "uppercase",
          borderBottom: "1px solid rgba(196,160,80,.12)",
          background: "#080402",
        }}
      >
        ✦ PINBALL ✦
      </div>
      <canvas ref={canvasRef} width={220} height={305} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "6px 10px 8px",
          background: "#080402",
          borderTop: "1px solid rgba(196,160,80,.12)",
          gap: 8,
        }}
      >
        <button
          onPointerDown={(e) => { e.stopPropagation(); G.current.lUp = true; }}
          onPointerUp={() => (G.current.lUp = false)}
          style={{
            padding: "5px 12px",
            background: "rgba(196,160,80,.12)",
            border: "1px solid rgba(196,160,80,.28)",
            color: "rgba(196,160,80,.7)",
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            borderRadius: 2,
            cursor: "pointer",
            flex: 1,
          }}
        >
          Z ←
        </button>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 6.5,
            color: "rgba(196,160,80,.22)",
            alignSelf: "center",
            textAlign: "center",
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          z · /
        </div>
        <button
          onPointerDown={(e) => { e.stopPropagation(); G.current.rUp = true; }}
          onPointerUp={() => (G.current.rUp = false)}
          style={{
            padding: "5px 12px",
            background: "rgba(196,160,80,.12)",
            border: "1px solid rgba(196,160,80,.28)",
            color: "rgba(196,160,80,.7)",
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            borderRadius: 2,
            cursor: "pointer",
            flex: 1,
          }}
        >
          → /
        </button>
      </div>
    </div>
  );
}
