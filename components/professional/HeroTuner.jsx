"use client";

// Dev-only live-tuning surface for the professional Hero.
// Activate by adding ?tune=1 to the URL. In normal viewing it's a no-op:
// <Tunable> short-circuits to render its children directly with no wrapper
// or listeners, so this file has zero production weight.
//
// When enabled: every <Tunable id="..."> wraps its children in a draggable
// outlined box. The floating panel (TunerPanel) lists every element with
// numeric inputs for x / y / size, plus a "Copy config" button that dumps
// JSON to the clipboard so you can bake the values back into Tailwind.

import { createContext, useContext, useEffect, useRef, useState } from "react";

// Default starting values match the current Tailwind sizes in Hero.jsx.
// Pixel values are read at the md+ breakpoint (the desktop/laptop layout).
export const DEFAULT_TUNE_CONFIG = {
  avatar:     { x: 0, y: 0, size: 192 },     // md:w-48 / md:h-48
  name:       { x: 0, y: 0, fontSize: 48 },  // md:text-[3rem]
  roles:      { x: 0, y: 0, fontSize: 12 },  // md:text-xs
  buttons:    { x: 0, y: 0, scale: 1 },
  stats:      { x: 0, y: 0, scale: 1 },
  liveStatus: { x: 0, y: 0, fontSize: 10 },  // md:text-[10px]
  ornament:   { x: 0, y: 0, fontSize: 18 },  // text-lg
  statusText: { x: 0, y: 0, fontSize: 17 },  // md:text-[17px]
};

// Which key the corner resize handle mutates per element. Buttons + stats
// resize via "scale" (whole-block multiplier); avatar via "size" (width/
// height in px, square); text via "fontSize" (px).
const SIZE_KEY = {
  avatar: "size",
  name: "fontSize",
  roles: "fontSize",
  buttons: "scale",
  stats: "scale",
  liveStatus: "fontSize",
  ornament: "fontSize",
  statusText: "fontSize",
};

const STORAGE_KEY = "hero-tune-v1";

const TunerContext = createContext(null);

