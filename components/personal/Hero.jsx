"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Hero.module.css";
import { FALLBACK_ROLES } from "@/data/roles";
import { FALLBACK_HERO_STATUS } from "@/data/status";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import { useActiveStatus } from "@/lib/useActiveStatus";
import { PersonalHeroTunerProvider, TunerBox } from "./PersonalHeroTuner";

// The personal Hero — a two-column composition:
//   LEFT  — name, role rotator, gold rule, bio, status line (handwritten)
//   RIGHT — a stack of 3 polaroids:
//             • Front polaroid (main face) — clickable, opens a carousel
//               modal. Has the tape, postmark, stamp, develop animation
//               and typewriter caption.
//             • Two background polaroids peek behind — they also show
//               real photos but no chrome, just paper + photo.
//             • Gold dust drifts around the scene; bottom of the hero
//               fades into a soft corkboard texture foreshadowing the
//               immersive wall section below.
//
// Click front polaroid → opens a carousel modal:
//             • Active photo centered
//             • Side photos peek in at low opacity, ~75% scale
//             • Bottom dots + arrow keys + click side peeks + swipe (drag)
//             • Caveat caption beneath the active photo
//
// Status line is the same data as the professional Hero (data/status.js),
// rendered in handwritten Caveat — same words, personal voice.

const PHOTOS = [
  { src: "/images/personal-1.jpg", caption: "NOLA · Apr '26",  alt: "Ashzaeen in front of the St. Louis Cathedral, New Orleans" },
  { src: "/images/personal-2.jpg", caption: "NYC · Dec '24",   alt: "Ashzaeen in New York City, December 2024" },
  { src: "/images/personal-3.jpg", caption: "Ohio · Mar '25",  alt: "Ashzaeen in Ohio, March 2025" },
];

const CAPTION_TYPE_INTERVAL_MS = 90;
const DEVELOP_DELAY_MS = 1200;
const DEVELOP_DURATION_MS = 2000;
const TYPE_START_MS = DEVELOP_DELAY_MS + DEVELOP_DURATION_MS;

// Stable pseudo-random dust positions — deterministic, no SSR mismatch.
const DUST_COUNT = 14;
const DUST = Array.from({ length: DUST_COUNT }, (_, i) => {
  const seed = i * 37 + 11;
  const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
  const r2 = ((seed * 1234567) % 233280) / 233280;
  const r3 = ((seed * 7853) % 233280) / 233280;
  return {
    left: 8 + r1 * 84,
    top: 6 + r2 * 88,
    delay: r3 * 9,
    duration: 14 + r1 * 8,
    size: 1.4 + r2 * 1.6,
  };
});

export default function Hero(props) {
  return (
    <PersonalHeroTunerProvider>
      <HeroInner {...props} />
    </PersonalHeroTunerProvider>
  );
}

