"use client";

// Minimal dev-only tuning surface for the personal Hero.
// Activate by adding ?tune=1 to the URL. In normal viewing the
// `<TunerBox>` wrappers short-circuit to render their children directly
// (no extra DOM, no event listeners) so this has zero production weight.
//
// Two coarse-grained boxes:
//   - left  → wraps the entire text column (eyebrow / name / bio / status)
//   - right → wraps the entire polaroid stack
//
// Drag anywhere on a box to move it (translateX / translateY in px).
// Drag the gold corner handle to scale it (uniform scale, 0.5–1.5).
// The floating panel shows live (x, y, scale) per box and dumps a
// `transform:` CSS pair to the clipboard so values can be baked back
// into Hero.module.css via a media query.

import { createContext, useContext, useEffect, useRef, useState } from "react";

const DEFAULT = { x: 0, y: 0, scale: 1 };
const TunerContext = createContext(null);

export function PersonalHeroTunerProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  const [boxes, setBoxes] = useState({
    left: { ...DEFAULT },
    right: { ...DEFAULT },
  });
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tune") === "1") setEnabled(true);
  }, []);

  const update = (id, patch) =>
    setBoxes((b) => ({ ...b, [id]: { ...b[id], ...patch } }));
  const reset = (id) =>
    setBoxes((b) => ({ ...b, [id]: { ...DEFAULT } }));
  const resetAll = () =>
    setBoxes({ left: { ...DEFAULT }, right: { ...DEFAULT } });

  return (
    <TunerContext.Provider
      value={{
        enabled, boxes, update, reset, resetAll,
        selectedId, setSelectedId, setEnabled,
      }}
    >
      {children}
      {enabled && <TunerPanel />}
    </TunerContext.Provider>
  );
}

export function usePersonalHeroTuner() {
  return useContext(TunerContext);
}

