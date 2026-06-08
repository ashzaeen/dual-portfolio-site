"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Pinboard.module.css";
import { WALL_W, WALL_H, INTERACTIVE_BOXES } from "@/data/pinboard";
import { WallItem } from "./Items";
import {
  StringLights, DustParticles, Compass, DualClock,
  EasterEgg, EasterEggFound, ConfettiOverlay,
} from "./Decorations";
import { PinballMachine } from "./PinballMachine";
import { TicTacToe } from "./TicTacToe";
import { EggFoundModal, CompassModal, DualClockModal } from "./Modals";
import { useSoundFX } from "./useSoundFX";
import { PinboardEditorProvider, useEditor, EditorGrid, EditorPanel } from "./PinboardEditor";
import { analytics } from "@/lib/analytics";

// Minimap — small radar at the bottom-right of the immersive view.
// Photo items render as muted gold dots; interactive elements
// (compass, clock, pinball, tic-tac-toe) render larger and brighter
// with a soft pulse so visitors notice "there are things to play with
// over there." The easter egg appears too, but as the dimmest, smallest
// dot — visible if you look carefully, but it doesn't shout.
const MAX_SCALE = 2.4;

// Fires `wall_toy_used` the first time a visitor touches a self-contained toy
// (pinball, tic-tac-toe) that exposes no callback of its own. `display:contents`
// means this wrapper generates no box, so the toys' absolute positioning on the
// wall is untouched; the capture-phase listener still sees descendant pointers.
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

function Minimap({ px, py, vw, vh, scale, items }) {
  const MW = 156, MH = 106;
  const sx = MW / WALL_W, sy = MH / WALL_H;
  // As you zoom in (scale > 1) the visible slice of wall shrinks.
  const vpW = (vw / scale) * sx, vpH = (vh / scale) * sy;
  const vpX = Math.max(0, Math.min(MW - vpW, (-px / scale) * sx));
  const vpY = Math.max(0, Math.min(MH - vpH, (-py / scale) * sy));
  return (
    <div className={styles.minimap}>
      {items.filter((i) => i.wx != null).map((i) => (
        <div
          key={i.id}
          className={styles.mmDot}
          style={{ left: i.wx * sx, top: i.wy * sy }}
        />
      ))}
      {INTERACTIVE_BOXES.map((b) => (
        <div
          key={b.id}
          className={b.kind === "egg" ? styles.mmEgg : styles.mmInteractive}
          style={{ left: (b.x + b.w / 2) * sx, top: (b.y + b.h / 2) * sy }}
          title={b.id}
        />
      ))}
      <div className={styles.mmVp} style={{ left: vpX, top: vpY, width: vpW, height: vpH }} />
    </div>
  );
}

