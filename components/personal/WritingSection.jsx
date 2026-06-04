"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CAT_COLORS } from "@/data/pieces";
import { FALLBACK_DESK } from "@/data/desk";
import ScrollReveal from "@/components/shared/ScrollReveal";
import ViewMore from "@/components/shared/ViewMore";
import SectionGuide from "@/components/shared/SectionGuide";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import AllWritingsArchive from "./AllWritingsArchive";
import WritingReader from "./writing/WritingReader";
import styles from "./WritingSection.module.css";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";

const SLUG_PATTERN = /^\/personal\/writing\/([^/]+)/;

/* ── Desk decoration components ─────────────────────────── */

function WoodGrain({ opacity = 0.7 }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity,
        background: [
          "repeating-linear-gradient(172deg, rgba(20,12,4,0.18) 0 1px, transparent 1px 5px)",
          "repeating-linear-gradient(168deg, rgba(20,12,4,0.10) 0 2px, transparent 2px 23px)",
          "repeating-linear-gradient(176deg, rgba(255,220,170,0.04) 0 1px, transparent 1px 9px)",
          "linear-gradient(180deg, #4a3422 0%, #3a2a1a 40%, #2a1c10 100%)",
        ].join(", "),
      }}
    />
  );
}

function InkBottle({ level = 0.7, label = "ACTIVE" }) {
  return (
    <div style={{ position: "relative", width: 56, height: 70, filter: "drop-shadow(0 4px 8px rgba(20,12,4,0.55))" }}>
      <div style={{ position: "absolute", top: 0, left: 14, right: 14, height: 14, background: "linear-gradient(180deg, #1a1208 0%, #0a0604 100%)", borderRadius: "3px 3px 0 0", border: "1px solid rgba(196,160,80,0.35)" }} />
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, bottom: 0, background: "linear-gradient(180deg, #1f1610 0%, #0a0604 100%)", borderRadius: "4px 4px 8px 8px", border: "1px solid rgba(196,160,80,0.35)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${level * 100}%`, background: "linear-gradient(180deg, #1c1a35 0%, #0e0c25 100%)", opacity: 0.92 }} />
        <div style={{ position: "absolute", top: "32%", left: 4, right: 4, padding: "3px 0", background: "linear-gradient(180deg, #d8b870 0%, #a07838 100%)", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 6.5, letterSpacing: "0.16em", color: "#15110c", borderRadius: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function DeskLamp({ on = true }) {
  return (
    <div style={{ position: "relative", width: 90, height: 110 }}>
      <div style={{ position: "absolute", bottom: 0, left: 18, width: 54, height: 12, borderRadius: "50%", background: "linear-gradient(180deg, #2a1e10 0%, #15110c 100%)", boxShadow: "0 3px 6px rgba(0,0,0,0.55)" }} />
      <svg viewBox="0 0 90 110" width="90" height="110" style={{ position: "absolute", inset: 0 }}>
        <line x1="45" y1="98" x2="45" y2="50" stroke="#1f1610" strokeWidth="3" strokeLinecap="round" />
        <line x1="45" y1="50" x2="22" y2="22" stroke="#1f1610" strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="50" r="3.5" fill="#c4a050" />
        <path d="M 6 22 L 38 22 L 32 38 L 12 38 Z" fill="url(#shadeGrad)" stroke="#15110c" strokeWidth="1.2" strokeLinejoin="round" />
        <defs>
          <linearGradient id="shadeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a1a" />
            <stop offset="100%" stopColor="#1a1208" />
          </linearGradient>
        </defs>
        {on && <ellipse cx="22" cy="38" rx="10" ry="2" fill="#c4a050" opacity="0.6" />}
      </svg>
    </div>
  );
}

function TeaCup({ empty = false }) {
  return (
    <div className={`${styles.teaCupRoot} ${empty ? styles.teaCupEmpty : ""}`}>
      {!empty && (
        <div className={styles.steam} aria-hidden="true">
          <span className={styles.steamWisp} style={{ left: "30%", animationDelay: "0s" }} />
          <span className={styles.steamWisp} style={{ left: "50%", animationDelay: "0.7s" }} />
          <span className={styles.steamWisp} style={{ left: "68%", animationDelay: "1.3s" }} />
        </div>
      )}
      {/* saucer outer ring */}
      <div style={{ position: "absolute", inset: -4, borderRadius: "50%", background: "radial-gradient(circle, transparent 38%, rgba(80,45,15,0.18) 41%, rgba(80,45,15,0.08) 46%, transparent 52%)" }} />
      {/* saucer */}
      <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #efe5d0 0%, #d8c8a8 70%, #b8a888 100%)", boxShadow: "0 6px 14px rgba(20,12,4,0.45), inset 0 0 6px rgba(80,55,18,0.18)" }} />
      {/* cup */}
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, bottom: 14, borderRadius: "50%", background: "linear-gradient(180deg, #f5f0e8 0%, #e0d3b8 100%)", boxShadow: "inset 0 -2px 4px rgba(80,55,18,0.2), 0 2px 4px rgba(20,12,4,0.35)", border: "1px solid rgba(160,120,56,0.35)", overflow: "hidden" }}>
        {/* interior — tea or clean ceramic */}
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "50%",
            background: empty
              ? "radial-gradient(circle at 35% 30%, #efe5d0 0%, #d8c4a4 60%, #b89878 100%)"
              : "radial-gradient(circle at 35% 30%, #6b3a18 0%, #4a2510 60%, #2a1408 100%)",
            boxShadow: empty
              ? "inset 0 0 6px rgba(120,80,30,0.35)"
              : "inset 0 0 6px rgba(0,0,0,0.55)",
            transition: "background 0.35s ease, box-shadow 0.35s ease",
          }}
        />
        {/* highlight */}
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, rgba(255,240,210,0.18) 0%, transparent 40%)" }} />
      </div>
    </div>
  );
}