// Wraps a section. In tune mode: applies transform + outline + drag/resize
// affordances. Otherwise: passthrough — no DOM added.
export function TunerBox({ id, children }) {
  const tuner = usePersonalHeroTuner();
  const dragRef = useRef(null);

  if (!tuner?.enabled) return children;

  const box = tuner.boxes?.[id] ?? DEFAULT;
  const isSelected = tuner.selectedId === id;

  const onPointerDown = (e) => {
    if (e.target.closest("[data-tuner-resize]")) return;
    e.stopPropagation();
    tuner.setSelectedId(id);
    dragRef.current = {
      sx: e.clientX, sy: e.clientY,
      x: box.x, y: box.y,
    };
    const onMove = (ev) => {
      tuner.update(id, {
        x: dragRef.current.x + (ev.clientX - dragRef.current.sx),
        y: dragRef.current.y + (ev.clientY - dragRef.current.sy),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onResizePointerDown = (e) => {
    e.stopPropagation();
    tuner.setSelectedId(id);
    const startX = e.clientX;
    const startScale = box.scale;
    const onMove = (ev) => {
      const next = Math.max(0.5, Math.min(1.5, startScale + (ev.clientX - startX) * 0.005));
      tuner.update(id, { scale: next });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      data-tuner-id={id}
      style={{
        position: "relative",
        transform: `translate(${box.x}px, ${box.y}px) scale(${box.scale})`,
        transformOrigin: "center center",
        outline: isSelected
          ? "2px dashed rgba(196,160,80,0.95)"
          : "1px dashed rgba(196,160,80,0.4)",
        outlineOffset: 8,
        cursor: "move",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -26,
          left: 0,
          fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "rgba(196,160,80,0.9)",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        {id} · {Math.round(box.x)},{Math.round(box.y)} · ×{box.scale.toFixed(2)}
      </div>
      {children}
      {isSelected && (
        <div
          data-tuner-resize
          onPointerDown={onResizePointerDown}
          title="Drag to scale"
          style={{
            position: "absolute",
            right: -10,
            bottom: -10,
            width: 18,
            height: 18,
            background: "#c4a050",
            border: "2px solid #1a1410",
            borderRadius: 2,
            cursor: "nwse-resize",
            zIndex: 1000,
          }}
        />
      )}
    </div>
  );
}

function TunerPanel() {
  const tuner = usePersonalHeroTuner();
  const [copied, setCopied] = useState(false);

  const copyCSS = async () => {
    const css = [
      `/* personal hero — laptop tune values */`,
      `.typeCol  { transform: translate(${Math.round(tuner.boxes.left.x)}px, ${Math.round(tuner.boxes.left.y)}px) scale(${tuner.boxes.left.scale.toFixed(3)}); }`,
      `.photoCol { transform: translate(${Math.round(tuner.boxes.right.x)}px, ${Math.round(tuner.boxes.right.y)}px) scale(${tuner.boxes.right.scale.toFixed(3)}); }`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <strong style={{ color: "#c4a050", letterSpacing: "0.15em" }}>HERO TUNER</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={tuner.resetAll} style={S.btn}>RESET ALL</button>
          <button onClick={() => tuner.setEnabled(false)} style={S.btn}>HIDE</button>
        </div>
      </div>

      {["left", "right"].map((id) => {
        const b = tuner.boxes[id];
        const sel = tuner.selectedId === id;
        return (
          <div
            key={id}
            onClick={() => tuner.setSelectedId(id)}
            style={{
              padding: 8, marginBottom: 6,
              background: sel ? "rgba(196,160,80,0.12)" : "rgba(255,255,255,0.02)",
              border: `1px solid rgba(196,160,80,${sel ? 0.5 : 0.18})`,
              borderRadius: 3, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#c4a050", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {id === "left" ? "Text column" : "Polaroid column"}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); tuner.reset(id); }}
                style={{ ...S.btn, padding: "2px 6px", fontSize: 9 }}
              >RESET</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 20px 1fr 20px 1fr", gap: 4, alignItems: "center" }}>
              <label style={S.lbl}>x</label>
              <input
                type="number"
                value={Math.round(b.x)}
                onChange={(e) => tuner.update(id, { x: Number(e.target.value) })}
                onClick={(e) => e.stopPropagation()}
                style={S.inp}
              />
              <label style={S.lbl}>y</label>
              <input
                type="number"
                value={Math.round(b.y)}
                onChange={(e) => tuner.update(id, { y: Number(e.target.value) })}
                onClick={(e) => e.stopPropagation()}
                style={S.inp}
              />
              <label style={S.lbl}>×</label>
              <input
                type="number"
                step="0.05"
                value={b.scale.toFixed(2)}
                onChange={(e) => tuner.update(id, { scale: Number(e.target.value) })}
                onClick={(e) => e.stopPropagation()}
                style={S.inp}
              />
            </div>
          </div>
        );
      })}

      <button onClick={copyCSS} style={{ ...S.btn, width: "100%", padding: 8, marginTop: 8 }}>
        {copied ? "✓ COPIED CSS" : "COPY CSS"}
      </button>

      <div style={{ marginTop: 10, fontSize: 9, opacity: 0.55, lineHeight: 1.55 }}>
        Drag a box to move. Drag its gold corner to resize. Numeric inputs above accept exact values. Activate via <code style={{ color: "#c4a050" }}>?tune=1</code>.
      </div>
    </div>
  );
}

const S = {
  panel: {
    position: "fixed",
    bottom: 16,
    right: 16,
    width: 300,
    maxHeight: "85vh",
    overflowY: "auto",
    background: "rgba(8,6,4,0.95)",
    border: "1px solid rgba(196,160,80,0.45)",
    borderRadius: 4,
    padding: 10,
    color: "#e8dcc4",
    font: "11px/1.4 ui-monospace, 'JetBrains Mono', monospace",
    zIndex: 99999,
    backdropFilter: "blur(8px)",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(196,160,80,0.2)",
  },
  btn: {
    background: "rgba(196,160,80,0.1)",
    border: "1px solid rgba(196,160,80,0.4)",
    color: "#c4a050",
    font: "9px/1 ui-monospace, monospace",
    letterSpacing: "0.12em",
    padding: "4px 8px",
    cursor: "pointer",
    textTransform: "uppercase",
    borderRadius: 2,
  },
  lbl: { fontSize: 9, opacity: 0.6, textAlign: "center" },
  inp: {
    background: "rgba(196,160,80,0.05)",
    border: "1px solid rgba(196,160,80,0.2)",
    color: "#e8dcc4",
    font: "10px/1 ui-monospace, monospace",
    padding: "3px 5px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
};