function HeroInner({ roles, status = FALLBACK_HERO_STATUS, copy = FALLBACK_SECTION_COPY["personal-hero"] }) {
  const list = roles && roles.length > 0 ? roles : FALLBACK_ROLES;
  const [tick, setTick] = useState(0);
  const [typedLen, setTypedLen] = useState(0);
  const [carouselOpen, setCarouselOpen] = useState(false);

  // Role rotator
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2800);
    return () => clearInterval(id);
  }, []);

  // Status is now a single GPT-regen value from Notion (see
  // fetchHeroStatus). No client-side cycling.

  // Caption typewriter — starts after the photo finishes developing.
  // CAPTION is the first photo's caption since the main polaroid shows it.
  useEffect(() => {
    const CAPTION = PHOTOS[0].caption;
    const startTimer = setTimeout(() => {
      const id = setInterval(() => {
        setTypedLen((n) => {
          if (n >= CAPTION.length) {
            clearInterval(id);
            return n;
          }
          return n + 1;
        });
      }, CAPTION_TYPE_INTERVAL_MS);
    }, TYPE_START_MS);
    return () => clearTimeout(startTimer);
  }, []);

  // Rotates through the day's status batch by the location's timezone; falls
  // back to status.text when there's no schedule.
  const activeStatus = useActiveStatus(status);
  const role = list[tick % list.length];
  const statusText = activeStatus.text;
  const fullCaption = PHOTOS[0].caption;
  const typedCaption = fullCaption.slice(0, typedLen);
  const typingDone = typedLen >= fullCaption.length;
  const dustItems = useMemo(() => DUST, []);

  return (
    <section className={styles.section}>
      <div className={styles.glowTopRight} />
      <div className={styles.glowBottomLeft} />
      <div className={styles.grain} />
      <div className={styles.corkFade} aria-hidden="true" />

      <motion.div
        className={styles.inner}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
      >
        {/* ── LEFT: type column ─────────────────────────────────────── */}
        <div className={styles.typeCol}>
        <TunerBox id="left">
          <div className={styles.eyebrow}>{copy?.eyebrow || "Personal"}</div>

          <h1 className={styles.name}>
            Ashzaeen
            <em className={styles.last}>Fatmi Khan</em>
          </h1>

          <div className={styles.roles} aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={role}
                className={styles.role}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              >
                {role}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className={styles.rule} />

          <p className={styles.bio}>
            {copy?.intro || FALLBACK_SECTION_COPY["personal-hero"].intro}
          </p>

          <div className={styles.status} aria-live="polite">
            <div className={styles.statusLabel}>
              <span className={styles.statusDot} />
              Right now
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={activeStatus.slotKey}
                className={styles.statusText}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                {statusText}
              </motion.p>
            </AnimatePresence>
          </div>
        </TunerBox>
        </div>

        {/* ── RIGHT: 3-polaroid stack ───────────────────────────────── */}
        <div className={styles.photoCol}>
        <TunerBox id="right">
          <div className={styles.stackHost}>
            <div className={styles.dustField} aria-hidden="true">
              {dustItems.map((d, i) => (
                <span
                  key={i}
                  className={styles.dustMote}
                  style={{
                    left: `${d.left}%`,
                    top: `${d.top}%`,
                    width: d.size,
                    height: d.size,
                    animationDelay: `${d.delay}s`,
                    animationDuration: `${d.duration}s`,
                  }}
                />
              ))}
            </div>

            <motion.div
              className={styles.polaroidStack}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.5 }}
            >
              {/* Background polaroids — real photos, no chrome. The "far"
                  one shows photo 3 peeking lower-right; the "near" one
                  shows photo 2 peeking lower-left. Neither is interactive. */}
              <div className={`${styles.bgPolaroid} ${styles.bgFar}`} aria-hidden="true">
                <img src={PHOTOS[2].src} alt="" draggable={false} className={styles.bgPhoto} />
              </div>
              <div className={`${styles.bgPolaroid} ${styles.bgNear}`} aria-hidden="true">
                <img src={PHOTOS[1].src} alt="" draggable={false} className={styles.bgPhoto} />
              </div>

              {/* Main polaroid — clickable, opens the carousel. */}
              <button
                type="button"
                className={styles.polaroid}
                onClick={() => setCarouselOpen(true)}
                aria-label="Open the photo gallery"
              >
                <span className={styles.tape} aria-hidden="true" />
                <span className={styles.grainOverlay} aria-hidden="true" />

                <div className={styles.photoFrame}>
                  <img
                    className={styles.photo}
                    src={PHOTOS[0].src}
                    alt={PHOTOS[0].alt}
                    draggable={false}
                  />

                  <svg className={styles.postmark} viewBox="0 0 100 100" aria-hidden="true">
                    <defs>
                      <path id="postmarkArc" d="M 50 50 m -34 0 a 34 34 0 1 1 68 0 a 34 34 0 1 1 -68 0" fill="none" />
                    </defs>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(80,40,90,0.65)" strokeWidth="1.6" />
                    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(80,40,90,0.55)" strokeWidth="0.9" strokeDasharray="2 2" />
                    <text fill="rgba(80,40,90,0.7)" fontSize="6.5" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1.6">
                      <textPath href="#postmarkArc" startOffset="6%">PROCESSED · APR 23 26</textPath>
                    </text>
                    <text fill="rgba(80,40,90,0.7)" fontSize="6.5" fontFamily="ui-monospace, 'JetBrains Mono', monospace" letterSpacing="1.6">
                      <textPath href="#postmarkArc" startOffset="56%">MSY ✈ DFW · F9 1847</textPath>
                    </text>
                    <text x="50" y="54" textAnchor="middle" fill="rgba(80,40,90,0.85)" fontSize="9" fontWeight="700" fontFamily="ui-monospace, 'JetBrains Mono', monospace">
                      NOLA
                    </text>
                  </svg>

                  <svg className={styles.stamp} viewBox="0 0 60 78" aria-hidden="true">
                    <defs>
                      <mask id="perfMask">
                        <rect x="0" y="0" width="60" height="78" fill="white" />
                        {Array.from({ length: 8 }, (_, i) => (
                          <circle key={`t${i}`} cx={4 + i * 7.5} cy="0" r="2" fill="black" />
                        ))}
                        {Array.from({ length: 8 }, (_, i) => (
                          <circle key={`b${i}`} cx={4 + i * 7.5} cy="78" r="2" fill="black" />
                        ))}
                        {Array.from({ length: 11 }, (_, i) => (
                          <circle key={`l${i}`} cx="0" cy={4 + i * 7} r="2" fill="black" />
                        ))}
                        {Array.from({ length: 11 }, (_, i) => (
                          <circle key={`r${i}`} cx="60" cy={4 + i * 7} r="2" fill="black" />
                        ))}
                      </mask>
                    </defs>
                    <g mask="url(#perfMask)">
                      <rect x="0" y="0" width="60" height="78" fill="rgba(245,235,210,0.95)" />
                      <rect x="4" y="4" width="52" height="70" fill="none" stroke="rgba(160,120,60,0.7)" strokeWidth="1" />
                      <g fill="rgba(60,40,18,0.75)">
                        <rect x="22" y="20" width="16" height="36" />
                        <polygon points="22,20 30,8 38,20" />
                        <rect x="14" y="32" width="8" height="24" />
                        <polygon points="14,32 18,22 22,32" />
                        <rect x="38" y="32" width="8" height="24" />
                        <polygon points="38,32 42,22 46,32" />
                      </g>
                      <text x="30" y="68" textAnchor="middle" fill="rgba(60,40,18,0.9)" fontSize="6" fontWeight="700" fontFamily="ui-monospace, 'JetBrains Mono', monospace">
                        USA · 0.78
                      </text>
                    </g>
                  </svg>
                </div>

                <div className={styles.caption}>
                  <span>{typedCaption}</span>
                  <span className={`${styles.typeCursor}${typingDone ? " " + styles.typeCursorDone : ""}`}>|</span>
                </div>
              </button>
            </motion.div>
          </div>
        </TunerBox>
        </div>
      </motion.div>

      <AnimatePresence>
        {carouselOpen && (
          <PhotoCarousel
            key="hero-carousel"
            photos={PHOTOS}
            onClose={() => setCarouselOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Photo carousel modal ─────────────────────────────────────────────
// Album-spread feel: three POLAROID cards on a warm aged-paper desk.
// Active polaroid in the middle, two flanking. Side polaroids stay fully
// opaque (recession via blur + scale, not transparency) so nothing
// bleeds through. Smooth spring transitions on slot changes. Visible
// nav buttons + clean dot row.

// Per-photo deterministic base tilt — so each polaroid always sits at
// the same angle as the center vs. as a side peek, but never matches
// its neighbor exactly. Indexed by photo position in PHOTOS.
const PHOTO_BASE_TILT = [-3, 2, -5];

// Slot-specific motion targets. The polaroids spring between these.
function slotTargets(slot, baseTilt) {
  if (slot === "center") return {
    x: "0%", scale: 1, rotate: baseTilt,
    filter: "blur(0px) saturate(1)",
    opacity: 1, zIndex: 10,
  };
  if (slot === "left") return {
    x: "-78%", scale: 0.62, rotate: baseTilt - 5,
    filter: "blur(2.5px) saturate(0.85)",
    opacity: 0.92, zIndex: 4,
  };
  return {
    x: "78%", scale: 0.62, rotate: baseTilt + 5,
    filter: "blur(2.5px) saturate(0.85)",
    opacity: 0.92, zIndex: 4,
  };
}

function PhotoCarousel({ photos, onClose }) {
  const [index, setIndex] = useState(0);
  const n = photos.length;

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n]);
  const goNext = useCallback(() => setIndex((i) => (i + 1) % n), [n]);
  const goTo = useCallback((i) => setIndex(((i % n) + n) % n), [n]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  // Deterministic dust positions for the modal background (same trick as hero)
  const dustItems = useMemo(
    () => Array.from({ length: 22 }, (_, i) => {
      const seed = i * 53 + 7;
      const r1 = ((seed * 9301 + 49297) % 233280) / 233280;
      const r2 = ((seed * 1234567) % 233280) / 233280;
      const r3 = ((seed * 7853) % 233280) / 233280;
      return {
        left: 4 + r1 * 92,
        top: 4 + r2 * 92,
        delay: r3 * 12,
        duration: 18 + r1 * 10,
        size: 1.2 + r2 * 2,
      };
    }),
    []
  );

  const slotFor = (i) => {
    const delta = (i - index + n) % n;
    if (delta === 0) return "center";
    if (delta === 1) return "right";
    return "left";
  };

  return (
    <motion.div
      className={styles.carouselBg}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={onClose}
    >
      <div className={styles.carouselGrain} aria-hidden="true" />
      <div className={styles.carouselVignette} aria-hidden="true" />
      <div className={styles.carouselDust} aria-hidden="true">
        {dustItems.map((d, i) => (
          <span
            key={i}
            className={styles.dustMote}
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          />
        ))}
      </div>

      <button className={styles.carouselX} onClick={onClose} aria-label="Close">×</button>

      <motion.div
        className={styles.carouselStage}
        onClick={(e) => e.stopPropagation()}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x < -55) goNext();
          else if (info.offset.x > 55) goPrev();
        }}
      >
        {photos.map((p, i) => {
          const slot = slotFor(i);
          const baseTilt = PHOTO_BASE_TILT[i % PHOTO_BASE_TILT.length];
          const isCenter = slot === "center";
          return (
            <motion.div
              key={p.src}
              className={styles.polaroidCard}
              animate={slotTargets(slot, baseTilt)}
              transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.9 }}
              onClick={(e) => {
                if (slot === "left") { e.stopPropagation(); goPrev(); }
                else if (slot === "right") { e.stopPropagation(); goNext(); }
              }}
              role={!isCenter ? "button" : undefined}
              aria-label={!isCenter ? `Show ${p.caption}` : undefined}
              tabIndex={!isCenter ? 0 : -1}
              onKeyDown={(e) => {
                if (isCenter) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  slot === "left" ? goPrev() : goNext();
                }
              }}
            >
              <span className={styles.cardTape} aria-hidden="true" />
              <div className={styles.cardPhotoFrame}>
                <img
                  src={p.src}
                  alt={p.alt}
                  draggable={false}
                  className={styles.cardPhoto}
                />
              </div>
              <div className={styles.cardCaption}>{p.caption}</div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className={styles.carouselNavRow} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.navBtn}
          onClick={goPrev}
          aria-label="Previous photo"
        >
          <span className={styles.navChevron}>‹</span>
          <span className={styles.navLabel}>prev</span>
        </button>

        <div className={styles.carouselDots} role="tablist" aria-label="Photo navigation">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1}`}
              className={`${styles.carouselDot}${i === index ? " " + styles.carouselDotActive : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <button
          className={styles.navBtn}
          onClick={goNext}
          aria-label="Next photo"
        >
          <span className={styles.navLabel}>next</span>
          <span className={styles.navChevron}>›</span>
        </button>
      </div>
    </motion.div>
  );
}
