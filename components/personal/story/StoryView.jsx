"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import StoryMedia from "./StoryMedia";
import FieldNotes from "./FieldNotes";
import styles from "./StoryView.module.css";

function useIsMobile(breakpoint = 768) {
  // Lazy initializer reads matchMedia synchronously on the client so the
  // correct layout renders on the FIRST frame — no desktop→mobile flip.
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

function AmbientBg({ slide }) {
  if (!slide?.src) return null;
  const isVideo = slide.type === "video";
  return (
    <div className={styles.ambient} aria-hidden="true">
      {isVideo ? (
        <video src={slide.src} autoPlay muted loop playsInline preload="metadata" />
      ) : (
        <img src={slide.src} alt="" />
      )}
      <div className={styles.ambientDim} />
    </div>
  );
}

export default function StoryView({ story, location, autoplay = true }) {
  const [mediaPaused, setMediaPaused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(null);
  const isMobile = useIsMobile();
  const fieldNotesRef = useRef(null);
  const mobileRootRef = useRef(null);

  // Compute exact 9:16 story dimensions from the true visual viewport so:
  //  - browser chrome never cuts off the bottom
  //  - story always fills the maximum possible height without cropping
  //  - if screen is wider than 9:16 allows, pillarbox (dark bg shows left/right)
  //  Sets --story-w, --story-h, --vvh on the mobileRoot element.
  useEffect(() => {
    if (!isMobile) return;
    const MIN_TAB_H = 52; // minimum "Read Field Notes" tab height in px

    function updateLayout() {
      const root = mobileRootRef.current;
      if (!root) return;
      const vv = window.visualViewport;
      const vvH = vv?.height ?? window.innerHeight;
      const vvW = vv?.width ?? window.innerWidth;

      const maxStoryH = vvH - MIN_TAB_H;
      const storyHAtFullW = vvW * (16 / 9);

      let storyW, storyH;
      if (storyHAtFullW <= maxStoryH) {
        // Width-constrained: story fills full width, tab gets the rest
        storyW = vvW;
        storyH = storyHAtFullW;
      } else {
        // Height-constrained: scale down to fit, pillarbox the sides
        storyH = maxStoryH;
        storyW = Math.round(maxStoryH * (9 / 16));
      }

      root.style.setProperty("--story-w", `${storyW}px`);
      root.style.setProperty("--story-h", `${storyH}px`);
      root.style.setProperty("--vvh", `${vvH}px`);
    }

    updateLayout();
    window.visualViewport?.addEventListener("resize", updateLayout);
    window.addEventListener("resize", updateLayout);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateLayout);
      window.removeEventListener("resize", updateLayout);
    };
  }, [isMobile]);

  // Up/Down arrows scroll the FieldNotes pane (when it has scrollable overflow)
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const el = fieldNotesRef.current;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight) return; // nothing to scroll
      e.preventDefault();
      el.scrollBy({ top: e.key === "ArrowDown" ? 80 : -80, behavior: "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleFieldNotesPause() {}

  function toggleDrawer() {
    const next = !drawerOpen;
    setDrawerOpen(next);
    setMediaPaused(next);
  }

  if (!story) return null;

  // ── Mobile: fullscreen background + bottom drawer ──────────────────────────
  if (isMobile) {
    return (
      <div className={styles.mobileRoot} ref={mobileRootRef}>
        {/* Fullscreen media background */}
        <div className={styles.mobileBg}>
          <StoryMedia
            media={story.media}
            location={location}
            paused={mediaPaused || drawerOpen}
            onSlideChange={setCurrentSlide}
            autoplay={autoplay}
          />
        </div>

        {/* Bottom drawer */}
        <div className={styles.drawerArea}>
          <button
            className={styles.drawerTab}
            onClick={toggleDrawer}
            aria-expanded={drawerOpen}
            aria-controls="field-notes-drawer"
          >
            <span className={styles.tabHandle} />
            <span className={styles.tabLabel}>
              {drawerOpen ? "↓ Close" : "⌃ Read Field Notes"}
            </span>
          </button>

          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                id="field-notes-drawer"
                className={styles.drawer}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
              >
                <FieldNotes story={story} onPauseChange={() => {}} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Desktop: 50/50 book layout ─────────────────────────────────────────────
  return (
    <div className={styles.desktopRoot}>
      <div className={styles.mediaSide}>
        <AmbientBg slide={currentSlide} />
        <StoryMedia
          media={story.media}
          location={location}
          paused={mediaPaused}
          onSlideChange={setCurrentSlide}
          autoplay={autoplay}
        />
      </div>

      <div className={styles.notesSide}>
        <FieldNotes story={story} onPauseChange={handleFieldNotesPause} scrollRef={fieldNotesRef} />
      </div>
    </div>
  );
}
