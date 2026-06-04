"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import styles from "./Pinboard.module.css";
import { Pin, Tape } from "./Decorations";
import { BoardingPass, SubwayReceipt } from "./PaperItems";
import { useEditor, useEffectivePos } from "./PinboardEditor";

// ─── WallItem (immersive) ────────────────────────────────────
// Drag-to-rearrange, click-to-open. Reports the drag pointer
// position in WALL-LOCAL coordinates via `onDragMove` so the
// DustParticles canvas can scatter particles around it.
export function WallItem({
  item,
  dimmed,
  setDragging,
  onAnyClick,
  onDragMove, // (wallX, wallY) | null
  onImageError, // called when a dynamic (Notion-hosted) image fails to load
  devDelay,
  breatheDelay,
  sfx,
  wallPanRef, // ref containing { x, y } of the wall pan (so we can convert
              // viewport→wall coords without re-rendering)
}) {
  // Notion image URLs expire after ~1 hour. For dynamic items we wire
  // onError + loading="lazy"; curated photos are local and need neither.
  const imgProps = item._dynamic
    ? { onError: onImageError, loading: "lazy" }
    : {};
  const [zEl, setZEl] = useState(10);
  const dragRef = useRef({ active: false, lastReport: 0 });
  const dH = item.dH ? Math.round(item.dH * 1.12) : null;
  const dW =
    item.dH && item.w && item.h
      ? Math.round(item.dH * 1.12 * (item.w / item.h))
      : null;
  const isAged = item.sub === "aged";
  const pc = item.pinColor || "#c4a050";

  // ─── Editor wiring ───
  // Figma-style select-then-drag in edit mode ONLY:
  //   - click photo → selects (golden border)
  //   - click-and-hold the SELECTED photo → drag to move
  //   - click another photo → switches selection
  //   - click empty board → ImmersiveWall clears selection
  // In normal viewing (?edit=1 absent), drag is fully off — clicks open
  // their photo/poster modals as expected. No accidental drag-shove.
  const editor = useEditor();
  const editMode = !!editor?.enabled;
  const isSelected = editMode && editor?.selectedId === item.id;
  const dragEnabled = editMode && isSelected;
  const { x: effX, y: effY } = useEffectivePos(item);
  const motionX = useMotionValue(effX);
  const motionY = useMotionValue(effY);
  useEffect(() => {
    motionX.set(effX);
    motionY.set(effY);
  }, [effX, effY, motionX, motionY]);

  const innerStyle = (extra = {}) => ({
    animation: `pinboardBreathe 8s ease-in-out ${breatheDelay}s infinite`,
    ...extra,
  });
  const imgStyle = {
    display: "block",
    animation: `pinboardDevelop 1.5s ease ${devDelay}s both`,
  };

  // Convert a pointer event to wall-local coordinates by reading the current
  // pan offset off the shared ref. Cheap, no React state.
  const reportPointer = (e) => {
    if (!onDragMove) return;
    const now = performance.now();
    if (now - dragRef.current.lastReport < 16) return; // ~60fps cap
    dragRef.current.lastReport = now;
    const pan = wallPanRef?.current ?? { x: 0, y: 0 };
    onDragMove({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  // Capture native pointermove on the window while dragging so we can
  // forward scatter positions even when the pointer leaves the item.
  useEffect(() => {
    if (!dragRef.current.active) return;
    const onMove = (e) => reportPointer(e);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return (
    <motion.div
      className={styles.wallItem}
      drag={dragEnabled}
      dragElastic={editMode ? 0 : 0.07}
      dragMomentum={!editMode}
      // In edit mode: kill momentum AND the default `modifyTarget` (which
      // snaps to multiples of 50px) — we want exact coords for paste-into-
      // Notion. In normal mode: spring-out feel as before.
      dragTransition={
        editMode
          ? { power: 0, timeConstant: 0, modifyTarget: (v) => v }
          : { type: "spring", stiffness: 280, damping: 20 }
      }
      whileDrag={{ scale: editMode ? 1.04 : 1.07, zIndex: 200 }}
      onDragStart={(e) => {
        dragRef.current.active = true;
        setDragging(item.id);
        setZEl(100);
        sfx.playClick();
        reportPointer(e);
      }}
      onDrag={(e) => reportPointer(e)}
      onDragEnd={() => {
        dragRef.current.active = false;
        setDragging(null);
        setZEl(10);
        sfx.playThud();
        if (onDragMove) onDragMove(null);
        // In edit mode, commit the final position to the editor's
        // overrides so the panel reads it and you can copy it.
        if (editMode && editor) {
          editor.reportDragEnd(item.id, motionX.get(), motionY.get());
        }
      }}
      animate={{ opacity: dimmed ? 0.28 : 1, filter: dimmed ? "blur(3px)" : "none" }}
      transition={{ duration: 0.18 }}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        x: motionX,
        y: motionY,
        rotate: item.wr,
        zIndex: zEl,
        transformOrigin: item.mount === "pin" ? "top center" : "center center",
        // Visual feedback for the currently-selected item in edit mode.
        outline: isSelected ? "2px dashed rgba(196,160,80,0.95)" : undefined,
        outlineOffset: 4,
        // Cursor: in edit mode, signal "click me" on unselected items and
        // "grab me" on the selected one. Outside edit mode: clickable.
        cursor: editMode ? (isSelected ? "grab" : "pointer") : "pointer",
      }}
      // In edit mode: a tap (no drag) selects the item — gives instant
      // visual feedback in the panel that this item is the focus. The
      // tap-vs-drag distinction is framer-motion's: small movements call
      // onClick, larger ones fire drag instead.
      onClick={
        editMode
          ? (e) => { e.stopPropagation(); editor?.setSelectedId(item.id); }
          : () => onAnyClick(item)
      }
    >
      {item.mount === "pin" && <Pin color={pc} />}
      {item.mount === "tape" && <Tape />}
      {isAged && (
        <>
          <div className={`${styles.ctape} ${styles.tl}`} />
          <div className={`${styles.ctape} ${styles.tr}`} />
          <div className={`${styles.ctape} ${styles.bl}`} />
          <div className={`${styles.ctape} ${styles.br}`} />
        </>
      )}
      {item.type === "poster" && (
        <div className={styles.posterF} style={innerStyle()}>
          {/* draggable=false stops the browser hijacking the mousedown
              as a native image-drag (which prevents framer-motion's drag
              from engaging anywhere except the pin/tape). */}
          <img {...imgProps} draggable={false} src={item.src} style={{ ...imgStyle, width: dW, height: dH, objectFit: "cover" }} alt={item.label} />
        </div>
      )}
      {item.type === "photo" && (
        <div className={`${styles.photoF}${isAged ? " " + styles.aged : ""}`} style={innerStyle()}>
          <img {...imgProps} draggable={false} src={item.src} style={{ ...imgStyle, width: dW, height: dH, display: "block", objectFit: "cover" }} alt={item.label} />
          {isAged && <div className={styles.agedLbl}>{item.label}</div>}
        </div>
      )}
      {item.type === "boarding-pass" && <div style={innerStyle()}><BoardingPass /></div>}
      {item.type === "receipt" && <div style={innerStyle()}><SubwayReceipt /></div>}
    </motion.div>
  );
}

// ─── StaticItem (preview / section board) ────────────────────
// No drag, just hover-scale + click. `rotation` is driven through
// framer-motion's `rotate` motion prop (NOT via a CSS transform) so
// that whileHover can animate both rotate→0 and scale→1.05 together,
// and animate them back on un-hover. If we left rotate in style.transform
// it would get clobbered the moment framer takes over the transform
// property for the scale animation.
export function StaticItem({ item, onAnyClick, rotation = 0, style = {} }) {
  const dH = item.dH;
  const dW = item.w && item.h ? Math.round(dH * (item.w / item.h)) : null;
  const isAged = item.sub === "aged";
  const pc = item.pinColor || "#c4a050";

  return (
    <motion.div
      className={styles.item}
      style={style}
      onClick={() => onAnyClick(item)}
      initial={{ rotate: rotation, scale: 1 }}
      animate={{ rotate: rotation, scale: 1 }}
      whileHover={{ rotate: 0, scale: 1.05 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
    >
      {item.mount === "pin" && <Pin color={pc} />}
      {item.mount === "tape" && <Tape />}
      {isAged && (
        <>
          <div className={`${styles.ctape} ${styles.tl}`} />
          <div className={`${styles.ctape} ${styles.tr}`} />
          <div className={`${styles.ctape} ${styles.bl}`} />
          <div className={`${styles.ctape} ${styles.br}`} />
        </>
      )}
      {item.type === "poster" && (
        <div className={styles.posterF}>
          <img draggable={false} src={item.src} alt={item.label} style={{ width: dW, height: dH, objectFit: "cover" }} />
        </div>
      )}
      {item.type === "photo" && (
        <div className={`${styles.photoF}${isAged ? " " + styles.aged : ""}`}>
          <img draggable={false} src={item.src} alt={item.label} style={{ width: dW, height: dH, display: "block", objectFit: "cover" }} />
          {isAged && <div className={styles.agedLbl}>{item.label}</div>}
        </div>
      )}
      {item.type === "boarding-pass" && <BoardingPass />}
      {item.type === "receipt" && <SubwayReceipt />}
    </motion.div>
  );
}