export function TunerProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  const [config, setConfig] = useState(DEFAULT_TUNE_CONFIG);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tune") === "1") setEnabled(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = {};
        for (const k of Object.keys(DEFAULT_TUNE_CONFIG)) {
          merged[k] = { ...DEFAULT_TUNE_CONFIG[k], ...(parsed[k] || {}) };
        }
        setConfig(merged);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {}
  }, [config, enabled]);

  const updateConfig = (id, patch) =>
    setConfig(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const resetOne = (id) =>
    setConfig(prev => ({ ...prev, [id]: { ...DEFAULT_TUNE_CONFIG[id] } }));

  const resetAll = () => {
    setConfig(DEFAULT_TUNE_CONFIG);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const value = {
    enabled, setEnabled, config, updateConfig, resetOne, resetAll,
    selectedId, setSelectedId,
  };

  return (
    <TunerContext.Provider value={value}>
      {children}
      {enabled && <TunerPanel />}
    </TunerContext.Provider>
  );
}

export function useTuner() {
  return useContext(TunerContext);
}

// Wraps a Hero element. In normal mode: passthrough (returns children unchanged,
// no extra DOM). In tune mode: wraps in a div with dashed outline + drag/resize
// affordances. `className` is applied to the wrapper so parent layout classes
// (e.g. grid placement) still take effect on the wrapper rather than the child.
export function Tunable({ id, inline = false, className = "", children }) {
  const tuner = useTuner();
  const dragRef = useRef(null);

  if (!tuner?.enabled) return children;

  const c = tuner.config[id] || DEFAULT_TUNE_CONFIG[id];
  const isSel = tuner.selectedId === id;
  const sizeKey = SIZE_KEY[id];

  const onPointerDown = (e) => {
    if (e.target.closest("[data-tune-resize]")) return;
    e.stopPropagation();
    tuner.setSelectedId(id);
    dragRef.current = { sx: e.clientX, sy: e.clientY, cx: c.x, cy: c.y };
    const onMove = (ev) => {
      tuner.updateConfig(id, {
        x: dragRef.current.cx + (ev.clientX - dragRef.current.sx),
        y: dragRef.current.cy + (ev.clientY - dragRef.current.sy),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onResizeDown = (e) => {
    if (!sizeKey) return;
    e.stopPropagation();
    tuner.setSelectedId(id);
    const startVal = c[sizeKey];
    const sx = e.clientX;
    const onMove = (ev) => {
      const dx = ev.clientX - sx;
      let next;
      if (sizeKey === "size") {
        next = Math.max(40, Math.min(400, startVal + dx));
      } else if (sizeKey === "scale") {
        next = Math.max(0.3, Math.min(3, startVal + dx * 0.01));
      } else {
        next = Math.max(8, Math.min(160, startVal + dx * 0.5));
      }
      tuner.updateConfig(id, { [sizeKey]: next });
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
      className={className}
      style={{
        display: inline ? "inline-block" : "block",
        transform: `translate(${c.x}px, ${c.y}px)`,
        outline: isSel
          ? "2px dashed rgba(196,160,80,0.95)"
          : "1px dashed rgba(196,160,80,0.28)",
        outlineOffset: 4,
        position: "relative",
        cursor: "move",
        userSelect: "none",
      }}
      onPointerDown={onPointerDown}
      data-tune-id={id}
    >
      {children}
      {isSel && sizeKey && (
        <div
          data-tune-resize
          onPointerDown={onResizeDown}
          title={`Drag to change ${sizeKey}`}
          style={{
            position: "absolute",
            right: -10,
            bottom: -10,
            width: 16,
            height: 16,
            background: "#c4a050",
            border: "2px solid #1a1410",
            borderRadius: 2,
            cursor: "nwse-resize",
            zIndex: 9998,
          }}
        />
      )}
    </div>
  );
}

function TunerPanel() {
  const tuner = useTuner();
  const ids = Object.keys(DEFAULT_TUNE_CONFIG);
  const [copied, setCopied] = useState(false);

  const copyConfig = async () => {
    const text = JSON.stringify(tuner.config, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
    console.log("[hero-tune]\n" + text);
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

      {ids.map(id => {
        const c = tuner.config[id];
        const sk = SIZE_KEY[id];
        const isSel = tuner.selectedId === id;
        return (
          <div
            key={id}
            onClick={() => tuner.setSelectedId(id)}
            style={{
              padding: 8,
              marginBottom: 6,
              background: isSel ? "rgba(196,160,80,0.12)" : "rgba(255,255,255,0.02)",
              border: `1px solid rgba(196,160,80,${isSel ? 0.55 : 0.15})`,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: "#c4a050", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {id}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); tuner.resetOne(id); }}
                style={{ ...S.btn, padding: "2px 6px", fontSize: 9 }}
              >RESET</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 26px 1fr", gap: 4, alignItems: "center" }}>
              <label style={S.lbl}>x</label>
              <input type="number" value={Math.round(c.x)} onChange={(e) => tuner.updateConfig(id, { x: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} style={S.inp} />
              <label style={S.lbl}>y</label>
              <input type="number" value={Math.round(c.y)} onChange={(e) => tuner.updateConfig(id, { y: Number(e.target.value) })} onClick={(e) => e.stopPropagation()} style={S.inp} />
              {sk && (
                <>
                  <label style={S.lbl}>{sk === "scale" ? "scl" : sk === "size" ? "px" : "px"}</label>
                  <input
                    type="number"
                    step={sk === "scale" ? 0.05 : 1}
                    value={sk === "scale" ? Number(c[sk]).toFixed(2) : Math.round(c[sk])}
                    onChange={(e) => tuner.updateConfig(id, { [sk]: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    style={S.inp}
                  />
                  <span />
                  <span />
                </>
              )}
            </div>
          </div>
        );
      })}

      <button onClick={copyConfig} style={{ ...S.btn, width: "100%", padding: 8, marginTop: 8 }}>
        {copied ? "✓ COPIED" : "COPY CONFIG (JSON)"}
      </button>

      <div style={{ marginTop: 10, fontSize: 9, opacity: 0.55, lineHeight: 1.55 }}>
        Drag any element to move. Drag gold corner handle to resize. Click to select. Activated via <code style={{ color: "#c4a050" }}>?tune=1</code>.
      </div>
    </div>
  );
}

const S = {
  panel: {
    position: "fixed",
    bottom: 12,
    right: 12,
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