function WaxLetter({ rotation = -8, color = "#7a2a2a" }) {
  return (
    <div style={{ position: "relative", width: 130, height: 88, transform: `rotate(${rotation}deg)`, filter: "drop-shadow(2px 4px 8px rgba(20,12,4,0.4))" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #e8dcc0 0%, #d0c0a0 100%)", borderRadius: 2, border: "1px solid rgba(120,80,30,0.3)" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(120,80,30,0.18)" }} />
      <div style={{ position: "absolute", top: 12, left: 14, fontFamily: "var(--font-note)", fontSize: 11, color: "rgba(60,40,15,0.55)", fontStyle: "italic", lineHeight: 1.1 }}>To A.</div>
      <div style={{ position: "absolute", bottom: -8, right: -6, width: 28, height: 28, borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, ${color} 0%, ${color}cc 60%, ${color}88 100%)`, boxShadow: "0 2px 4px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-serif)", fontWeight: 600, fontStyle: "italic", color: "rgba(245,240,232,0.85)", fontSize: 14 }}>A</div>
    </div>
  );
}

/* ── Polaroid ─────────────────────────────────────────────
   Square photo area (size × size) with age toning, vignette,
   warm light leak, and SVG film grain. */
function Polaroid({ rotation = 4, src = null, caption = "", size = 100, alt = "", onClick = null, hovered = false, index = null }) {
  const padH = 7, padV = 7, captionH = 30;
  const frameW = size + padH * 2;
  const frameH = size + padV + captionH;
  const uid = useMemo(() => Math.random().toString(36).slice(2), []);

  return (
    // Single transformed root carries rotation + lift + scale together AND the
    // `data-polaroid` marker. Because rotation lives on this same element,
    // pointer hit-testing (which the parent does via elementsFromPoint) matches
    // the rotated, lifted *visible* shape — not an axis-aligned bounding box —
    // so an overlapping sibling can never be "picked" while you point at this
    // one. No mouseenter/leave here; the parent owns hover via pointer geometry.
    <div
      data-polaroid={index == null ? undefined : index}
      onClick={onClick || undefined}
      style={{
        position: "relative",
        width: frameW,
        height: frameH,
        cursor: onClick ? "pointer" : "default",
        transform: `translateY(${hovered ? -6 : 0}px) rotate(${rotation}deg) scale(${hovered ? 1.03 : 1})`,
        transformOrigin: "center center",
        willChange: "transform, filter",
        transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        filter: `drop-shadow(0 2px 3px rgba(20,12,4,0.38))
                 drop-shadow(2px 8px 16px rgba(20,12,4,${hovered ? "0.44" : "0.28"}))`,
      }}
    >
      <div
        style={{
          width: frameW,
          height: frameH,
          background: "#ede4c8",
          padding: `${padV}px ${padH}px 0`,
          borderRadius: 2,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* age toning — warm yellowing toward edges */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 4,
            background: `radial-gradient(ellipse at 18% 90%, rgba(140,95,30,0.11) 0%, transparent 52%),
                         radial-gradient(ellipse at 82% 8%, rgba(140,95,30,0.07) 0%, transparent 42%),
                         radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(20,12,4,0.06) 100%)`,
          }}
        />

        {/* photo area */}
        <div
          style={{
            width: size,
            height: size,
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #8a7050, #5a4020)",
          }}
        >
          {src && (
            <img
              src={src}
              alt={alt || caption}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
                filter:
                  "sepia(0.32) contrast(1.05) saturate(0.72) brightness(0.96) hue-rotate(3deg)",
              }}
            />
          )}
          {/* vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse at 50% 46%, transparent 35%, rgba(12,6,2,0.48) 100%)",
            }}
          />
          {/* warm light leak — top-left */}
          <div
            style={{
              position: "absolute",
              top: -10,
              left: -10,
              width: "65%",
              height: "60%",
              background:
                "radial-gradient(circle, rgba(255,148,48,0.19) 0%, transparent 68%)",
              mixBlendMode: "screen",
              pointerEvents: "none",
            }}
          />
          {/* film grain */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: 0.48,
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          >
            <filter id={`grain-${uid}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.80" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#grain-${uid})`} />
          </svg>
        </div>

        {/* caption strip */}
        <div
          style={{
            height: captionH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-note), Cambria, Georgia, serif",
              fontSize: 13,
              color: "rgba(38,24,8,0.62)",
              fontStyle: "italic",
              letterSpacing: "0.02em",
            }}
          >
            {caption}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Polaroid Modal ─────────────────────────────────────── */
function PolaroidModal({ polaroid, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(14,8,2,0.80)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "polFadeIn 0.28s ease",
      }}
    >
      <style>{`
        @keyframes polFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes polDrop {
          from { opacity: 0; transform: rotate(-2deg) scale(0.82) translateY(-32px); }
          to   { opacity: 1; transform: rotate(-1.5deg) scale(1) translateY(0); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "polDrop 0.52s cubic-bezier(0.34,1.45,0.64,1)",
          transform: "rotate(-1.5deg)",
        }}
      >
        <Polaroid
          src={polaroid.src}
          caption={polaroid.caption}
          alt={polaroid.alt}
          size={300}
          rotation={0}
        />
        <div
          style={{
            marginTop: 22,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(235,220,190,0.45)",
          }}
        >
          esc · or click anywhere to close
        </div>
      </div>
    </div>
  );
}

function FountainPen({ rotation = 32 }) {
  return (
    <div
      style={{
        position: "relative",
        width: 145,
        height: 22,
        transform: `rotate(${rotation}deg)`,
        filter: "drop-shadow(2px 3px 6px rgba(20,12,4,0.55))",
      }}
    >
      <svg viewBox="0 0 145 22" width="145" height="22">
        <defs>
          <linearGradient id="nibGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8c870" />
            <stop offset="100%" stopColor="#a07838" />
          </linearGradient>
          <linearGradient id="barrelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2a1a" />
            <stop offset="50%" stopColor="#1f1610" />
            <stop offset="100%" stopColor="#0a0604" />
          </linearGradient>
        </defs>
        <path d="M 0 11 L 22 5 L 22 17 Z" fill="url(#nibGrad)" stroke="#15110c" strokeWidth="0.6" />
        <line x1="3" y1="11" x2="20" y2="11" stroke="#15110c" strokeWidth="0.5" />
        <rect x="22" y="6" width="14" height="10" fill="#1f1610" />
        <rect x="36" y="5" width="78" height="12" rx="2" fill="url(#barrelGrad)" stroke="#0a0604" strokeWidth="0.5" />
        <rect x="34" y="5" width="3" height="12" fill="#c4a050" />
        <rect x="113" y="5" width="3" height="12" fill="#c4a050" />
        <rect x="116" y="5" width="26" height="12" rx="2" fill="#1f1610" />
        <rect x="120" y="2" width="2" height="10" rx="1" fill="#c4a050" />
      </svg>
    </div>
  );
}

function IndexCardStack({ rotation = -6, count = 4, lines = [] }) {
  return (
    <div style={{ position: "relative", width: 130, height: 88, transform: `rotate(${rotation}deg)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ position: "absolute", inset: 0, background: "#f5f0e8", border: "1px solid rgba(160,120,56,0.25)", borderTop: "8px solid rgba(196,160,80,0.4)", transform: `translate(${i * 1.6}px, ${i * 1.2}px) rotate(${i * 1.5 - 2}deg)`, boxShadow: "1px 3px 6px rgba(20,12,4,0.28)", padding: "10px 10px 6px", fontFamily: "var(--font-note)", fontSize: 11, color: i === count - 1 ? "rgba(40,28,12,0.78)" : "rgba(40,28,12,0)", lineHeight: 1.35, backgroundImage: i === count - 1 ? "repeating-linear-gradient(180deg, transparent 0 14px, rgba(160,120,56,0.18) 14px 15px)" : undefined, overflow: "hidden" }}>
          {i === count - 1 && lines.map((l, j) => <div key={j}>{l}</div>)}
        </div>
      ))}
    </div>
  );
}

