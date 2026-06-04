"use client";

// Hidden coordinate-discovery editor for the immersive wall.
// Activate by appending ?edit=1 to the URL (e.g. /personal?edit=1).
//
// When active:
//   - All wall items become directly draggable (no click-through to modals)
//   - A floating panel shows live (x, y) for every wall item
//   - A 200px grid + axis ruler overlay makes the coordinate system visible
//   - Mouse position readout (in WALL coordinates) follows the cursor
//   - Per-item "copy" buttons drop the coords on the clipboard so you can
//     paste them into the Notion `Wall X` / `Wall Y` columns
//
// Workflow:
//   1. Add photo to Notion → appears via auto-placement
//   2. Visit /personal?edit=1
//   3. Open the wall, drag the photo where you want it
//   4. Copy its coords from the panel
//   5. Paste into Notion's Wall X / Wall Y for that photo
//   6. Refresh — Notion override now takes precedence over auto-place
//
// Editor state is ephemeral (session only). The intent is "discover
// coordinates, write them down in Notion." Page reload = fresh start
// from current Notion data.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Pinboard.module.css";
import { WALL_W, WALL_H } from "@/data/pinboard";

const EditorContext = createContext(null);

export function PinboardEditorProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  // Map item.id → { x, y } for any item the user has dragged this session.
  // The "live" rendered position is `override ?? item.wx/wy`.
  const [overrides, setOverrides] = useState({});
  const [showGrid, setShowGrid] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") === "1") setEnabled(true);
  }, []);

  const reportDragEnd = useCallback((id, x, y) => {
    setOverrides((prev) => ({ ...prev, [id]: { x: Math.round(x), y: Math.round(y) } }));
    setSelectedId(id);
  }, []);

  const resetItem = useCallback((id) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides({});
    setSelectedId(null);
  }, []);

  const value = {
    enabled,
    overrides,
    showGrid,
    selectedId,
    setSelectedId,
    reportDragEnd,
    resetItem,
    resetAll,
    setShowGrid,
    setEnabled,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  return useContext(EditorContext);
}

// Effective position for an item, factoring in any in-session drag override.
export function useEffectivePos(item) {
  const editor = useEditor();
  const o = editor?.overrides?.[item.id];
  return {
    x: o?.x ?? item.wx,
    y: o?.y ?? item.wy,
  };
}

// ── Grid + ruler overlay ─────────────────────────────────────
// Rendered inside the wall canvas behind items. 200px grid; emphasized
// every 1000px so it's easy to read off coordinates by eye.
export function EditorGrid() {
  const editor = useEditor();
  if (!editor?.enabled || !editor.showGrid) return null;

  const minor = [];
  for (let x = 200; x < WALL_W; x += 200) minor.push({ orient: "v", at: x });
  for (let y = 200; y < WALL_H; y += 200) minor.push({ orient: "h", at: y });

  const major = [];
  for (let x = 1000; x < WALL_W; x += 1000) major.push({ orient: "v", at: x });
  for (let y = 1000; y < WALL_H; y += 1000) major.push({ orient: "h", at: y });

  // Initial-frame box (200,150) — (1620,1030)
  const initialFrame = { x: 200, y: 150, w: 1420, h: 880 };

  return (
    <svg
      className={styles.editorGrid}
      width={WALL_W}
      height={WALL_H}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 4 }}
    >
      {minor.map((l, i) =>
        l.orient === "v" ? (
          <line key={`mv${i}`} x1={l.at} y1="0" x2={l.at} y2={WALL_H} stroke="rgba(196,160,80,0.07)" strokeWidth="1" />
        ) : (
          <line key={`mh${i}`} x1="0" y1={l.at} x2={WALL_W} y2={l.at} stroke="rgba(196,160,80,0.07)" strokeWidth="1" />
        )
      )}
      {major.map((l, i) =>
        l.orient === "v" ? (
          <g key={`Mv${i}`}>
            <line x1={l.at} y1="0" x2={l.at} y2={WALL_H} stroke="rgba(196,160,80,0.16)" strokeWidth="1" />
            <text x={l.at + 6} y="20" fill="rgba(196,160,80,0.55)" fontSize="11" fontFamily="var(--font-mono)">
              x={l.at}
            </text>
          </g>
        ) : (
          <g key={`Mh${i}`}>
            <line x1="0" y1={l.at} x2={WALL_W} y2={l.at} stroke="rgba(196,160,80,0.16)" strokeWidth="1" />
            <text x="10" y={l.at - 6} fill="rgba(196,160,80,0.55)" fontSize="11" fontFamily="var(--font-mono)">
              y={l.at}
            </text>
          </g>
        )
      )}
      {/* Initial visible frame */}
      <rect
        x={initialFrame.x}
        y={initialFrame.y}
        width={initialFrame.w}
        height={initialFrame.h}
        fill="none"
        stroke="rgba(196,160,80,0.32)"
        strokeWidth="2"
        strokeDasharray="8 6"
      />
      <text
        x={initialFrame.x + 8}
        y={initialFrame.y + 18}
        fill="rgba(196,160,80,0.7)"
        fontSize="10"
        fontFamily="var(--font-mono)"
        letterSpacing="1.5"
      >
        INITIAL FRAME ({initialFrame.x},{initialFrame.y})
      </text>
    </svg>
  );
}

