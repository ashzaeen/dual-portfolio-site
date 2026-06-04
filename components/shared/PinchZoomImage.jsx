"use client";

import { useEffect, useRef, useState } from "react";

// A lightbox image that always fits inside the viewport (object-contain, so a
// tall portrait is never cropped at the top) AND supports touch pinch-to-zoom
// + drag-to-pan on phones and double-tap / double-click to toggle zoom.
//
// Sizing trick: the <img> carries its own absolute max-width/max-height (vw/vh,
// never percentages — percentages would resolve against the shrink-wrapped
// wrapper and fight themselves). The wrapper shrink-wraps to the contained
// image and clips overflow, so a zoomed/panned image stays within its frame.
//
// Props:
//   maxW / maxH      — CSS length caps for the image (e.g. "92vw", "86vh").
//   wrapperClassName — class on the clipping wrapper (positioning/borders).
//   imgClassName     — class on the <img> (visual frame: border, shadow…).
//   maxScale         — ceiling for pinch/double-tap zoom (default 4).
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

  // Active touch/mouse pointers, the live pinch state, and last-tap timestamp.
  const pointers = useRef(new Map());
  const pinch = useRef({ dist: 0, midX: 0, midY: 0 });
  const lastTap = useRef(0);

  // New image → reset any prior zoom/pan.
  useEffect(() => {
    setT({ scale: 1, x: 0, y: 0 });
  }, [src]);

  const local = (clientX, clientY) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  // Scale toward a focal point (fx, fy in wrapper-local px) so the pixel under
  // the fingers/cursor stays put; panDx/panDy adds two-finger drag.
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
        m.x,
        m.y,
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
    if (pointers.current.size === 0) setGesturing(false);

    // Double-tap toggles zoom on touch (double-click handled separately below).
    if (e.pointerType === "touch") {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        const m = local(e.clientX, e.clientY);
        zoomTo(tRef.current.scale > 1 ? 1 : 2.5, m.x, m.y);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
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
        // inline-block (NOT flex): the wrapper shrink-wraps to the block image
        // below, which sizes itself via max-width + max-height + auto so its
        // aspect ratio is preserved exactly — no flex main/cross-axis clamp can
        // distort or mis-fit it. overflow:hidden clips the zoomed/panned image.
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