function HiddenNotes({ notes = FALLBACK_DESK.hiddenNotes }) {
  const left = notes?.left ?? FALLBACK_DESK.hiddenNotes.left;
  const right = notes?.right ?? FALLBACK_DESK.hiddenNotes.right;
  return (
    <div style={{ position: "relative", width: 240, height: 180, filter: "drop-shadow(3px 6px 14px rgba(20,12,4,0.45))" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 28, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", background: "linear-gradient(95deg, #ddd1b0 0%, #ede5d0 95%)", borderRadius: "4px 1px 1px 4px", boxShadow: "inset -6px 0 8px rgba(80,55,18,0.18)", backgroundImage: "repeating-linear-gradient(180deg, transparent 0 18px, rgba(160,120,56,0.16) 18px 19px)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%", background: "linear-gradient(265deg, #ddd1b0 0%, #ede5d0 95%)", borderRadius: "1px 4px 4px 1px", boxShadow: "inset 6px 0 8px rgba(80,55,18,0.18)", backgroundImage: "repeating-linear-gradient(180deg, transparent 0 18px, rgba(160,120,56,0.16) 18px 19px)" }} />
      <div style={{ position: "absolute", top: 41, left: 14, fontFamily: "var(--font-note)", fontSize: 14, color: "rgba(40,28,12,0.78)", lineHeight: "19px", fontStyle: "italic", width: "44%" }}>
        {left.heading && (
          <div style={{ fontSize: 16, marginBottom: 6 }}>{left.heading}</div>
        )}
        {left.lines.map((l, i) => <div key={i}>{l}</div>)}
        <div style={{ marginTop: 4, color: "rgba(122,72,88,0.85)" }}>✦</div>
      </div>
      <div style={{ position: "absolute", top: 41, right: 14, fontFamily: "var(--font-serif)", fontSize: 13, fontStyle: "italic", color: "rgba(40,28,12,0.7)", lineHeight: "19px", width: "44%" }}>
        {right.heading && (
          <div style={{ fontFamily: "var(--font-note)", fontSize: 16, marginBottom: 6 }}>{right.heading}</div>
        )}
        {right.lines.map((l, i) => (
          <div key={i} style={i > 0 ? { marginTop: 6 } : undefined}>{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ── Paper card (desktop) ────────────────────────────────── */
function PaperCard({ piece, onClick }) {
  const [hov, setHov] = useState(false);
  const cat = CAT_COLORS[piece.type];
  return (
    <div
      data-deskpaper=""
      onClick={() => onClick(piece)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "absolute",
        left: `${piece.pos.x * 100}%`,
        top: `${piece.pos.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) ${hov ? "scale(1.03) translateY(-6px)" : "scale(1)"}`,
        transition: "transform 0.35s cubic-bezier(0.34,1.48,0.64,1), box-shadow 0.3s ease",
        cursor: "pointer",
        pointerEvents: "auto",
        zIndex: hov ? 100 : piece.z,
        width: 220,
        background: hov ? "#f5f0e8" : "#ede5d0",
        padding: "1rem 1.1rem 1.2rem",
        boxShadow: hov
          ? "6px 12px 28px rgba(20,12,4,0.45), 1px 2px 6px rgba(20,12,4,0.3)"
          : "3px 6px 14px rgba(20,12,4,0.4), 1px 2px 4px rgba(20,12,4,0.25)",
        border: `1px solid ${hov ? "var(--gold)" : "rgba(160,120,56,0.2)"}`,
        borderRadius: 1,
        backgroundImage: "linear-gradient(180deg, transparent 0 8px, rgba(160,120,56,0.04) 8px 9px)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(90deg, transparent 0 2px, rgba(120,80,30,0.02) 2px 3px)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: -1, transform: "translate(3px, 4px) rotate(2deg)", background: "#ede5d0", border: "1px solid rgba(160,120,56,0.15)", boxShadow: "1px 2px 4px rgba(20,12,4,0.18)" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: -2, transform: "translate(-3px, 6px) rotate(-1.5deg)", background: "#e0d4ba", border: "1px solid rgba(160,120,56,0.12)", boxShadow: "1px 2px 4px rgba(20,12,4,0.14)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: cat.accent, borderRadius: "1px 0 0 1px" }} />
      <div style={{ position: "relative", paddingLeft: "0.6rem" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: cat.deep, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "0.4rem" }}>
          {piece.publication} · {piece.date}
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontStyle: "italic", fontSize: "1.05rem", color: "var(--ink)", lineHeight: 1.18, marginBottom: "0.5rem" }}>
          {piece.title}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", fontSize: "0.72rem", color: "var(--ink-mid)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {piece.excerpt}
        </div>
        <div style={{ marginTop: "0.6rem", fontFamily: "var(--font-mono)", fontSize: "0.5rem", color: hov ? cat.deep : "var(--ink-faint)", letterSpacing: "0.14em", transition: "color 0.25s ease" }}>
          {hov ? "→ pick up" : `${piece.pages} pages`}
        </div>
      </div>
    </div>
  );
}

/* ── Desktop ─────────────────────────────────────────────── */
function WritingDesktop({ featured, desk, onViewMore, openPiece, copy }) {
  const polaroid1 = desk.polaroids[0];
  const polaroid2 = desk.polaroids[1] ?? desk.polaroids[0];
  const [lampOn, setLampOn] = useState(true);
  const [teaEmpty, setTeaEmpty] = useState(false);
  const [polaroidOpen, setPolaroidOpen] = useState(null);

  // ── Polaroid hover, decided purely by pointer geometry ──────────────
  // The two polaroids overlap, are rotated, and live inside a 3D-transformed
  // scene. Per-element mouseenter/leave can't disambiguate that reliably, so
  // we drive a single exclusive "picked" index from the actual paint stack:
  // on each pointer move over the scene, elementsFromPoint() gives the screen-
  // space hit list (topmost first); the first entry inside a [data-polaroid]
  // is the polaroid whose visible pixels you're actually over. This respects
  // rotation, overlap, lift, and perspective automatically — whatever is drawn
  // on top under the cursor is what gets picked, and never its hidden sibling.
  const [hoveredPol, setHoveredPol] = useState(null);
  const ptRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  const resolveHover = () => {
    rafRef.current = 0;
    const { x, y } = ptRef.current;
    const els = document.elementsFromPoint(x, y);
    let found = null;
    for (const el of els) {
      const hit = el.closest?.("[data-polaroid]");
      if (hit) {
        found = Number(hit.getAttribute("data-polaroid"));
        break;
      }
      // A paper card (which floats above the polaroids) is on top here —
      // don't reach through it to lift a polaroid hidden underneath.
      if (el.closest?.("[data-deskpaper]")) break;
    }
    setHoveredPol((prev) => (prev === found ? prev : found));
  };

  const handleScenePointerMove = (e) => {
    ptRef.current = { x: e.clientX, y: e.clientY };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(resolveHover);
  };

  const handleScenePointerLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setHoveredPol(null);
  };

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return (
    <div className={styles.desktopWrap}>
      <div className="section-fade" aria-hidden="true" />
      <ScrollReveal className={styles.desktopInner}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>✦ {copy.eyebrow}</div>
          <h2 className={styles.sectionTitle}>{copy.title}</h2>
          <p className={styles.sectionSub}>{copy.intro}</p>
          <div className={styles.rule} />
          {copy.instruction && <SectionGuide>{copy.instruction}</SectionGuide>}
        </div>

        <div className={styles.perspective}>
          <div
            className={styles.scene}
            onPointerMove={handleScenePointerMove}
            onPointerLeave={handleScenePointerLeave}
          >
            {/* WALL */}
            <div className={styles.wall}>
              <div className={styles.wallTrim} />
              <div className={styles.pinnedNote}>
                {desk.pinnedNote.lines.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
                {desk.pinnedNote.byline && (
                  <div className={styles.pinnedNoteDate}>{desk.pinnedNote.byline}</div>
                )}
              </div>
              <div className={styles.wallQuote}>— a desk facing west —</div>
            </div>

            {/* DESK SURFACE */}
            <div className={styles.desk}>
              <WoodGrain opacity={0.88} />
              <div className={styles.deskEdge} />
              {lampOn && <div className={styles.lampGlow} />}
            </div>

            {/* OBJECTS */}
            <div className={styles.objLamp} onClick={() => { analytics.writingDeskToggled("lamp"); setLampOn((o) => !o); }} role="button" aria-label="Toggle lamp">
              <DeskLamp on={lampOn} />
            </div>
            <div className={styles.objInk}>
              <InkBottle level={0.78} label="ACTIVE" />
            </div>
            <div className={styles.objPen}>
              <FountainPen rotation={12} />
            </div>
            <div className={styles.objTea} onClick={() => { analytics.writingDeskToggled("tea"); setTeaEmpty((e) => !e); }} role="button" aria-label="Toggle tea">
              <TeaCup empty={teaEmpty} />
            </div>
            <div className={styles.objNotebook}>
              <HiddenNotes notes={desk.hiddenNotes} />
            </div>
            <div className={styles.objCards}>
              <IndexCardStack rotation={-4} count={4} lines={desk.indexCard.lines} />
            </div>
            <div className={styles.objPol1} style={{ zIndex: hoveredPol === 0 ? 60 : undefined }}>
              <Polaroid
                index={0}
                rotation={-5}
                size={108}
                src={polaroid1.src}
                caption={polaroid1.caption}
                alt={polaroid1.alt}
                onClick={() => { analytics.writingPolaroidOpened(1); setPolaroidOpen(polaroid1); }}
                hovered={hoveredPol === 0}
              />
            </div>
            <div className={styles.objPol2} style={{ zIndex: hoveredPol === 1 ? 60 : undefined }}>
              <Polaroid
                index={1}
                rotation={6}
                size={108}
                src={polaroid2.src}
                caption={polaroid2.caption}
                alt={polaroid2.alt}
                onClick={() => { analytics.writingPolaroidOpened(2); setPolaroidOpen(polaroid2); }}
                hovered={hoveredPol === 1}
              />
            </div>
            <div className={styles.objLetter}>
              <WaxLetter rotation={-12} color="#7a2a2a" />
            </div>

            {/* PAPERS */}
            <div className={styles.papersLayer}>
              <div className={styles.papersArea}>
                {featured.map((p) => (
                  <PaperCard key={p.id} piece={p} onClick={openPiece} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.deskFooter}>
          <p className={styles.deskHint}>Click a paper to read · the lamp · the tea · the polaroids</p>
          <div className={styles.legend}>
            {Object.entries(CAT_COLORS).map(([k, v]) => (
              <div key={k} className={styles.legendItem}>
                <div className={styles.legendDot} style={{ background: v.accent }} />
                <span>{k}</span>
              </div>
            ))}
          </div>
        </div>
        <ViewMore onClick={onViewMore}>View More Writing →</ViewMore>
      </ScrollReveal>

      {polaroidOpen && <PolaroidModal polaroid={polaroidOpen} onClose={() => setPolaroidOpen(null)} />}
    </div>
  );
}

/* ── Mobile ──────────────────────────────────────────────── */
function WritingMobile({ featured, desk, onViewMore, openPiece, copy }) {
  const polaroid1 = desk.polaroids[0];
  const polaroid2 = desk.polaroids[1] ?? desk.polaroids[0];
  const [lampOn, setLampOn] = useState(true);
  const [teaEmpty, setTeaEmpty] = useState(false);
  const [polaroidOpen, setPolaroidOpen] = useState(null);

  return (
    <div className={styles.mobileWrap}>
      <div className="section-fade" aria-hidden="true" />
      <div className={styles.mobileHeader}>
        <div className={styles.eyebrow}>✦ {copy.eyebrow}</div>
        <h2 className={styles.mobileSectionTitle}>{copy.title}</h2>
        <p className={styles.mobileSub}>{copy.introMobile}</p>
        {copy.instructionMobile && <SectionGuide>{copy.instructionMobile}</SectionGuide>}
      </div>

      <div className={styles.mobileScene}>
        <div className={styles.mobileDesk}>
          <WoodGrain opacity={0.85} />
          {lampOn && <div className={styles.mobileLampGlow} />}
          <div className={styles.mobObjLamp} onClick={() => { analytics.writingDeskToggled("lamp"); setLampOn((o) => !o); }} role="button" aria-label="Toggle lamp">
            <DeskLamp on={lampOn} />
          </div>
          <div className={styles.mobObjInk}>
            <InkBottle level={0.78} label="ACTIVE" />
          </div>
          <div className={styles.mobObjTea} onClick={() => { analytics.writingDeskToggled("tea"); setTeaEmpty((e) => !e); }} role="button" aria-label="Toggle tea">
            <TeaCup empty={teaEmpty} />
          </div>
          <div className={styles.mobObjPol}>
            <Polaroid
              rotation={-5}
              size={60}
              src={polaroid1.src}
              caption={polaroid1.caption}
              alt={polaroid1.alt}
              onClick={() => { analytics.writingPolaroidOpened(1); setPolaroidOpen(polaroid1); }}
            />
          </div>
          <div className={styles.mobObjPol2}>
            <Polaroid
              rotation={9}
              size={60}
              src={polaroid2.src}
              caption={polaroid2.caption}
              alt={polaroid2.alt}
              onClick={() => { analytics.writingPolaroidOpened(2); setPolaroidOpen(polaroid2); }}
            />
          </div>
          <div className={styles.mobObjCards}>
            <IndexCardStack rotation={-3} count={3} lines={desk.indexCard.lines} />
          </div>
        </div>
      </div>

      <div className={styles.mobileStack}>
        <div className={styles.mobileStackLabel}>✦ The Stack — tap to read</div>
        <div className={styles.mobileCards}>
          {featured.map((p, i) => {
            const cat = CAT_COLORS[p.type];
            const rot = (i % 2 === 0 ? -0.8 : 0.6) * (1 + (i % 3) * 0.2);
            return (
              <div
                key={p.id}
                onClick={() => openPiece(p)}
                className={styles.mobileCard}
                style={{ transform: `rotate(${rot}deg)` }}
              >
                <div className={styles.mobileCardBar} style={{ background: cat.accent }} />
                <div className={styles.mobileCardPeek} />
                <div className={styles.mobileCardBody}>
                  <div className={styles.mobileCardTop}>
                    <div className={styles.mobileCardType} style={{ color: cat.deep }}>{p.type} · {p.publication}</div>
                    <div className={styles.mobileCardDate}>{p.date}</div>
                  </div>
                  <div className={styles.mobileCardTitle}>{p.title}</div>
                  <div className={styles.mobileCardExcerpt}>{p.excerpt}</div>
                  <div className={styles.mobileCardAction} style={{ color: cat.deep }}>→ pick up · {p.pages} pages</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ViewMore onClick={onViewMore}>View More Writing →</ViewMore>
      {polaroidOpen && <PolaroidModal polaroid={polaroidOpen} onClose={() => setPolaroidOpen(null)} />}
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────── */
// Reader modal mounts LOCALLY (state + history.pushState), not via
// router.push to the slug route. Pieces are already in props so there's
// nothing to fetch on click. Shareable URL preserved; popstate keeps
// state synced for browser back/forward.
export default function WritingSection({ pieces = [], desk = FALLBACK_DESK, copy = FALLBACK_SECTION_COPY.writing }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(null);
  // Gates popstate sync so an initial-load popstate on the canonical
  // /personal/writing/<slug> route doesn't mount a SECOND reader beside
  // SlugLandingChoreography's. See Projects.jsx for the long version.
  const hasInteracted = useRef(false);
  // Slug of the piece currently open, held in a ref so writing_piece_closed
  // can report which piece was being read after selectedSlug clears.
  const openedSlugRef = useRef(null);
  useDwellDuration(!!selectedSlug, (d) => analytics.writingPieceClosed(openedSlugRef.current, d));
  useDwellDuration(archiveOpen, (d) => analytics.writingArchiveClosed(d));

  const selected = selectedSlug
    ? pieces.find((p) => p.id === selectedSlug) ?? null
    : null;

  function openPiece(piece) {
    if (!piece?.id) return;
    openedSlugRef.current = piece.id;
    analytics.writingPieceOpened({ slug: piece.id, title: piece.title });
    setSelectedSlug(piece.id);
    window.history.pushState({}, "", `/personal/writing/${piece.id}`);
    hasInteracted.current = true;
  }

  const openArchive = () => { analytics.writingArchiveOpened(); setArchiveOpen(true); };

  function closePiece() {
    setSelectedSlug(null);
    // Clean landing URL — no hash. User stays scrolled at the section.
    window.history.pushState({}, "", "/personal");
  }

  useEffect(() => {
    function onPopState() {
      if (!hasInteracted.current) return;
      const m = window.location.pathname.match(SLUG_PATTERN);
      setSelectedSlug(m?.[1] ?? null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Featured pieces sorted by their assigned position so they render in slot order
  const featured = useMemo(
    () =>
      pieces
        .filter((p) => p.featured && p.pos)
        .slice()
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    [pieces]
  );

  if (pieces.length === 0) return null;

  return (
    <section id="writing">
      <div className="desktop-only">
        <WritingDesktop featured={featured} desk={desk} onViewMore={openArchive} openPiece={openPiece} copy={copy} />
      </div>
      <div className="mobile-only">
        <WritingMobile featured={featured} desk={desk} onViewMore={openArchive} openPiece={openPiece} copy={copy} />
      </div>
      <AllWritingsArchive
        pieces={pieces}
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        openPiece={openPiece}
      />

      {/* Local reader modal — mounts above the archive (and the desk) via
          its own z-index, exits via close handler. */}
      <AnimatePresence>
        {selected && (
          <WritingReader piece={selected} onClose={closePiece} />
        )}
      </AnimatePresence>
    </section>
  );
}
