"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./StoryMedia.module.css";
import { analytics } from "@/lib/analytics";

const isGradient = (src) =>
  src?.startsWith("linear-gradient") ||
  src?.startsWith("radial-gradient") ||
  src?.startsWith("#");

// Module-level flag: once the user has tapped the play overlay anywhere in
// this React session, every subsequent direct-landing story also auto-plays
// (no overlay). Resets on page reload / tab close, matching the user-gesture
// model — a single in-session interaction is enough to satisfy autoplay
// policy for the rest of the session.
let _userHasPlayed = false;

export default function StoryMedia({
  media = [],
  location,
  paused = false,
  onSlideChange,
  autoplay = true,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(true); // autoplay requires muted start
  // needsGesture is true when the route asked us to wait for a tap AND
  // the user hasn't yet played a story in this session.
  const [needsGesture, setNeedsGesture] = useState(
    () => !autoplay && !_userHasPlayed
  );
  const videoRef = useRef(null);
  const videoBarRef = useRef(null);
  const mediaFrameRef = useRef(null);
  const goNextRef = useRef(null);
  const pressTimeRef = useRef(0);
  const wasHeldRef = useRef(false);
  // Delays held state so quick navigation taps never stutter the video.
  // Instagram only pauses on a genuine hold, not a tap.
  const holdTimerRef = useRef(null);
  // Pinch-to-zoom state — all mutations go through the ref for 60fps direct DOM
  // writes, no React state involved. dist0 = initial finger distance; ox/oy =
  // transform-origin in % (pinch midpoint inside the mediaFrame).
  const pinchRef = useRef({ active: false, dist0: 1, ox: 50, oy: 50 });

  const current = media[currentIndex];
  const useVideoEl = current?.type === "video" && !isGradient(current?.src);
  const effectivePaused = paused || held || needsGesture;

  // Push current slide up so the parent pane can render a blurred ambient
  // backdrop around the 9:16 frame. Gradient-only slides are skipped.
  useEffect(() => {
    if (!onSlideChange) return;
    if (!current || isGradient(current.src)) onSlideChange(null);
    else onSlideChange({ src: current.src, type: current.type });
  }, [current, onSlideChange]);
  useEffect(() => () => onSlideChange?.(null), [onSlideChange]);

  function goNext() {
    setCurrentIndex((i) => Math.min(i + 1, media.length - 1));
  }
  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }
  // User-initiated navigation (tap zones, arrow keys, arrow buttons) — fires
  // story_media_navigated. Auto-advance (image timer / video end) calls
  // goNext directly and is intentionally NOT tracked as navigation.
  function userNav(direction) {
    analytics.storyMediaNavigated(location, direction);
    if (direction === "next") goNext();
    else goPrev();
  }

  goNextRef.current = goNext;

  // Restore mute preference from a prior session
  useEffect(() => {
    try {
      const saved = localStorage.getItem("storyMuted");
      if (saved !== null) setMuted(saved === "true");
    } catch {}
  }, []);

  function toggleMute(e) {
    e.stopPropagation();
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem("storyMuted", String(next)); } catch {}
      return next;
    });
  }

  // Reset video bar whenever slide changes
  useEffect(() => {
    if (videoBarRef.current) videoBarRef.current.style.transform = "scaleX(0)";
  }, [currentIndex]);

  // Pause/resume actual video element when held or externally paused.
  // When needsGesture is true, effectivePaused is true → video stays
  // paused until the play overlay is tapped.
  useEffect(() => {
    if (!videoRef.current || !useVideoEl) return;
    if (effectivePaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  }, [effectivePaused, useVideoEl]);

  // One-time play gesture — sets the module flag so future direct landings
  // in this session skip the overlay entirely.
  function handlePlayGesture() {
    _userHasPlayed = true;
    setNeedsGesture(false);
  }

  // Smooth video progress bar via rAF — writes width directly to the DOM
  // (no React state) so we get 60fps without re-render storms.
  useEffect(() => {
    if (!useVideoEl || effectivePaused) return;
    let rafId;
    const tick = () => {
      const v = videoRef.current;
      const bar = videoBarRef.current;
      if (v && bar && v.duration) {
        const ratio = Math.min(v.currentTime / v.duration, 1);
        bar.style.transform = "scaleX(" + ratio + ")";
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [useVideoEl, currentIndex, effectivePaused]);

  // ── Pinch-to-zoom helpers ─────────────────────────────────────────────
  function pinchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function applyFrameScale(scale, transition) {
    const frame = mediaFrameRef.current;
    if (!frame) return;
    frame.style.transition = transition
      ? "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)"
      : "none";
    frame.style.transform = scale === 1 ? "" : `scale(${scale})`;
  }

  function startPinch(e) {
    // Second finger landed — kill the hold timer so a pinch never triggers grey.
    clearTimeout(holdTimerRef.current);
    const frame = mediaFrameRef.current;
    if (!frame) return;
    const p = pinchRef.current;
    p.active = true;
    p.dist0 = pinchDist(e.touches);
    const rect = frame.getBoundingClientRect();
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    p.ox = ((mx - rect.left) / rect.width) * 100;
    p.oy = ((my - rect.top) / rect.height) * 100;
    frame.style.transformOrigin = `${p.ox}% ${p.oy}%`;
    // Cancel any hold-to-pause that started before the second finger arrived.
    setHeld(false);
    wasHeldRef.current = false;
  }

  function updatePinch(e) {
    if (!pinchRef.current.active || e.touches.length < 2) return;
    const scale = Math.max(1, Math.min(4, pinchDist(e.touches) / pinchRef.current.dist0));
    applyFrameScale(scale, false);
  }

  function endPinch() {
    if (!pinchRef.current.active) return;
    pinchRef.current.active = false;
    applyFrameScale(1, true); // spring back
  }

  // ── Hold-to-pause ─────────────────────────────────────────────────────
  function onPressStart(e) {
    if (e.touches?.length >= 2) { startPinch(e); return; }
    pressTimeRef.current = Date.now();
    wasHeldRef.current = false;
    // Delay pause by 180ms — quick navigation taps fire and finish in < 150ms,
    // so they never trigger the hold state. Only deliberate holds reach setHeld.
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => setHeld(true), 180);
  }

  function releaseHeld() {
    clearTimeout(holdTimerRef.current);
    setHeld((prev) => {
      if (prev && Date.now() - pressTimeRef.current > 250) {
        wasHeldRef.current = true;
      }
      return false;
    });
  }

  // Clean up hold timer on unmount
  useEffect(() => () => clearTimeout(holdTimerRef.current), []);

  // Global mouseup so release outside container always clears held
  useEffect(() => {
    document.addEventListener("mouseup", releaseHeld);
    return () => document.removeEventListener("mouseup", releaseHeld);
  }, []);

  // Left/Right arrow keys navigate slides. Skip when focus is in an input.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      if (e.key === "ArrowLeft") userNav("prev");
      else userNav("next");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media.length]);

  function handleTap(e) {
    if (wasHeldRef.current) {
      wasHeldRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (pct < 0.3) userNav("prev");
    else if (pct > 0.7) userNav("next");
  }

  return (
    <div
      className={`${styles.container}${held ? ` ${styles.held}` : ""}`}
      onClick={handleTap}
      onMouseDown={onPressStart}
      onTouchStart={onPressStart}
      onTouchMove={(e) => { if (e.touches.length >= 2) { e.preventDefault(); updatePinch(e); } }}
      onTouchEnd={(e) => { endPinch(); releaseHeld(); }}
      onTouchCancel={(e) => { endPinch(); releaseHeld(); }}
    >
      {/* Header bar — location flag + city + slide counter (IG-username-style) */}
      {location && (
        <div className={styles.header} onClick={(e) => e.stopPropagation()}>
          <div className={styles.headerLeft}>
            {location.regionFlag && <span className={styles.headerFlag}>{location.regionFlag}</span>}
            <span className={styles.headerCity}>{location.city}</span>
            {location.country && (
              <span className={styles.headerCountry}>{location.country}</span>
            )}
          </div>
          <div className={styles.headerRight}>
            {String(currentIndex + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}
          </div>
        </div>
      )}

      {/* Progress bars */}
      <div className={styles.progressBars} onClick={(e) => e.stopPropagation()}>
        {media.map((_, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={i} className={styles.barTrack}>
              {isCurrent && useVideoEl ? (
                // Real video: rAF loop writes width directly to this node.
                // Key includes currentIndex so React always mounts a fresh node
                // (otherwise the rAF-mutated style.width lingers on reverse nav).
                <div
                  key={`vid-${currentIndex}`}
                  ref={videoBarRef}
                  className={styles.barFill}
                  style={{ transform: "scaleX(0)" }}
                />
              ) : isCurrent ? (
                // Image / gradient: CSS animation, zero JS re-renders per frame
                <div
                  key={`anim-${currentIndex}`}
                  className={`${styles.barFill} ${styles.barFillAnim}`}
                  style={{
                    animationDuration: `${current?.durationMs ?? 7000}ms`,
                    animationPlayState: effectivePaused ? "paused" : "running",
                  }}
                  onAnimationEnd={goNext}
                />
              ) : (
                // Past / future bars: key includes currentIndex so any bar that
                // was the active video bar gets a fresh DOM node when we leave it,
                // dropping the stale inline width that rAF had written.
                <div
                  key={`static-${currentIndex}-${i}`}
                  className={styles.barFill}
                  style={{ transform: isPast ? "scaleX(1)" : "scaleX(0)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Media area — 9:16 frame uses all vertical space; instant slide swap */}
      <div className={styles.mediaArea}>
        <div key={currentIndex} className={styles.mediaFrame} ref={mediaFrameRef}>
            {useVideoEl ? (
              <video
                ref={videoRef}
                src={current.src}
                className={styles.mediaEl}
                autoPlay
                muted={muted}
                playsInline
                onEnded={goNext}
                aria-label={current.alt}
                /* Prevent Chrome/Safari/browser download & pip overlays on tap. */
                controlsList="nodownload nofullscreen noremoteplayback"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitTouchCallout: "none" }}
              />
            ) : isGradient(current?.src) ? (
              <div
                className={styles.mediaEl}
                style={{ background: current.src }}
                role="img"
                aria-label={current?.alt}
              />
            ) : (
              <img
                src={current?.src}
                alt={current?.alt}
                className={styles.mediaEl}
              />
            )}

            {current?.type === "video" && isGradient(current?.src) && (
              <div className={styles.videoBadge}>▶ VIDEO</div>
            )}

            {current?.caption && (
              <div className={styles.caption}>{current.caption}</div>
            )}

            {/* Play-gesture overlay — shown only on the first direct-landing
                story this session. Tap dismisses it forever (for this
                session) and starts playback. */}
            {needsGesture && (
              <button
                type="button"
                className={styles.playOverlay}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayGesture();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Tap to play"
              >
                <span className={styles.playOverlayIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                    <path d="M7 5L19 12L7 19Z" fill="currentColor" />
                  </svg>
                </span>
                <span className={styles.playOverlayLabel}>Tap to play</span>
              </button>
            )}
        </div>
      </div>

      {/* Mute toggle — only shown when current slide is an actual video */}
      {useVideoEl && (
        <button
          type="button"
          className={styles.muteBtn}
          onClick={toggleMute}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}

      {/* Nav arrows — desktop only, shown on container hover */}
      {media.length > 1 && (
        <div className={styles.arrows} aria-hidden="true">
          <button
            className={`${styles.arrowBtn} ${styles.arrowLeft}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); userNav("prev"); }}
            disabled={currentIndex === 0}
            tabIndex={-1}
          >
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
              <path d="M7.5 1.5L2 7.5L7.5 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={`${styles.arrowBtn} ${styles.arrowRight}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); userNav("next"); }}
            disabled={currentIndex === media.length - 1}
            tabIndex={-1}
          >
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
              <path d="M1.5 1.5L7 7.5L1.5 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Slide count */}
      {media.length > 1 && (
        <div className={styles.counter}>
          {currentIndex + 1} / {media.length}
        </div>
      )}
    </div>
  );
}