// ── Floating panel ─────────────────────────────────────────
// Shows live coords for every wall item, lets you copy them, lets you
// reload data from Notion, etc.
export function EditorPanel({ items }) {
  const editor = useEditor();
  const router = useRouter();
  const [copied, setCopied] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, on: false });
  // Track mouse in WALL coordinates by reading the wall element's bounding
  // rect. Cheap, only runs when panel is shown.
  useEffect(() => {
    if (!editor?.enabled) return;
    const onMove = (e) => {
      const wall = document.querySelector(`.${styles.immWall}`);
      if (!wall) return;
      const rect = wall.getBoundingClientRect();
      setMouse({
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
        on: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom,
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [editor?.enabled]);

  if (!editor?.enabled) return null;

  const copy = async (id, x, y) => {
    try {
      await navigator.clipboard.writeText(`${x}, ${y}`);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1300);
    } catch {}
  };

  const copyAll = async () => {
    const json = JSON.stringify(
      items.map((i) => {
        const o = editor.overrides[i.id];
        return {
          id: i.id,
          label: i.label || i.id,
          wallX: o?.x ?? i.wx,
          wallY: o?.y ?? i.wy,
        };
      }),
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(json);
      setCopied("__all__");
      setTimeout(() => setCopied((c) => (c === "__all__" ? null : c)), 1300);
    } catch {}
  };

  // Sort: items currently displaced (by drag) first, then by label.
  const sorted = [...items]
    .filter((i) => i.wx != null)
    .sort((a, b) => {
      const ao = editor.overrides[a.id] ? 0 : 1;
      const bo = editor.overrides[b.id] ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.label || a.id).localeCompare(b.label || b.id);
    });

  return (
    <div className={styles.editorPanel}>
      <div className={styles.editorHeader}>
        <strong style={{ color: "#c4a050", letterSpacing: "0.16em" }}>WALL EDITOR</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => editor.setShowGrid(!editor.showGrid)} className={styles.editorBtn}>
            {editor.showGrid ? "HIDE GRID" : "GRID"}
          </button>
          <button onClick={() => router.refresh()} className={styles.editorBtn} title="Re-fetch from Notion">
            RELOAD
          </button>
          <button onClick={() => editor.setEnabled(false)} className={styles.editorBtn}>
            HIDE
          </button>
        </div>
      </div>

      <div className={styles.editorCoords}>
        <span>cursor:</span>
        <span className={styles.editorMono}>
          {mouse.on ? `${mouse.x}, ${mouse.y}` : "—"}
        </span>
      </div>

      <div className={styles.editorList}>
        {sorted.map((item) => {
          const o = editor.overrides[item.id];
          const x = o?.x ?? item.wx;
          const y = o?.y ?? item.wy;
          const moved = !!o;
          const sel = editor.selectedId === item.id;
          return (
            <div
              key={item.id}
              className={`${styles.editorRow}${moved ? " " + styles.editorRowMoved : ""}${sel ? " " + styles.editorRowSel : ""}`}
              onClick={() => editor.setSelectedId(item.id)}
            >
              <div className={styles.editorRowName} title={item.id}>
                {item.label || item.id}
              </div>
              <div className={styles.editorRowCoords}>
                <span>{x}</span>
                <span style={{ opacity: 0.4 }}>,</span>
                <span>{y}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); copy(item.id, x, y); }}
                className={styles.editorBtn}
              >
                {copied === item.id ? "✓" : "COPY"}
              </button>
              {moved && (
                <button
                  onClick={(e) => { e.stopPropagation(); editor.resetItem(item.id); }}
                  className={styles.editorBtn}
                  title="Reset to original"
                >
                  ↺
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.editorFooter}>
        <button onClick={copyAll} className={styles.editorBtn}>
          {copied === "__all__" ? "✓ COPIED" : "COPY ALL JSON"}
        </button>
        <button onClick={editor.resetAll} className={styles.editorBtn}>
          RESET ALL
        </button>
      </div>

      <div className={styles.editorHint}>
        Drag any item to move it. Coords update live. Copy → paste into Notion&apos;s Wall X / Wall Y.
      </div>
    </div>
  );
}