// Public entry — wraps the actual wall in the editor provider so the
// hidden `?edit=1` mode has somewhere to live. Inner component reads
// from the editor context for click suppression + grid rendering.
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
  // In edit mode the wall items are click-disabled (so dragging photos
  // doesn't open modals). Mirror that for compass + clock — they'd open
  // their modals and steal focus from the coordinate-discovery flow.
  // Wrap deco clicks so they're suppressed after a drag/pinch gesture.
  // pan.current.moved is set true the moment the pointer travels > 8px,
  // and reset only when a brand-new gesture starts (first pointer down).
  const decoClick = (cb) => (editMode ? undefined : () => {
    if (!pan.current.moved) cb();
  });
  const wrapRef = useRef(null);
  const vsRef = useRef({ w: 1200, h: 800 });
  // pan state holds the wall offset (top/left of wall in viewport coords)
  const pan = useRef({
    on: false, sx: 0, sy: 0, ox: -200, oy: -150,
    vx: 0, vy: 0, lx: 0, ly: 0, raf: null, panRaf: null,
    // Tap vs drag: moved=true once the pointer travels >8px in this gesture.
    // Reset only when a fresh gesture starts (size===0 before pointerdown).
    moved: false, startX: 0, startY: 0,
  });
  const [pos, setPos] = useState({ x: -200, y: -150 });
  // Zoom: `scale` drives the wall transform; scaleRef mirrors it for the
  // event handlers (which read synchronously). Multi-pointer state lives in
  // refs so pinch math doesn't churn React state.
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const [grabbing, setGrabbing] = useState(false);
  const [dragging, setDragging] = useState(null);
  // Wall-local pointer for the currently-dragging item (or null).
  // Drives DustParticles' scatter.
  const [dragPointer, setDragPointer] = useState(null);
  const [eggFound, setEggFound] = useState(false);
  const [showEggModal, setShowEggModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showClock, setShowClock] = useState(false);
  // Small "how to explore" card that fades in just after the wall opens.
  // Dismissible via its crosshair, but the wall stays fully interactive
  // underneath it so visitors don't have to close it to start exploring.
  const [showHint, setShowHint] = useState(true);
  const sfx = useSoundFX();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let firstRun = true;
    const upd = () => {
      vsRef.current = { w: el.clientWidth, h: el.clientHeight };
      const ms = Math.max(vsRef.current.w / WALL_W, vsRef.current.h / WALL_H);
      let s = scaleRef.current;

      if (firstRun) {
        firstRun = false;
        // Mobile: open at 0.5 — 2× more zoomed-out than the desktop default
        // of 1.0, so the first impression shows a meaningful overview of the
        // wall rather than a heavily cropped corner.
        if (el.clientWidth <= 768) s = Math.max(ms, 0.5);
      }

      if (s < ms) s = ms;
      scaleRef.current = s;
      setScale(s);

      const p = pan.current;
      const nx = Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), p.ox));
      const ny = Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), p.oy));
      p.ox = nx; p.oy = ny;
      setPos({ x: nx, y: ny });
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  // Lock the page behind the modal so wheel/touch scroll never bleeds
  // through to the main document.
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

  // Smallest scale that still covers the viewport (no empty gutters).
  const minScale = useCallback(
    () => Math.max(vsRef.current.w / WALL_W, vsRef.current.h / WALL_H),
    []
  );

  // Clamp wall pan so we don't show empty space past the edges. Bounds
  // depend on the current zoom (the scaled wall is WALL_* × s).
  const clamp = useCallback((x, y, s = scaleRef.current) => ({
    x: Math.min(0, Math.max(-(WALL_W * s - vsRef.current.w), x)),
    y: Math.min(0, Math.max(-(WALL_H * s - vsRef.current.h), y)),
  }), []);

  // Zoom toward a viewport point (clientX/Y), keeping the wall point under
  // it pinned. Used by wheel, ctrl-wheel and touch pinch.
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
    p.ox = c.x; p.oy = c.y;
    scaleRef.current = newS;
    setScale(newS);
    setPos({ x: c.x, y: c.y });
  }, [clamp, minScale]);

  // Wheel: mouse wheel → zoom; trackpad two-finger scroll → pan; trackpad
  // pinch / ctrl+wheel → zoom. Attached non-passively so we can preventDefault
  // (which also stops the browser's own page zoom / scroll).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (editMode) return;
      if (e.ctrlKey) {
        // Trackpad pinch gesture (and ctrl+wheel) arrive as ctrlKey wheels.
        zoomToScale(scaleRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
        return;
      }
      // Heuristic: trackpad two-finger scrolls carry horizontal motion
      // and/or small, fractional vertical deltas; a mouse wheel emits
      // larger, integer vertical steps. Former → pan, latter → zoom.
      const horizontal = Math.abs(e.deltaX) > 0;
      const fractional = !Number.isInteger(e.deltaY);
      const small = Math.abs(e.deltaY) < 50;
      if (horizontal || fractional || small) {
        const p = pan.current;
        const { x, y } = clamp(p.ox - e.deltaX, p.oy - e.deltaY);
        p.ox = x; p.oy = y;
        setPos({ x, y });
      } else {
        zoomToScale(scaleRef.current * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editMode, clamp, zoomToScale]);

  const animatePanTo = useCallback((tx, ty) => {
    const { x: cx, y: cy } = clamp(tx, ty);
    const sx = pan.current.ox, sy = pan.current.oy;
    const start = performance.now();
    const go = (now) => {
      const t = Math.min((now - start) / 1200, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      pan.current.ox = sx + (cx - sx) * e;
      pan.current.oy = sy + (cy - sy) * e;
      setPos({ x: pan.current.ox, y: pan.current.oy });
      if (t < 1) pan.current.panRaf = requestAnimationFrame(go);
    };
    pan.current.panRaf = requestAnimationFrame(go);
  }, [clamp]);

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

  // ─── Pointer drag + pinch (mouse + touch + trackpad) ───
  //
  // Key design: ALL pointers are registered in pointers.current regardless
  // of what's under the finger. This makes pinch work even when both fingers
  // land on photos or decorations — previously the early-return meant those
  // pointer IDs were never tracked, so pinch never initiated.
  //
  // Tap vs drag is separated via pan.current.moved: it's set true once the
  // pointer travels >8px, and reset only at the start of a fresh gesture
  // (first pointer down from 0 pointers). WallItem and deco click handlers
  // check this flag so a drag that ends over an item doesn't open it.
  const onPD = useCallback((e) => {
    const onItem = !!(
      e.target.closest(`.${styles.wallItem}`) ||
      e.target.closest(`.${styles.wallDeco}`)
    );

    // Fresh gesture (no fingers previously down) — reset tap/drag state.
    if (pointers.current.size === 0) {
      pan.current.moved = false;
      pan.current.startX = e.clientX;
      pan.current.startY = e.clientY;
    }

    // Register this pointer so pinch math and move-tracking always work.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (editMode && editor?.setSelectedId && !onItem) editor.setSelectedId(null);

    const p = pan.current;

    // Two-finger pinch — always proceed regardless of what's under the fingers.
    if (pointers.current.size >= 2 && !editMode) {
      p.on = false;
      p.moved = true; // any 2-finger gesture counts as "moved" (no item tap fires)
      const pts = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale: scaleRef.current,
      };
      // Capture this pointer so move events reach the canvas even off-element.
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Single pointer on item/deco — register (above) but don't start pan.
    // The item handles its own click; onPM will bubble up via the DOM.
    if (onItem) return;

    // Single pointer on empty canvas — start pan.
    e.currentTarget.setPointerCapture(e.pointerId);
    p.on = true;
    p.sx = e.clientX - p.ox; p.sy = e.clientY - p.oy;
    p.lx = e.clientX; p.ly = e.clientY;
    p.vx = 0; p.vy = 0;
    cancelAnimationFrame(p.raf);
    setGrabbing(true);
  }, [editMode, editor]);

  const onPM = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pan.current;

    // Track cumulative movement so tap vs drag can be distinguished later.
    if (!p.moved) {
      const dx = Math.abs(e.clientX - p.startX);
      const dy = Math.abs(e.clientY - p.startY);
      if (dx > 8 || dy > 8) p.moved = true;
    }

    // Two fingers → pinch-zoom around their midpoint.
    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      zoomToScale(pinch.current.scale * (dist / pinch.current.dist), midX, midY);
      return;
    }
    if (!p.on) return;
    p.vx = e.clientX - p.lx; p.vy = e.clientY - p.ly;
    p.lx = e.clientX; p.ly = e.clientY;
    const { x, y } = clamp(e.clientX - p.sx, e.clientY - p.sy);
    p.ox = x; p.oy = y;
    setPos({ x, y });
  }, [clamp, zoomToScale]);
  const onPU = useCallback((e) => {
    if (e && e.pointerId != null) pointers.current.delete(e.pointerId);
    const p = pan.current;
    if (pointers.current.size < 2) pinch.current = null;
    // One finger remains after a pinch → resume panning from it (no fling).
    if (pointers.current.size === 1) {
      const [pt] = [...pointers.current.values()];
      p.on = true;
      p.sx = pt.x - p.ox; p.sy = pt.y - p.oy;
      p.lx = pt.x; p.ly = pt.y;
      p.vx = 0; p.vy = 0;
      return;
    }
    if (pointers.current.size > 0) return;
    if (!p.on) { setGrabbing(false); return; }
    p.on = false;
    setGrabbing(false);
    const decay = 0.91;
    const go = () => {
      p.vx *= decay; p.vy *= decay;
      const { x, y } = clamp(p.ox + p.vx, p.oy + p.vy);
      p.ox = x; p.oy = y;
      setPos({ x, y });
      if (Math.abs(p.vx) > 0.35 || Math.abs(p.vy) > 0.35) p.raf = requestAnimationFrame(go);
    };
    p.raf = requestAnimationFrame(go);
  }, [clamp]);

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
              <li><span className={styles.hintLabel}>Move</span>Drag to explore, scroll or pinch to zoom</li>
              <li><span className={styles.hintLabel}>Read</span>Click any photo for the story</li>
              <li><span className={styles.hintLabel}>Play</span>Interact with the clock, compass, pinball, and tic-tac-toe</li>
              <li><span className={styles.hintLabel}>Hunt</span>Find the easter egg</li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <Minimap px={pos.x} py={pos.y} vw={vsRef.current.w} vh={vsRef.current.h} scale={scale} items={items} />

      <div
        ref={wrapRef}
        className={`${styles.immCanvas}${grabbing ? " " + styles.grabbing : ""}`}
        onPointerDown={onPD}
        onPointerMove={onPM}
        onPointerUp={onPU}
        onPointerLeave={onPU}
        onPointerCancel={onPU}
      >
        <div className={styles.immWall} style={{ transform: `translate(${pos.x}px,${pos.y}px) scale(${scale})` }}>
          <StringLights width={WALL_W} />
          <DustParticles dragPos={dragPointer} />
          <EditorGrid />
          {items.map((item, i) => (
            <WallItem
              key={item.id}
              item={item}
              dimmed={dragging !== null && dragging !== item.id}
              setDragging={setDragging}
              onAnyClick={onAnyClick}
              onDragMove={setDragPointer}
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
        <ConfettiOverlay
          onDone={() => {
            setShowConfetti(false);
          }}
        />
      )}

      {/* Photos-expired overlay — appears when any Notion-hosted image's
          1-hour signed URL has expired. Themed as a handwritten note on
          a cream paper card so it fits the wall vibe instead of feeling
          like a system error. */}
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
