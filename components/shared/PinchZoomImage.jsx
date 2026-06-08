"use client";

import { useEffect, useRef, useState } from "react";

// A lightbox image that fits inside the viewport and supports:
//   • Touch pinch-to-zoom (stays zoomed — doesn't auto-reset on release)
//   • Single-finger pan while zoomed
//   • Double-tap to toggle zoom (single-touch only, never on pinch release)
//   • Double-click to toggle zoom (desktop)
//
// Sizing: the <img> carries its own absolute max-width/max-height so its
// aspect ratio is preserved exactly. The wrapper shrink-wraps and clips
// overflow, keeping a zoomed/panned image within its frame.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function PinchZoomImage({
  src,
  alt = "",
  maxW = "100%",
  maxH = "100%",
  wrapperClassName = "",
  imgClassName = "",
  maxScale = 4,
}) {
  const wrapRef = useRef(null);
  const [t, setT] = useState({ scale: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const [gesturing, setGesturing] = useState(false);

  const pointers = useRef(new Map());
  const pinch = useRef({ dist: 0, midX: 0, midY: 0 });
  const lastTap = useRef(0);
  // Track whether the current gesture involved 2+ fingers. If it did, we
  // must not fire the double-tap handler on the final pointer-up — otherwise
  // the two rapid lift events from a pinch look like a double-tap and snap
  // zoom back to 1 immediately after the user zoomed in.
  const wasPinch = useRef(false);

  useEffect(() => {
    setT({ scale: 1, x: 0, y: 0 });
  }, [src]);

  const local = (clientX, clientY) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const zoomTo = (nextScale, fx, fy, panDx = 0, panDy = 0) => {
    setT((prev) => {
      const s1 = clamp(nextScale, 1, maxScale);
      const k = s1 / prev.scale;
      if (s1 === 1) return { scale: 1, x: 0, y: 0 };
      return {
        scale: s1,
        x: fx - k * (fx - prev.x) + panDx,
        y: fy - k * (fy - prev.y) + panDy,
      };
    });
  };

  const onPointerDown = (e) => {
    wrapRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    if (pointers.current.size === 2) {
      wasPinch.current = true; // mark so pointer-up skips double-tap check
      const [a, b] = [...pointers.current.values()];
      pinch.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
      const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current.midX = m.x;
      pinch.current.midY = m.y;
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const prevDist = pinch.current.dist || dist;
      zoomTo(
        tRef.current.scale * (dist / prevDist),
        m.x, m.y,
        m.x - pinch.current.midX,
        m.y - pinch.current.midY
      );
      pinch.current = { dist, midX: m.x, midY: m.y };
    } else if (pointers.current.size === 1 && tRef.current.scale > 1) {
      setT((p) => ({ ...p, x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current.dist = 0;

    const allGone = pointers.current.size === 0;
    if (allGone) {
      setGesturing(false);
      const pinchGesture = wasPinch.current;
      wasPinch.current = false; // reset for next gesture

      // Double-tap to toggle zoom — only on deliberate single-touch taps,
      // never when the last lift is part of a pinch release.
      if (e.pointerType === "touch" && !pinchGesture) {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          const m = local(e.clientX, e.clientY);
          zoomTo(tRef.current.scale > 1 ? 1 : 2.5, m.x, m.y);
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
    }
  };

  const onDoubleClick = (e) => {
    const m = local(e.clientX, e.clientY);
    zoomTo(tRef.current.scale > 1 ? 1 : 2.5, m.x, m.y);
  };

  return (
    <div
      ref={wrapRef}
      className={wrapperClassName}
      style={{
        display: "inline-block",
        verticalAlign: "top",
        overflow: "hidden",
        lineHeight: 0,
        maxWidth: maxW,
        maxHeight: maxH,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={imgClassName}
        style={{
          display: "block",
          maxWidth: maxW,
          maxHeight: maxH,
          width: "auto",
          height: "auto",
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          transformOrigin: "0 0",
          transition: gesturing ? "none" : "transform 0.2s ease-out",
          cursor: t.scale > 1 ? "grab" : "zoom-in",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
        }}
      />
    </div>
  );
}
