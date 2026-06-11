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

// ─────────────────────────────────────────────────────────────────────────
// ImmersiveWallMobile — a ground-up, touch-only rebuild of the immersive
// corkboard for phones. It shares ALL wall content (photos, toys, easter egg,
// modals, sound FX) and the wall/chrome CSS with the desktop component; what's
// rebuilt is the gesture/transform engine and the open framing, written
// mobile-first so panning/pinching/flinging is buttery with zero React work on
// the hot path.
//
// Design rules carried over (they're the hard-won perf wins) and made native:
//   1. ONE composite layer. The wall is a single translate3d+scale transform,
//      written DIRECTLY to the DOM — never through React state — so a pan never
//      triggers reconciliation.
//   2. Touch is the ONLY input path. No pointer/mouse plumbing, no wheel. Native
//      non-passive touch listeners run synchronously in the browser's touch
//      pipeline (React synthetic events add a dispatch hop that shows up as
//      shakiness at 120Hz).
//   3. Tap vs drag is separated by `moved` (>8px). A drag that ends over a photo
//      never opens it; a clean tap does (WallItem guards on wallPanRef.moved).
//   4. Fling velocity is a rolling average of the last N samples, so a single
//      noisy finger-lift frame can't snap the fling the wrong way.
//   5. While panning/flinging, every descendant CSS animation is frozen
//      (.immWall.panning *) so the wall texture stays static and the pan is a
//      pure GPU translate.
// ─────────────────────────────────────────────────────────────────────────

const MAX_SCALE = 2.4;
const MIN_SCALE = 0.38;     // overview floor on phones
const OPEN_SCALE = 0.78;    // first-paint zoom
const DRAG_THRESH = 8;      // px before a touch counts as a drag
const VEL_N = 5;            // rolling velocity window
const FLING_DECAY = 0.93;

// YJHD poster center in wall coords (wx=300, wy=175, dW≈344, dH≈515 at 1.12×).
const YJHD_CX = 472;
const YJHD_CY = 432;

