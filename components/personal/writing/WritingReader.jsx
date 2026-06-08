"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CAT_COLORS } from "@/data/pieces";
import WritingBlocks from "./WritingBlocks";
import styles from "../WritingSection.module.css";

// Same visual as the original ReaderOverlay inside WritingSection.jsx, but
// extracted so the intercepting route at /personal/@modal/(.)writing/[slug]
// can mount it directly. Close goes through the router so URL stays in sync.
export default function WritingReader({ piece, onClose }) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const cat = CAT_COLORS[piece.type] ?? CAT_COLORS.Personal;

  // If a wrapper provides onClose (slug choreography), defer so close = local
  // unmount and the landing underneath stays interactive without a route
  // change. Otherwise fall back to smart same-origin back / external replace.
  const handleClose = onClose ?? (() => {
    const ref = typeof document !== "undefined" ? document.referrer : "";
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    if (sameOrigin) {
      router.back();
    } else {
      router.replace("/personal#writing", { scroll: false });
    }
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Lock the html element directly — globals.css sets overflow-x:hidden on
    // <html>, which breaks the body→viewport overflow propagation the spec
    // describes. Setting overflowY on documentElement is the only reliable way
    // to prevent page scroll while this modal is open.
    const html = document.documentElement;
    const prevY = html.style.overflowY;
    const prevBody = document.body.style.overflow;
    html.style.overflowY = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflowY = prevY;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const onScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
  };

  return (
    <div
      className={`${styles.overlayBg}${piece.pdf ? " " + styles.overlayBgPdf : ""}`}
      onClick={handleClose}
      data-theme="personal"
    >
      <div
        className={`${styles.overlayCard}${piece.pdf ? " " + styles.overlayCardPdf : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.readProgress}>
          <div
            className={styles.readProgressFill}
            style={{ height: `${progress * 100}%`, background: `linear-gradient(180deg, var(--gold), ${cat.deep})` }}
          />
        </div>

        <div className={styles.overlayHeader}>
          <div className={styles.overlayMeta} style={{ color: cat.deep }}>
            {[piece.type, piece.publication, piece.date].filter(Boolean).join(" · ")}
          </div>
          <button onClick={handleClose} className={styles.placeBack}>Place back ✕</button>
        </div>

        <div
          className={`${styles.overlayBody}${piece.pdf ? " " + styles.overlayBodyPdf : ""}`}
          onScroll={onScroll}
        >
          {piece.pdf ? (
            <PdfPages pdf={piece.pdf} title={piece.title} />
          ) : (
            <>
              <h1 className={styles.overlayTitle}>{piece.title}</h1>
              <div className={styles.overlayExcerpt}>{piece.excerpt}</div>
              <WritingBlocks blocks={piece.blocks} cat={cat} type={piece.type} />
            </>
          )}
          <div className={styles.overlayFooter}>
            <span>{piece.pages} pages · est {Math.max(2, Math.round(piece.pages * 0.6))} min</span>
            <span>esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Renders a pre-rasterized PDF article as stacked page images flowing in the
// modal's own scroll (no runtime PDF library). The `aspect` box reserves each
// page's space up front so the scrollbar / read-progress don't jump as the
// lazy images decode.
function PdfPages({ pdf, title }) {
  const pages = Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
  return (
    <div className={styles.pdfDoc}>
      {pages.map((n) => (
        <img
          key={n}
          src={`${pdf.basePath}/page-${n}.${pdf.ext}`}
          alt={`${title} — page ${n} of ${pdf.pageCount}`}
          className={styles.pdfPage}
          style={{ aspectRatio: String(pdf.aspect) }}
          loading={n === 1 ? "eager" : "lazy"}
          draggable={false}
        />
      ))}
    </div>
  );
}
