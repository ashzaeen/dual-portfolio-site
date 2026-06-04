"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CAT_COLORS } from "@/data/pieces";
import styles from "./AllWritingsArchive.module.css";

const CATEGORIES = ["Personal", "Technical", "Journalism"];
const COLS = 3;

/* slight per-slot rotations — same handmade feel as the desk */
const SLOT_ROTATIONS = [-0.5, 0.4, -0.3, 0.5, -0.4, 0.3, -0.45, 0.38, -0.32, 0.48, -0.42, 0.28, -0.5, 0.4, -0.3];

/* ── Shelf divider ──────────────────────────────────────── */
function ShelfDivider({ index }) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII"];
  const label = `§ ${roman[index % roman.length]}`;
  return (
    <div className={styles.shelf}>
      <div className={styles.shelfBracket} />
      <div className={styles.shelfSurface}>
        <div className={styles.shelfGrain} />
        <div className={styles.shelfTopEdge} />
        <span className={styles.shelfLabelL}>{label}</span>
        <span className={styles.shelfOrn}>✦</span>
        <span className={styles.shelfLabelR}>{label}</span>
        <div className={styles.shelfFascia} />
      </div>
      <div className={styles.shelfBracket} />
    </div>
  );
}

/* ── Archive card ───────────────────────────────────────── */
function ArchiveCard({ piece, dimmed, onClick, rotation }) {
  const [hov, setHov] = useState(false);
  const cat = CAT_COLORS[piece.type];
  const active = hov && !dimmed;

  return (
    <div
      className={`${styles.archiveCard} ${dimmed ? styles.cardDimmed : ""}`}
      style={{ "--rot": `${rotation}deg`, "--cat-accent": cat.accent, "--cat-deep": cat.deep }}
      onClick={() => !dimmed && onClick(piece)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className={styles.cardShadow1} />
      <div className={styles.cardShadow2} />
      <div className={styles.cardBar} />
      <div className={styles.cardTexture} />
      <div className={styles.cardContent}>
        <div className={styles.cardMeta}>{piece.publication} · {piece.date}</div>
        <div className={styles.cardTitle}>{piece.title}</div>
        <div className={styles.cardExcerpt}>{piece.excerpt}</div>
        {piece.tags?.length > 0 && (
          <div className={styles.cardTags}>
            {piece.tags.map(t => <span key={t} className={styles.cardTagPill}>{t}</span>)}
          </div>
        )}
        <div className={`${styles.cardAction} ${active ? styles.cardActionHov : ""}`}>
          {active ? "→ pick up" : `${piece.pages} pages`}
        </div>
      </div>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────── */
// Card clicks call the parent's openPiece (lifted into WritingSection so
// the reader modal can mount in a single place). ESC is suspended while
// the reader is open — detected via URL path since the reader updates
// window.location via history.pushState.
export default function AllWritingsArchive({ pieces: PIECES = [], open, onClose, openPiece }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTags, setActiveTags] = useState(new Set());

  /* ESC closes archive — suspended once a reader is open */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (window.location.pathname.startsWith("/personal/writing/")) return;
      onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Body scroll lock */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Reset filters on close */
  useEffect(() => {
    if (!open) {
      setActiveCategory(null);
      setActiveTags(new Set());
    }
  }, [open]);

  const allTags = [...new Set(PIECES.flatMap(p => p.tags || []))];

  const isDimmed = (piece) => {
    if (activeCategory && piece.type !== activeCategory) return true;
    if (activeTags.size > 0 && !(piece.tags || []).some(t => activeTags.has(t))) return true;
    return false;
  };

  const isFilterActive = activeCategory !== null || activeTags.size > 0;
  const matchedPieces = PIECES.filter(p => !isDimmed(p));

  /* Matched cards bubble to the top; unmatched follow after a separator slot */
  const getCardOrder = (piece) => {
    if (!isFilterActive) return PIECES.findIndex(p => p.id === piece.id);
    const matchIdx = matchedPieces.findIndex(p => p.id === piece.id);
    if (matchIdx >= 0) return matchIdx;
    return matchedPieces.length + 1 + PIECES.findIndex(p => p.id === piece.id);
  };

  const toggleTag = (tag) =>
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });

  const toggleCategory = (cat) =>
    setActiveCategory(prev => (prev === cat ? null : cat));

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Writing Archive"
          >
            <motion.div
              className={styles.archive}
              initial={{ opacity: 0, scale: 0.93, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header / newsstand sign ── */}
              <div className={styles.header}>
                <div className={styles.headerLeft}>
                  <span className={styles.headerOrn}>✦</span>
                  <h2 className={styles.headerTitle}>The Writing Archive</h2>
                  <span className={styles.headerOrn}>✦</span>
                </div>
                <div className={styles.headerRight}>
                  <span className={styles.pieceCount}>{PIECES.length} pieces</span>
                  <button className={styles.closeBtn} onClick={onClose} aria-label="Close archive">✕</button>
                </div>
              </div>

              {/* ── Filter bar ── */}
              <div className={styles.filterBar}>
                <div className={styles.filterSection}>
                  <span className={styles.filterLabel}>Section</span>
                  <div className={styles.filterPills}>
                    <button
                      className={`${styles.pill} ${!activeCategory ? styles.pillActiveAll : ""}`}
                      onClick={() => setActiveCategory(null)}
                    >All</button>
                    {CATEGORIES.map(cat => {
                      const isActive = activeCategory === cat;
                      return (
                        <button
                          key={cat}
                          className={`${styles.pill} ${isActive ? styles.pillActiveCat : ""}`}
                          style={isActive ? { "--pill-bg": CAT_COLORS[cat].accent } : {}}
                          onClick={() => toggleCategory(cat)}
                        >
                          <span className={styles.pillDot} style={{ background: CAT_COLORS[cat].accent }} />
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {allTags.length > 0 && (
                  <div className={styles.filterSection}>
                    <span className={styles.filterLabel}>Topics</span>
                    <div className={styles.filterTags}>
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          className={`${styles.tagChip} ${activeTags.has(tag) ? styles.tagChipActive : ""}`}
                          onClick={() => toggleTag(tag)}
                        >{tag}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Card grid with shelf dividers ── */}
              <div className={styles.content}>
                <div className={styles.cardGrid}>
                  {PIECES.flatMap((piece, i) => {
                    const cardOrder = getCardOrder(piece);
                    const items = [
                      /* motion.div wrapper carries the CSS order for layout animation */
                      <motion.div
                        key={piece.id}
                        layout
                        style={{ order: cardOrder }}
                        transition={{ layout: { type: "spring", stiffness: 340, damping: 28 } }}
                      >
                        <ArchiveCard
                          piece={piece}
                          dimmed={isDimmed(piece)}
                          onClick={openPiece}
                          rotation={SLOT_ROTATIONS[i % SLOT_ROTATIONS.length]}
                        />
                      </motion.div>,
                    ];
                    /* Shelves only when no filter is active — they'd be wrong after reorder */
                    if (!isFilterActive && (i + 1) % COLS === 0 && i < PIECES.length - 1) {
                      items.push(
                        <ShelfDivider key={`shelf-${i}`} index={Math.floor(i / COLS)} />
                      );
                    }
                    return items;
                  })}
                  {/* Gold separator line between matched (top) and dimmed remainder */}
                  {isFilterActive && matchedPieces.length > 0 && matchedPieces.length < PIECES.length && (
                    <motion.div
                      layout
                      style={{ order: matchedPieces.length, gridColumn: "1 / -1" }}
                      transition={{ layout: { type: "spring", stiffness: 340, damping: 28 } }}
                      className={styles.filterSeparator}
                    />
                  )}
                </div>
              </div>

              {/* ── Counter / display edge ── */}
              <div className={styles.counterEdge} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