// Minimap — writes the viewport indicator straight to the DOM via a ref-driven
// rAF loop (zero React renders during pan). Self-contained so the desktop file
// stays untouched.
function Minimap({ posRef, scaleRef, vwRef, vhRef, items }) {
  const MW = 132, MH = 90;
  const vpRef = useRef(null);

  useEffect(() => {
    const sx = MW / WALL_W, sy = MH / WALL_H;
    let raf;
    const tick = () => {
      const px = posRef.current.x, py = posRef.current.y, s = scaleRef.current;
      const vpW = Math.min(MW, (vwRef.current / s) * sx);
      const vpH = Math.min(MH, (vhRef.current / s) * sy);
      const vpX = Math.max(0, Math.min(MW - vpW, (-px / s) * sx));
      const vpY = Math.max(0, Math.min(MH - vpH, (-py / s) * sy));
      if (vpRef.current) {
        const st = vpRef.current.style;
        st.left = `${vpX}px`; st.top = `${vpY}px`;
        st.width = `${vpW}px`; st.height = `${vpH}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [posRef, scaleRef, vwRef, vhRef]);

  const sx = MW / WALL_W, sy = MH / WALL_H;
  return (
    <div className={styles.minimap} style={{ width: MW, height: MH }}>
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

// Fires a one-time analytics ping the first time a toy is touched.
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

export function ImmersiveWallMobile(props) {
  return (
    <PinboardEditorProvider>
      <ImmersiveWallMobileInner {...props} />
    </PinboardEditorProvider>
  );
}

function ImmersiveWallMobileInner({ items, onClose, onAnyClick, onDynamicImageError, photosExpired }) {
  const editor = useEditor();
  const editMode = !!editor?.enabled;

  const wrapRef = useRef(null);   // gesture surface
  const wallRef = useRef(null);   // transformed layer
  const vsRef = useRef({ w: 1, h: 1 });
  const vwRef = useRef(1);        // mirrors vsRef.w for the Minimap
  const vhRef = useRef(1);

  // posRef mirrors the live transform for the minimap loop + sync reads.
  const posRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(OPEN_SCALE);
  const pinch = useRef(null);

  // All gesture state in one ref so the hot path never touches React state.
  const g = useRef({
    on: false, sx: 0, sy: 0, ox: 0, oy: 0,
    lx: 0, ly: 0, startX: 0, startY: 0, moved: false,
    velBuf: [], velIdx: 0, raf: null, panRaf: null,
  });

  // scale is the ONLY render-affecting value (wall children read zoom). It's
  // committed sparingly — never on the per-move path.
  const [scale, setScale] = useState(OPEN_SCALE);
  const [dragging, setDragging] = useState(null);
  const [eggFound, setEggFound] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showClock, setShowClock] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const sfx = useSoundFX();

  // Decoration tap guard: ignore the tap if the gesture moved (it was a drag).
  const decoClick = (cb) => (editMode ? undefined : () => { if (!g.current.moved) cb(); });

  // Write transform straight to the DOM. Never re-renders React.
  const applyTransform = useCallback((x, y, s) => {
    g.current.ox = x;
    g.current.oy = y;
    posRef.current.x = x;
    posRef.current.y = y;
    if (wallRef.current) {
      wallRef.current.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`;
    }
  }, []);

  const minScale = useCallback(() => {
    const base = Math.max(vsRef.current.w / WALL_W, vsRef.current.h / WALL_H);
    return Math.max(base, MIN_SCALE);
  }, []);

  const clamp = useCallback((x, y, s = scaleRef.current) => ({
    x: Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), x)),
    y: Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), y)),
  }), []);

  // ─── Mount: measure + frame the opening view on the YJHD poster ──────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let firstRun = true;
    const upd = () => {
      vsRef.current = { w: el.clientWidth, h: el.clientHeight };
      vwRef.current = el.clientWidth;
      vhRef.current = el.clientHeight;

      if (firstRun) {
        firstRun = false;
        const s = Math.max(minScale(), OPEN_SCALE);
        scaleRef.current = s;
        setScale(s);
        // Frame the YJHD poster in the upper-left third (reference screenshot):
        // its horizontal center lands ~45% across, top of the wall in view.
        const targetOx = vsRef.current.w * 0.45 - YJHD_CX * s;
        const { x, y } = clamp(targetOx, 0, s);
        applyTransform(x, y, s);
        return;
      }

      // Resize/orientation change: re-clamp scale + position to new bounds.
      const ms = minScale();
      const s = Math.max(scaleRef.current, ms);
      scaleRef.current = s;
      setScale(s);
      const { x, y } = clamp(g.current.ox, g.current.oy, s);
      applyTransform(x, y, s);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [applyTransform, clamp, minScale]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes (external keyboard / dev).
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Zoom toward a focal point (pinch midpoint), keeping that wall point fixed.
  const zoomToScale = useCallback((targetS, focalX, focalY) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = focalX - rect.left;
    const cy = focalY - rect.top;
    const oldS = scaleRef.current;
    const newS = Math.min(MAX_SCALE, Math.max(minScale(), targetS));
    if (Math.abs(newS - oldS) < 0.0001) return;
    const wx = (cx - g.current.ox) / oldS;
    const wy = (cy - g.current.oy) / oldS;
    const { x, y } = clamp(cx - wx * newS, cy - wy * newS, newS);
    scaleRef.current = newS;
    setScale(newS);
    applyTransform(x, y, newS);
  }, [clamp, minScale, applyTransform]);

  // Smooth pan-to (used by the compass "spin to a memory" gesture).
  const animatePanTo = useCallback((tx, ty) => {
    const { x: cx, y: cy } = clamp(tx, ty);
    const sx = g.current.ox, sy = g.current.oy;
    const start = performance.now();
    const go = (now) => {
      const t = Math.min((now - start) / 1100, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad
      applyTransform(sx + (cx - sx) * e, sy + (cy - sy) * e, scaleRef.current);
      if (t < 1) g.current.panRaf = requestAnimationFrame(go);
    };
    g.current.panRaf = requestAnimationFrame(go);
  }, [clamp, applyTransform]);

  const handleCompassSpin = useCallback((item) => {
    // Center the picked item in the viewport, scale-aware: an item at wall
    // coord (wx,wy) renders on screen at (ox + wx*s, oy + wy*s).
    const s = scaleRef.current;
    const dW = item.dH && item.w && item.h ? Math.round(item.dH * 1.12 * (item.w / item.h)) : 200;
    const dH = item.dH ? Math.round(item.dH * 1.12) : 200;
    const cx = vsRef.current.w / 2 - (item.wx + dW / 2) * s;
    const cy = vsRef.current.h / 2 - (item.wy + dH / 2) * s;
    animatePanTo(cx, cy);
    setTimeout(() => onAnyClick(item), 1300);
  }, [animatePanTo, onAnyClick]);

  const handleEggFound = () => {
    if (eggFound) return;
    setEggFound(true);
    setShowEggModal(true);
    setShowConfetti(true);
    sfx.playEgg();
    analytics.easterEggFound();
  };

  // Momentum fling from the rolling velocity buffer. Shared by the touch and
  // mouse paths so the exit feel is identical.
  const startFling = useCallback(() => {
    const p = g.current;
    let avgVx = 0, avgVy = 0;
    if (p.velBuf.length) {
      for (const v of p.velBuf) { avgVx += v.vx; avgVy += v.vy; }
      avgVx /= p.velBuf.length; avgVy /= p.velBuf.length;
    }
    const fling = (vx, vy) => {
      vx *= FLING_DECAY; vy *= FLING_DECAY;
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

  // ─── Mouse / pointer engine (desktop + "test mobile via narrow window") ──
  // Touch is handled by the native fast-path below; these handlers run ONLY
  // for mouse/pen (we early-return on pointerType 'touch'). Without this,
  // dragging with a mouse in a narrow window does nothing.
  const onPointerDown = useCallback((e) => {
    if (e.pointerType === "touch" || editMode) return;
    const p = g.current;
    cancelAnimationFrame(p.raf);
    cancelAnimationFrame(p.panRaf);
    p.on = true; p.moved = false;
    p.startX = e.clientX; p.startY = e.clientY;
    p.sx = e.clientX - p.ox; p.sy = e.clientY - p.oy;
    p.lx = e.clientX; p.ly = e.clientY;
    p.velBuf = []; p.velIdx = 0;
    wrapRef.current?.classList.add(styles.grabbing);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [editMode]);

  const onPointerMove = useCallback((e) => {
    if (e.pointerType === "touch") return;
    const p = g.current;
    if (!p.on) return;
    if (!p.moved &&
        (Math.abs(e.clientX - p.startX) > DRAG_THRESH || Math.abs(e.clientY - p.startY) > DRAG_THRESH)) {
      p.moved = true;
      wallRef.current?.classList.add(styles.panning);
    }
    const vx = e.clientX - p.lx, vy = e.clientY - p.ly;
    if (p.velBuf.length < VEL_N) p.velBuf.push({ vx, vy });
    else p.velBuf[p.velIdx++ % VEL_N] = { vx, vy };
    p.lx = e.clientX; p.ly = e.clientY;
    const { x, y } = clamp(e.clientX - p.sx, e.clientY - p.sy);
    applyTransform(x, y, scaleRef.current);
  }, [clamp, applyTransform]);

  const onPointerUp = useCallback((e) => {
    if (e && e.pointerType === "touch") return;
    const p = g.current;
    if (!p.on) return;
    p.on = false;
    wrapRef.current?.classList.remove(styles.grabbing);
    if (!p.moved) { wallRef.current?.classList.remove(styles.panning); return; }
    startFling();
  }, [startFling]);

  // Wheel: ctrl/⌘+wheel or large deltas → zoom toward cursor; trackpad / shift
  // → two-axis pan. Lets you explore the wall with a trackpad while testing.
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
        const p = g.current;
        const { x, y } = clamp(p.ox - e.deltaX, p.oy - e.deltaY);
        applyTransform(x, y, scaleRef.current);
      } else {
        zoomToScale(scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editMode, clamp, zoomToScale, applyTransform]);

  // ─── Native touch engine ────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onStart(e) {
      cancelAnimationFrame(g.current.raf);
      cancelAnimationFrame(g.current.panRaf);
      // In the dev-only editor (?edit=1) framer-motion owns item drags — don't
      // fight it with canvas panning.
      if (editMode) return;
      const ts = e.touches;

      if (ts.length === 2) {
        // Begin pinch. Mark moved so a two-finger gesture never reads as a tap.
        g.current.on = false;
        g.current.moved = true;
        pinch.current = {
          dist: Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1,
          scale: scaleRef.current,
        };
        return;
      }

      const t = ts[0];
      const p = g.current;
      p.moved = false;
      p.startX = t.clientX; p.startY = t.clientY;
      p.on = true;
      p.sx = t.clientX - p.ox; p.sy = t.clientY - p.oy;
      p.lx = t.clientX; p.ly = t.clientY;
      p.velBuf = []; p.velIdx = 0;
      // Don't freeze animations yet — we don't know if this is a tap or a drag.
      // Freezing on every touch then unfreezing on tap causes a visible flash.
    }

    function onMove(e) {
      if (editMode) return; // let framer-motion own item drags in edit mode
      e.preventDefault(); // touch-action:none also guards, but be explicit
      const ts = e.touches;
      const p = g.current;

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
        if (Math.abs(t.clientX - p.startX) > DRAG_THRESH ||
            Math.abs(t.clientY - p.startY) > DRAG_THRESH) {
          p.moved = true;
          wallRef.current?.classList.add(styles.panning);
        }
      }

      // Rolling velocity buffer for the fling.
      const vx = t.clientX - p.lx;
      const vy = t.clientY - p.ly;
      if (p.velBuf.length < VEL_N) p.velBuf.push({ vx, vy });
      else p.velBuf[p.velIdx++ % VEL_N] = { vx, vy };
      p.lx = t.clientX; p.ly = t.clientY;

      const { x, y } = clamp(t.clientX - p.sx, t.clientY - p.sy);
      applyTransform(x, y, scaleRef.current);
    }

    function onEnd(e) {
      const p = g.current;
      pinch.current = null;

      // One finger lifted from a pinch but one remains → re-anchor a pan.
      if (e.touches.length === 1 && p.on) {
        const t = e.touches[0];
        p.sx = t.clientX - p.ox; p.sy = t.clientY - p.oy;
        p.lx = t.clientX; p.ly = t.clientY;
        p.velBuf = []; p.velIdx = 0; p.moved = true;
        return;
      }

      if (!p.on) { wallRef.current?.classList.remove(styles.panning); return; }
      p.on = false;

      if (!p.moved) { wallRef.current?.classList.remove(styles.panning); return; }
      startFling();
    }

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [clamp, zoomToScale, applyTransform, editMode, startFling]);

  return (
    <motion.div
      className={styles.immOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
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
            animate={{ opacity: 1, y: 0, transition: { delay: 0.4, duration: 0.4, ease: "easeOut" } }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.2 } }}
          >
            <button className={styles.hintClose} onClick={() => setShowHint(false)} aria-label="Dismiss instructions">×</button>
            <div className={styles.hintTitle}>How to explore</div>
            <ul className={styles.hintList}>
              <li><span className={styles.hintLabel}>Move</span>Drag to explore, pinch to zoom</li>
              <li><span className={styles.hintLabel}>Read</span>Tap any photo for the story</li>
              <li><span className={styles.hintLabel}>Play</span>Tap the clock, compass, pinball, tic-tac-toe</li>
              <li><span className={styles.hintLabel}>Hunt</span>Find the easter egg</li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <Minimap posRef={posRef} scaleRef={scaleRef} vwRef={vwRef} vhRef={vhRef} items={items} />

      <div
        ref={wrapRef}
        className={styles.immCanvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* transform is driven by applyTransform (direct DOM write), set on mount. */}
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
              wallPanRef={g}
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
          <CompassModal key="compass-modal" onClose={() => setShowCompass(false)} onSpin={handleCompassSpin} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showClock && <DualClockModal key="clock-modal" onClose={() => setShowClock(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showEggModal && !showConfetti && <EggFoundModal onClose={() => setShowEggModal(false)} />}
      </AnimatePresence>

      {showConfetti && <ConfettiOverlay onDone={() => setShowConfetti(false)} />}

      <AnimatePresence>
        {photosExpired && (
          <motion.div
            className={styles.expiredOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <p>Notion&apos;s signed photo links go quiet after about an hour, and most of the wall slipped out the door while you weren&apos;t looking.</p>
                <p>Hit refresh and the memories come back.</p>
              </div>
              <div className={styles.expiredSig}>— A</div>
              <button className={styles.expiredBtn} onClick={() => window.location.reload()}>— refresh the wall —</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
