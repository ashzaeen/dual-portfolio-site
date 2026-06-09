"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Pinboard.module.css";
import { WALL_W, WALL_H, INTERACTIVE_BOXES } from "@/data/pinboard";
import { WallItem } from "./Items";
import {
  StringLights, Compass, DualClock,
  EasterEgg, EasterEggFound, ConfettiOverlay,
} from "./Decorations";
import { PinballMachine } from "./PinballMachine";
import { TicTacToe } from "./TicTacToe";
import { EggFoundModal, CompassModal, DualClockModal } from "./Modals";
import { useSoundFX } from "./useSoundFX";
import { PinboardEditorProvider, useEditor, EditorGrid, EditorPanel } from "./PinboardEditor";
import { analytics } from "@/lib/analytics";

const MAX_SCALE = 2.4;

// YJHD poster center in wall coords (wx=300, wy=175, dW≈344, dH≈515 at 1.12× scale)
const YJHD_CX = 300 + 172; // 472
const YJHD_CY = 175 + 257; // 432

function ToyTracker({ kind, children }) {
  const fired = useRef(false);
  return (
    <span
      style={{ display: "contents" }}
      onPointerDownCapture={() => {
        if (fired.current) return;
        fired.current = true;
        analytics.wallToyUsed(kind);
      }}
    >
      {children}
    </span>
  );
}

