"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./MediaGallery.module.css";

const MAX_DOTS = 9;

function getDotWindow(total, active) {
  if (total <= MAX_DOTS) return { start: 0, end: total - 1 };
  let start = active - Math.floor(MAX_DOTS / 2);
  let end = start + MAX_DOTS - 1;
  if (start < 0) { start = 0; end = MAX_DOTS - 1; }
  if (end >= total) { end = total - 1; start = end - MAX_DOTS + 1; }
  return { start, end };
}

export default function MediaGallery({ media = [] }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const current = media[index];
  const isVideo = current?.type === "youtube";

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e) {
      if (e.key === "Escape") setLightbox(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!media.length) return null;

  return (
    <div className={styles.root}>
      {/* Main display */}
      <div className={styles.display}>
        {isVideo ? (
          <iframe
            className={styles.video}
            src={`https://www.youtube-nocookie.com/embed/${current.videoId}`}
            title="Project video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            className={styles.imagePlaceholder}
            onClick={() => setLightbox(true)}
            aria-label="Open image fullscreen"
          >
            [ {current?.placeholder ?? "IMAGE"} ]
          </button>
        )}

        {media.length > 1 && (
          <>
            <button
              className={`${styles.navBtn} ${styles.prevBtn}`}
              onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className={`${styles.navBtn} ${styles.nextBtn}`}
              onClick={() => setIndex((i) => (i + 1) % media.length)}
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Dot pagination — windowed so dots never overflow the container */}
      {media.length > 1 && (() => {
        const { start, end } = getDotWindow(media.length, index);
        return (
          <div className={styles.dots}>
            {media.slice(start, end + 1).map((_, i) => {
              const realIdx = start + i;
              return (
                <button
                  key={realIdx}
                  className={`${styles.dot} ${realIdx === index ? styles.dotActive : ""}`}
                  onClick={() => setIndex(realIdx)}
                  aria-label={`Go to media ${realIdx + 1}`}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className={styles.lightbox}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
          >
            <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.imagePlaceholderLarge}>
                [ {current?.placeholder ?? "IMAGE"} ]
              </div>
              <button className={styles.lightboxClose} onClick={() => setLightbox(false)} aria-label="Close">✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