// Minimap: writes viewport indicator directly to DOM via ref — zero React
// state updates during pan (the previous setVp approach triggered React
// reconciliation 60×/sec and competed with applyTransform on the main thread).
function Minimap({ posRef, scaleRef, vwRef, vhRef, items }) {
  const MW = 156, MH = 106;
  const vpRef  = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const sx = MW / WALL_W, sy = MH / WALL_H;
    const tick = () => {
      const px = posRef.current.x;
      const py = posRef.current.y;
      const s  = scaleRef.current;
      const vpW = Math.min(MW, (vwRef.current / s) * sx);
      const vpH = Math.min(MH, (vhRef.current / s) * sy);
      const vpX = Math.max(0, Math.min(MW - vpW, (-px / s) * sx));
      const vpY = Math.max(0, Math.min(MH - vpH, (-py / s) * sy));
      if (vpRef.current) {
        const st = vpRef.current.style;
        st.left   = `${vpX}px`;
        st.top    = `${vpY}px`;
        st.width  = `${vpW}px`;
        st.height = `${vpH}px`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [posRef, scaleRef, vwRef, vhRef]);

  const sx = MW / WALL_W, sy = MH / WALL_H;
  return (
    <div className={styles.minimap}>
      {items.filter((i) => i.wx != null).map((i) => (
        <div key={i.id} className={styles.mmDot} style={{ left: i.wx * sx, top: i.wy * sy }} />
      ))}
      {INTERACTIVE_BOXES.map((b) => (
        <div
          key={b.id}
          className={b.kind === "egg" ? styles.mmEgg : styles.mmInteractive}
          style={{ left: (b.x + b.w / 2) * sx, top: (b.y + b.h / 2) * sy }}
          title={b.id}
        />
      ))}
      <div ref={vpRef} className={styles.mmVp} />
    </div>
  );
}

export function ImmersiveWall(props) {
  return (
    <PinboardEditorProvider>
      <ImmersiveWallInner {...props} />
    </PinboardEditorProvider>
  );
}

function ImmersiveWallInner({ items, onClose, onAnyClick, onDynamicImageError, photosExpired }) {
  const editor = useEditor();
  const editMode = !!editor?.enabled;
  const decoClick = (cb) => (editMode ? undefined : () => {
    if (!pan.current.moved) cb();
  });

  const wrapRef = useRef(null);
  const wallRef = useRef(null); // direct DOM ref for hot-path transform
  const vsRef   = useRef({ w: 1200, h: 800 });
  const vwRef   = useRef(1200); // mirrors vsRef.w — passed to Minimap as a stable ref
  const vhRef   = useRef(800);

  // pan holds ALL gesture state. posRef mirrors it for the Minimap rAF loop
  // and for any code that needs sync reads (no React state on the hot path).
  const posRef = useRef({ x: 0, y: 0 });
  const pan = useRef({
    on: false, sx: 0, sy: 0, ox: 0, oy: 0,
    // Rolling velocity: keep last N samples so fling direction is smooth
    velBuf: [], velIdx: 0, VEL_N: 4,
    lx: 0, ly: 0, raf: null, panRaf: null,
    moved: false, startX: 0, startY: 0,
  });

  // React state is only used for things that MUST drive a React render:
  // scale (wall children depend on knowing the current zoom),
  // and modal/overlay flags. Position is managed via direct DOM writes.
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  // grabbing cursor is toggled via direct classList — no React state needed.
  const [dragging, setDragging] = useState(null);
  const [eggFound, setEggFound] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const sfx = useSoundFX();

  // Write transform directly to the DOM — called on every pointer move and
  // fling frame. Never triggers a React re-render, which eliminates scroll jitter.
  const applyTransform = useCallback((x, y, s) => {
    pan.current.ox = x;
    pan.current.oy = y;
    posRef.current = { x, y };
    if (wallRef.current) {
      wallRef.current.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`;
    }
  }, []);

  const minScale = useCallback(() => {
    const base = Math.max(vsRef.current.w / WALL_W, vsRef.current.h / WALL_H);
    return vsRef.current.w <= 768 ? Math.max(base, 0.38) : base;
  }, []);

  const clamp = useCallback((x, y, s = scaleRef.current) => ({
    x: Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), x)),
    y: Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), y)),
  }), []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let firstRun = true;
    const upd = () => {
      vsRef.current = { w: el.clientWidth, h: el.clientHeight };
      vwRef.current = el.clientWidth;
      vhRef.current = el.clientHeight;
      const ms = Math.max(vsRef.current.w / WALL_W, vsRef.current.h / WALL_H);
      let s = scaleRef.current;

      if (firstRun) {
        firstRun = false;
        if (el.clientWidth <= 768) {
          // Mobile: open at 0.75 scale with YJHD poster visible in upper-left.
          // 0.45×vw places the poster's horizontal center in the left quadrant,
          // matching the reference screenshot where YJHD is fully visible and
          // ZNMD peeks in from the right edge.
          s = Math.max(ms, 0.75);
          scaleRef.current = s;
          setScale(s);
          const targetOx = vsRef.current.w * 0.45 - YJHD_CX * s;
          const targetOy = 0;
          const nx = Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), targetOx));
          const ny = Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), targetOy));
          applyTransform(nx, ny, s);
          return;
        }
      }

      if (s < ms) s = ms;
      scaleRef.current = s;
      setScale(s);
      const nx = Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), pan.current.ox));
      const ny = Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), pan.current.oy));
      applyTransform(nx, ny, s);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [applyTransform]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const zoomToScale = useCallback((targetS, clientX, clientY) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const p = pan.current;
    const oldS = scaleRef.current;
    const newS = Math.min(MAX_SCALE, Math.max(minScale(), targetS));
    if (Math.abs(newS - oldS) < 0.0001) return;
    const wx = (cx - p.ox) / oldS;
    const wy = (cy - p.oy) / oldS;
    const c = clamp(cx - wx * newS, cy - wy * newS, newS);
    scaleRef.current = newS;
    setScale(newS);
    applyTransform(c.x, c.y, newS);
  }, [clamp, minScale, applyTransform]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (editMode) return;
      if (e.ctrlKey) {
        zoomToScale(scaleRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
        return;
      }
      const horizontal = Math.abs(e.deltaX) > 0;
      const fractional = !Number.isInteger(e.deltaY);
      const small = Math.abs(e.deltaY) < 50;
      if (horizontal || fractional || small) {
        const p = pan.current;
        const { x, y } = clamp(p.ox - e.deltaX, p.oy - e.deltaY);
        applyTransform(x, y, scaleRef.current);
      } else {
        zoomToScale(scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editMode, clamp, zoomToScale, applyTransform]);

  const animatePanTo = useCallback((tx, ty) => {
    const { x: cx, y: cy } = clamp(tx, ty);
    const sx = pan.current.ox, sy = pan.current.oy;
    const start = performance.now();
    const go = (now) => {
      const t = Math.min((now - start) / 1200, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const nx = sx + (cx - sx) * e;
      const ny = sy + (cy - sy) * e;
      applyTransform(nx, ny, scaleRef.current);
      if (t < 1) pan.current.panRaf = requestAnimationFrame(go);
    };
    pan.current.panRaf = requestAnimationFrame(go);
  }, [clamp, applyTransform]);

  const handleCompassSpin = useCallback((item) => {
    const dW = item.dH && item.w && item.h ? Math.round(item.dH * 1.12 * (item.w / item.h)) : 200;
    const dH = item.dH ? Math.round(item.dH * 1.12) : 200;
    const cx = -(item.wx + dW / 2 - vsRef.current.w / 2);
    const cy = -(item.wy + dH / 2 - vsRef.current.h / 2);
    animatePanTo(cx, cy);
    setTimeout(() => onAnyClick(item), 1400);
  }, [animatePanTo, onAnyClick]);

  const handleEggFound = () => {
    if (eggFound) return;
    setEggFound(true);
    setShowEggModal(true);
    setShowConfetti(true);
    sfx.playEgg();
    analytics.easterEggFound();
  };

  // ─── Pointer / touch pan + pinch ────────────────────────────────────────
  //
  // Key design decisions for mobile feel:
  //
  // 1. Pan starts from ANY touch — including on photos/decorations. The early
  //    `if (onItem) return` that blocked this is gone. Pointer capture is only
  //    used for empty-canvas touches; for item touches we rely on bubbling
  //    (item → immWall → immCanvas) which works because framer-motion drag is
  //    disabled in normal view mode.
  //
  // 2. Tap vs drag is separated by pan.current.moved (set true at >8px of
  //    cumulative movement). WallItem's onClick already guards:
  //      if (!wallPanRef?.current?.moved) onAnyClick(item)
  //    so a drag that ends over a photo never opens it; only a clean tap does.
  //
  // 3. Position is written directly to the DOM via applyTransform — no setPos
  //    on the move path. This eliminates 60fps React re-renders during pan,
  //    which was the primary source of jitter on mobile.
  //
  // 4. Fling velocity is the rolling average of the last VEL_N samples, not
  //    just the final frame delta. This prevents a single noisy sample at
  //    finger-lift from snapping the fling in the wrong direction.

  const onPD = useCallback((e) => {
    if (e.pointerType === 'touch') return; // handled by native touch listeners
    const onItem = !!(
      e.target.closest(`.${styles.wallItem}`) ||
      e.target.closest(`.${styles.wallDeco}`)
    );

    if (pointers.current.size === 0) {
      pan.current.moved = false;
      pan.current.startX = e.clientX;
      pan.current.startY = e.clientY;
    }

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (editMode && editor?.setSelectedId && !onItem) editor.setSelectedId(null);

    const p = pan.current;
    cancelAnimationFrame(p.raf);
    cancelAnimationFrame(p.panRaf);

    if (pointers.current.size >= 2 && !editMode) {
      p.on = false;
      p.moved = true;
      const pts = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale: scaleRef.current,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Set up pan state for ALL single-finger touches, including on items.
    // For item touches we skip pointer capture so the item's native click
    // event still fires (browser click synthesis uses the original target,
    // not the capturing element). Move events reach us via DOM bubbling.
    p.on = true;
    p.sx = e.clientX - p.ox;
    p.sy = e.clientY - p.oy;
    p.lx = e.clientX;
    p.ly = e.clientY;
    // Reset rolling velocity buffer
    p.velBuf = [];
    p.velIdx = 0;
    // Freeze descendant CSS animations (string-light glow, item breathe, egg)
    // so the wall's compositor texture stays static while being translated.
    wallRef.current?.classList.add(styles.panning);

    if (!onItem) {
      e.currentTarget.setPointerCapture(e.pointerId);
      wrapRef.current?.classList.add(styles.grabbing);
    }
  }, [editMode, editor]);

  const onPM = useCallback((e) => {
    if (e.pointerType === 'touch') return; // handled by native touch listeners
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pan.current;

    if (!p.moved) {
      const dx = Math.abs(e.clientX - p.startX);
      const dy = Math.abs(e.clientY - p.startY);
      if (dx > 8 || dy > 8) p.moved = true;
    }

    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      zoomToScale(pinch.current.scale * (dist / pinch.current.dist), midX, midY);
      return;
    }

    if (!p.on) return;

    // Coalesced events give all intermediate positions between paint frames
    // (matters on 120Hz devices). Feed each into the velocity buffer for
    // accurate fling direction, but apply the transform only once using the
    // final dispatched position.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of events) {
      const vx = ce.clientX - p.lx;
      const vy = ce.clientY - p.ly;
      if (p.velBuf.length < p.VEL_N) {
        p.velBuf.push({ vx, vy });
      } else {
        p.velBuf[p.velIdx % p.VEL_N] = { vx, vy };
        p.velIdx++;
      }
      p.lx = ce.clientX;
      p.ly = ce.clientY;
    }

    const { x, y } = clamp(e.clientX - p.sx, e.clientY - p.sy);
    applyTransform(x, y, scaleRef.current);
  }, [clamp, zoomToScale, applyTransform]);

  const onPU = useCallback((e) => {
    if (e && e.pointerType === 'touch') return; // handled by native touch listeners
    if (e && e.pointerId != null) pointers.current.delete(e.pointerId);
    const p = pan.current;
    if (pointers.current.size < 2) {
      pinch.current = null;
      if (!p.on) { wallRef.current?.classList.remove(styles.panning); }
    }
    if (pointers.current.size === 1) {
      const [pt] = [...pointers.current.values()];
      p.on = true;
      p.sx = pt.x - p.ox; p.sy = pt.y - p.oy;
      p.lx = pt.x; p.ly = pt.y;
      p.velBuf = [];
      return;
    }
    if (pointers.current.size > 0) return;
    if (!p.on) { wrapRef.current?.classList.remove(styles.grabbing); return; }
    p.on = false;
    wrapRef.current?.classList.remove(styles.grabbing);

    // Fling: average the rolling velocity buffer for a smooth exit velocity.
    let avgVx = 0, avgVy = 0;
    if (p.velBuf.length > 0) {
      for (const v of p.velBuf) { avgVx += v.vx; avgVy += v.vy; }
      avgVx /= p.velBuf.length;
      avgVy /= p.velBuf.length;
    }

    const decay = 0.93;
    const fling = (vx, vy) => {
      vx *= decay; vy *= decay;
      const { x, y } = clamp(p.ox + vx, p.oy + vy);
      applyTransform(x, y, scaleRef.current);
      if (Math.abs(vx) > 0.3 || Math.abs(vy) > 0.3) {
        p.raf = requestAnimationFrame(() => fling(vx, vy));
      } else {
        wallRef.current?.classList.remove(styles.panning);
      }
    };
    if (Math.abs(avgVx) > 0.5 || Math.abs(avgVy) > 0.5) {
      p.raf = requestAnimationFrame(() => fling(avgVx, avgVy));
    } else {
      wallRef.current?.classList.remove(styles.panning);
    }
  }, [clamp, applyTransform]);

  // ─── Native touch listeners for mobile pan/pinch ───────────────────────────
  //
  // React's onPointerDown/Move/Up go through event delegation at the React root
  // — one extra dispatch per move event. On mobile at 60–120Hz that latency
  // accumulates into visible shakiness. Attaching directly to the element fires
  // the handler synchronously in the browser's touch pipeline.
  //
  // Calling e.preventDefault() on touchstart tells the browser we own this
  // touch sequence, which also cancels its pointer-event synthesis. The React
  // pointer handlers above therefore only receive mouse events (desktop).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onTS(e) {
      // No preventDefault here — touch-action:none on .immCanvas handles scroll
      // prevention via CSS, and skipping preventDefault lets the browser
      // synthesize click events so taps on wall items still open modals.
      cancelAnimationFrame(pan.current.raf);
      cancelAnimationFrame(pan.current.panRaf);
      const ts = e.touches;

      if (ts.length === 2) {
        pan.current.on   = false;
        pan.current.moved = true;
        pinch.current = {
          dist: Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1,
          scale: scaleRef.current,
        };
        return;
      }

      const t = ts[0];
      const p = pan.current;
      p.moved  = false;
      p.startX = t.clientX;
      p.startY = t.clientY;
      p.on     = true;
      p.sx     = t.clientX - p.ox;
      p.sy     = t.clientY - p.oy;
      p.lx     = t.clientX;
      p.ly     = t.clientY;
      p.velBuf = [];
      p.velIdx = 0;
      // Do NOT pause animations here — we don't know yet if this is a tap
      // or a drag. Pausing on every touchstart (then resuming on touchend)
      // causes a visible flash when the user taps to open a modal. We pause
      // only after the drag threshold is crossed (see onTM below).
    }

    function onTM(e) {
      e.preventDefault();
      const ts = e.touches;
      const p  = pan.current;

      if (ts.length >= 2 && pinch.current) {
        const dist = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1;
        const midX = (ts[0].clientX + ts[1].clientX) / 2;
        const midY = (ts[0].clientY + ts[1].clientY) / 2;
        zoomToScale(pinch.current.scale * (dist / pinch.current.dist), midX, midY);
        return;
      }

      if (!p.on || !ts.length) return;
      const t = ts[0];

      if (!p.moved) {
        const dx = Math.abs(t.clientX - p.startX);
        const dy = Math.abs(t.clientY - p.startY);
        if (dx > 8 || dy > 8) {
          p.moved = true;
          wallRef.current?.classList.add(styles.panning);
        }
      }

      const vx = t.clientX - p.lx;
      const vy = t.clientY - p.ly;
      if (p.velBuf.length < p.VEL_N) {
        p.velBuf.push({ vx, vy });
      } else {
        p.velBuf[p.velIdx % p.VEL_N] = { vx, vy };
        p.velIdx++;
      }
      p.lx = t.clientX;
      p.ly = t.clientY;

      const { x, y } = clamp(t.clientX - p.sx, t.clientY - p.sy);
      applyTransform(x, y, scaleRef.current);
    }

    function onTE(e) {
      const p = pan.current;
      pinch.current = null;

      if (e.touches.length === 1 && p.on) {
        // one finger lifted, one remains — restart pan from new anchor
        const t = e.touches[0];
        p.sx     = t.clientX - p.ox;
        p.sy     = t.clientY - p.oy;
        p.lx     = t.clientX;
        p.ly     = t.clientY;
        p.velBuf = [];
        p.velIdx = 0;
        p.moved  = true;
        return;
      }

      if (!p.on) {
        wallRef.current?.classList.remove(styles.panning);
        return;
      }
      p.on = false;

      if (!p.moved) return;

      let avgVx = 0, avgVy = 0;
      if (p.velBuf.length > 0) {
        for (const v of p.velBuf) { avgVx += v.vx; avgVy += v.vy; }
        avgVx /= p.velBuf.length;
        avgVy /= p.velBuf.length;
      }

      const decay = 0.93;
      const fling = (vx, vy) => {
        vx *= decay; vy *= decay;
        const { x, y } = clamp(p.ox + vx, p.oy + vy);
        applyTransform(x, y, scaleRef.current);
        if (Math.abs(vx) > 0.3 || Math.abs(vy) > 0.3) {
          p.raf = requestAnimationFrame(() => fling(vx, vy));
        } else {
          wallRef.current?.classList.remove(styles.panning);
        }
      };

      if (Math.abs(avgVx) > 0.5 || Math.abs(avgVy) > 0.5) {
        p.raf = requestAnimationFrame(() => fling(avgVx, avgVy));
      } else {
        wallRef.current?.classList.remove(styles.panning);
      }
    }

    el.addEventListener("touchstart",  onTS, { passive: false });
    el.addEventListener("touchmove",   onTM, { passive: false });
    el.addEventListener("touchend",    onTE, { passive: true  });
    el.addEventListener("touchcancel", onTE, { passive: true  });

    return () => {
      el.removeEventListener("touchstart",  onTS);
      el.removeEventListener("touchmove",   onTM);
      el.removeEventListener("touchend",    onTE);
      el.removeEventListener("touchcancel", onTE);
    };
  }, [clamp, zoomToScale, applyTransform]);

  return (
    <motion.div
      className={styles.immOverlay}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <button className={styles.immX} onClick={onClose} aria-label="Close wall">×</button>
      <EditorPanel items={items} />
      <button
        className={styles.immMute}
        onClick={sfx.toggleMute}
        title={sfx.muted ? "Unmute" : "Mute"}
        aria-label={sfx.muted ? "Unmute" : "Mute"}
      >
        {sfx.muted ? "🔇" : "🔈"}
      </button>
      <AnimatePresence>
        {showHint && (
          <motion.div
            className={styles.hintCard}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.4, ease: "easeOut" } }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.22 } }}
          >
            <button
              className={styles.hintClose}
              onClick={() => setShowHint(false)}
              aria-label="Dismiss instructions"
            >
              ×
            </button>
            <div className={styles.hintTitle}>How to explore</div>
            <ul className={styles.hintList}>
              <li><span className={styles.hintLabel}>Move</span>Drag to explore, pinch to zoom</li>
              <li><span className={styles.hintLabel}>Read</span>Tap any photo for the story</li>
              <li><span className={styles.hintLabel}>Play</span>Interact with the clock, compass, pinball, and tic-tac-toe</li>
              <li><span className={styles.hintLabel}>Hunt</span>Find the easter egg</li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <Minimap
        posRef={posRef}
        scaleRef={scaleRef}
        vwRef={vwRef}
        vhRef={vhRef}
        items={items}
      />

      <div
        ref={wrapRef}
        className={styles.immCanvas}
        onPointerDown={onPD}
        onPointerMove={onPM}
        onPointerUp={onPU}
        onPointerLeave={onPU}
        onPointerCancel={onPU}
      >
        {/* transform is driven by applyTransform (direct DOM write), not React state.
            The initial value is applied on first mount via the useEffect upd() call. */}
        <div ref={wallRef} className={styles.immWall}>
          <StringLights width={WALL_W} />
          <EditorGrid />
          {items.map((item, i) => (
            <WallItem
              key={item.id}
              item={item}
              dimmed={dragging !== null && dragging !== item.id}
              setDragging={setDragging}
              onAnyClick={onAnyClick}
              onImageError={onDynamicImageError}
              devDelay={i * 0.16}
              breatheDelay={(i * 0.7) % 8}
              sfx={sfx}
              wallPanRef={pan}
            />
          ))}
          <Compass onClick={decoClick(() => { analytics.wallToyUsed("compass"); setShowCompass(true); })} />
          <DualClock onClick={decoClick(() => { analytics.wallToyUsed("clock"); setShowClock(true); })} />
          <ToyTracker kind="pinball"><PinballMachine /></ToyTracker>
          <ToyTracker kind="tictactoe"><TicTacToe /></ToyTracker>
          {!eggFound && <EasterEgg onFind={handleEggFound} />}
          {eggFound && <EasterEggFound />}
        </div>
      </div>

      <AnimatePresence>
        {showCompass && (
          <CompassModal
            key="compass-modal"
            onClose={() => setShowCompass(false)}
            onSpin={handleCompassSpin}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showClock && <DualClockModal key="clock-modal" onClose={() => setShowClock(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showEggModal && !showConfetti && (
          <EggFoundModal onClose={() => setShowEggModal(false)} />
        )}
      </AnimatePresence>

      {showConfetti && (
        <ConfettiOverlay onDone={() => setShowConfetti(false)} />
      )}

      <AnimatePresence>
        {photosExpired && (
          <motion.div
            className={styles.expiredOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className={styles.expiredCard}
              initial={{ scale: 0.92, y: 16, opacity: 0, rotate: -1.5 }}
              animate={{ scale: 1, y: 0, opacity: 1, rotate: -1 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              <div className={styles.expiredTape} />
              <div className={styles.expiredTitle}>Where&apos;d the photos go?</div>
              <div className={styles.expiredBody}>
                <p>Hey — you stuck around a while.</p>
                <p>
                  Notion&apos;s signed photo links go quiet after about an hour,
                  and most of the wall slipped out the door while you weren&apos;t looking.
                </p>
                <p>Hit refresh and the memories come back.</p>
              </div>
              <div className={styles.expiredSig}>— A</div>
              <button
                className={styles.expiredBtn}
                onClick={() => window.location.reload()}
              >
                — refresh the wall —
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
