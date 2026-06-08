"use client";

import { useState, useEffect, useRef } from "react";
import ScrollReveal from "@/components/shared/ScrollReveal";
import SectionGuide from "@/components/shared/SectionGuide";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import styles from "./SeriesSection.module.css";
import { analytics } from "@/lib/analytics";

/* ── Metadata helpers ────────────────────────────────────── */
// A film (Type="Movie" in Notion) has no seasons/episodes; an ongoing series
// shouldn't flaunt a season/episode count that's perpetually out of date.
const isMovie = (show) => (show?.type ?? "").toLowerCase() === "movie";
const isOngoing = (show) => (show?.status ?? "").toUpperCase() === "ONGOING";

// Long form for the cinema screen: "Movie" / "Still Airing" / "3 seasons · 26 ep".
const coreMeta = (show) =>
  isMovie(show)
    ? "Movie"
    : isOngoing(show)
    ? "Still Airing"
    : `${show.seasons} seasons · ${show.episodes} ep`;

// Compact form for the ticket stub: "Movie" / "Still Airing" / "S5 · 62 ep".
const ticketMeta = (show) =>
  isMovie(show)
    ? "Movie"
    : isOngoing(show)
    ? "Still Airing"
    : `S${show.seasons} · ${show.episodes} ep`;

/* ── Corner ornament ─────────────────────────────────────── */
function CornerOrnament({ pos }) {
  const flipX = pos === "tr" || pos === "br";
  const flipY = pos === "bl" || pos === "br";
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 3,
        ...(pos[0] === "t" ? { top: 8 } : { bottom: 8 }),
        ...(pos[1] === "l" ? { left: 8 } : { right: 8 }),
        transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
        pointerEvents: "none",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28">
        <path d="M 3 25 L 3 3 L 25 3" fill="none" stroke="rgba(196,160,80,0.65)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3" cy="3" r="2.8" fill="rgba(196,160,80,0.6)" />
        <circle cx="10" cy="3" r="1.2" fill="rgba(196,160,80,0.3)" />
        <circle cx="3" cy="10" r="1.2" fill="rgba(196,160,80,0.3)" />
        <circle cx="17" cy="3" r="0.8" fill="rgba(196,160,80,0.16)" />
        <circle cx="3" cy="17" r="0.8" fill="rgba(196,160,80,0.16)" />
      </svg>
    </div>
  );
}

/* ── Crosshair SVG ───────────────────────────────────────── */
function CrosshairSvg() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" className={styles.crosshairSvg}>
      <line x1="15" y1="1" x2="15" y2="11" stroke="rgba(255,242,200,0.78)" strokeWidth="1" />
      <line x1="15" y1="19" x2="15" y2="29" stroke="rgba(255,242,200,0.78)" strokeWidth="1" />
      <line x1="1" y1="15" x2="11" y2="15" stroke="rgba(255,242,200,0.78)" strokeWidth="1" />
      <line x1="19" y1="15" x2="29" y2="15" stroke="rgba(255,242,200,0.78)" strokeWidth="1" />
      <circle cx="15" cy="15" r="3.5" stroke="rgba(255,242,200,0.78)" strokeWidth="1" fill="none" />
    </svg>
  );
}

/* ── Poster panel ────────────────────────────────────────── */
// Square poster on the cinema screen. With a Poster Media file it renders the
// image under a soft lobby-card sheen; without one it falls back to a
// sprocket-edged "slide" carrying the show's initial in its accent colour.
function PosterPanel({ show, className = "" }) {
  if (show.poster) {
    return (
      <div className={`${styles.posterPanel} ${className}`}>
        <img className={styles.posterImg} src={show.poster} alt={`${show.title} poster`} loading="lazy" />
        <div className={styles.posterSheen} />
      </div>
    );
  }
  const initial = (show.title || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`${styles.posterPanel} ${styles.posterFallback} ${className}`}
      style={{ background: show.bg }}
      aria-hidden="true"
    >
      <span className={styles.posterMonogram} style={{ color: show.accentColor }}>{initial}</span>
      <span className={styles.posterFallbackLabel}>Reel &mdash;</span>
    </div>
  );
}

/* ── Full-width 35mm film-strip ticker ───────────────────── */
function FilmStrip({ shows }) {
  // Two consecutive copies make the -50% marquee scroll seamless.
  const reel = [...shows, ...shows];
  return (
    <div className={styles.filmReel} aria-hidden="true">
      <div className={styles.sprocketRow} />
      <div className={styles.frameTrack}>
        {reel.map((s, i) => (
          <div className={styles.filmFrame} key={`${s.id}-${i}`}>
            <span className={styles.frameStar}>★</span>
            <span className={styles.frameTitle}>{s.title}</span>
          </div>
        ))}
      </div>
      <div className={styles.sprocketRow} />
      <div className={styles.filmGate} />
    </div>
  );
}

/* ── Cinema screen ───────────────────────────────────────── */
function CinemaScreen({ displayShow, shows, spoilers, revealed, onReveal, curtainsClosed }) {
  const spotlightRef = useRef(null);
  const isBlurred = spoilers && !revealed.has(displayShow.id);
  const reelIndex = shows.findIndex((s) => s.id === displayShow.id) + 1;

  const handleMouseMove = (e) => {
    if (!spotlightRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    spotlightRef.current.style.background = `radial-gradient(ellipse 42% 34% at ${x}% ${y}%, rgba(255,242,200,0.09) 0%, transparent 100%)`;
  };

  const handleMouseLeave = () => {
    if (!spotlightRef.current) return;
    spotlightRef.current.style.background = `radial-gradient(ellipse 42% 34% at 50% 42%, rgba(255,242,200,0.04) 0%, transparent 100%)`;
  };

  return (
    <div className={styles.frameWrap}>
      <div className={styles.frame}>
        <div className={styles.frameGrain} />
        <div className={styles.frameInnerBorder} />
        <CornerOrnament pos="tl" />
        <CornerOrnament pos="tr" />
        <CornerOrnament pos="bl" />
        <CornerOrnament pos="br" />
        <div className={styles.reelCounter}>
          {String(reelIndex).padStart(2, "0")} / {String(shows.length).padStart(2, "0")}
        </div>

        <div
          className={styles.screen}
          style={{ background: displayShow.bg }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className={styles.letterboxTop} />
          <div className={styles.filmGrain} />
          <div className={styles.screenTint} />
          <div className={styles.scanLines} />
          <div className={styles.vignette} />
          <div className={styles.projectionCone} />
          <div ref={spotlightRef} className={styles.spotlight} />

          <div key={displayShow.id} className={styles.screenInner}>
            {/* Top marquee line */}
            <div className={styles.lobbyTop}>
              <span className={styles.presentedStar} style={{ color: displayShow.accentColor }}>★</span>
              <span className={styles.presentedText} style={{ color: displayShow.accentColor }}>PRESENTED</span>
              <span className={styles.presentedStar} style={{ color: displayShow.accentColor }}>★</span>
            </div>

            {/* Lobby head — poster (left col) beside title / verdict / hot take (right col) */}
            <div className={styles.lobbyHead}>
              <div className={styles.lobbyPosterCol}>
                <PosterPanel show={displayShow} className={styles.posterPanelDesktop} />
              </div>

              <div className={styles.lobbyText}>
                <h3 className={styles.showTitle}>{displayShow.title}</h3>
                <div className={styles.titleDivider} style={{ background: displayShow.accentColor }} />
                <div className={styles.seasonLine}>
                  {coreMeta(displayShow)}{displayShow.years ? ` · ${displayShow.years}` : ""}
                </div>

                <div className={styles.verdictBlock}>
                  <div className={styles.verdictLabel}>&#8212; A Verdict So Far &#8212;</div>
                  <div className={styles.verdictTagRow}>
                    <span className={styles.verdictTick} style={{ background: displayShow.accentColor }} />
                    <span className={styles.verdictText} style={{ color: displayShow.accentColor }}>
                      {displayShow.verdict}
                    </span>
                  </div>
                </div>

                <div className={styles.hotWrap}>
                  <p
                    className={styles.hotTake}
                    style={{
                      filter: isBlurred ? "blur(5px)" : "none",
                      cursor: isBlurred ? "pointer" : "default",
                      userSelect: isBlurred ? "none" : "auto",
                    }}
                    onClick={() => isBlurred && onReveal(displayShow.id)}
                  >
                    {displayShow.hot}
                  </p>
                  {isBlurred && (
                    <div className={styles.revealHint}>&#8212; click to reveal &#8212;</div>
                  )}
                </div>
              </div>
            </div>

            {/* Screen-wide centered CTA — sits below both columns, like PRESENTED above */}
            {displayShow.buttonUrl && !spoilers && (
              <div className={styles.lobbyCta}>
                <a
                  href={displayShow.buttonUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.screenBtn}
                  style={{ borderColor: displayShow.accentColor, color: displayShow.accentColor }}
                >
                  {displayShow.buttonLabel || "Watch Trailer"}
                </a>
              </div>
            )}

            {/* Stats bar */}
            <div className={styles.statsBar}>
              {(isMovie(displayShow)
                ? [
                    ["RUNTIME", displayShow.runtime],
                    ["YEAR", displayShow.years],
                  ]
                : [
                    ["EP", displayShow.episodes],
                    ["RUNTIME", displayShow.runtime],
                    ["YEARS", displayShow.years],
                  ]
              ).map(([label, val]) => (
                <div key={label} className={styles.stat}>
                  <span className={styles.statLabel}>{label}</span>
                  <span className={styles.statVal}>{val}</span>
                </div>
              ))}
              <div className={styles.statDivider} />
              <div className={styles.genreTags}>
                {displayShow.genres.slice(0, 3).map((g) => (
                  <span key={g} className={styles.genreTag}>{g}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Velvet curtain overlay */}
          <div className={`${styles.curtainOverlay} ${curtainsClosed ? styles.curtainsClosed : ""}`}>
            <div
              className={styles.curtainLeft}
              style={{
                background: `linear-gradient(170deg, ${displayShow.accentColor}d8 0%, ${displayShow.accentColor}88 50%, ${displayShow.accentColor}b8 100%)`,
              }}
            />
            <div
              className={styles.curtainRight}
              style={{
                background: `linear-gradient(190deg, ${displayShow.accentColor}b8 0%, ${displayShow.accentColor}88 50%, ${displayShow.accentColor}d8 100%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Barcode (printed on the ticket stub) ────────────────── */
const BARCODE_BARS = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2];
function Barcode() {
  return (
    <div className={styles.barcode} aria-hidden="true">
      {BARCODE_BARS.map((w, i) => (
        <span key={i} style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

/* ── Ticket face (shared by desktop + mobile) ────────────── */
function TicketFace({ show, index, active }) {
  return (
    <>
      <div className={styles.ticketAccent} style={{ background: show.accentColor }} />
      <div className={styles.ticketBody}>
        <div className={styles.ticketHeaderRow}>
          <span className={styles.ticketTheater}>The Screening Room · Admit One</span>
          <div className={styles.ticketStatusGroup}>
            {active && <div className={styles.ticketLoaded} />}
            <div className={styles.statusBadge} data-status={show.status}>
              {show.status}
            </div>
          </div>
        </div>

        <div className={styles.ticketTitle}>{show.title}</div>

        <div className={styles.ticketMetaRow}>
          <span className={styles.ticketMeta}>
            {ticketMeta(show)}
          </span>
          <span className={styles.ticketVerdict} style={{ color: show.accentColor }}>
            {show.verdict}
          </span>
        </div>
      </div>

      {/* Perforated tear seam */}
      <div className={styles.ticketSeam} aria-hidden="true" />

      {/* Tear-off stub */}
      <div className={styles.ticketStub}>
        <span className={styles.admitLabel}>Admit</span>
        <span className={styles.admitLabel}>One</span>
        <span className={styles.stubNum}>{String(index + 1).padStart(2, "0")}</span>
        <Barcode />
      </div>
    </>
  );
}

/* ── Ticket card (desktop) ───────────────────────────────── */
function TicketCard({ show, index, active, onClick }) {
  return (
    <div
      className={`${styles.ticket} ${active ? styles.ticketActive : ""}`}
      onClick={onClick}
    >
      <TicketFace show={show} index={index} active={active} />
    </div>
  );
}

/* ── Desktop layout ──────────────────────────────────────── */
function SeriesDesktop({ shows, copy }) {
  const [activeId, setActiveId] = useState(shows[0].id);
  const [displayId, setDisplayId] = useState(shows[0].id);
  const [curtainsClosed, setCurtainsClosed] = useState(true);
  const [spoilers, setSpoilers] = useState(false);
  const [revealed, setRevealed] = useState(new Set());
  const wrapRef = useRef(null);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("spoilerSafe");
      if (saved !== null) setSpoilers(saved === "true");
    } catch {}
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealedRef.current) {
          hasRevealedRef.current = true;
          setTimeout(() => setCurtainsClosed(false), 500);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleSpoilers = () => {
    const next = !spoilers;
    analytics.seriesSpoilersToggled(next);
    setSpoilers(next);
    setRevealed(new Set());
    try { localStorage.setItem("spoilerSafe", String(next)); } catch {}
  };

  function handleSelectShow(id) {
    if (id === activeId) return;
    analytics.seriesShowSelected(shows.find((s) => s.id === id));
    setActiveId(id);
    setCurtainsClosed(true);
    setTimeout(() => {
      setDisplayId(id);
      setTimeout(() => setCurtainsClosed(false), 80);
    }, 320);
  }

  const displayShow = shows.find((s) => s.id === displayId) ?? shows[0];

  return (
    <div className={styles.desktopWrap} ref={wrapRef}>
      <ScrollReveal className={styles.desktopInner}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.eyebrow}>&#10022; {copy.eyebrow}</div>
            <h2 className={styles.sectionTitle}>{copy.title}</h2>
            <p className={styles.sectionSub}>{copy.intro}</p>
            <div className={styles.rule} />
            {copy.instruction && <SectionGuide>{copy.instruction}</SectionGuide>}
          </div>
          <button
            className={`${styles.spoilerToggle} ${spoilers ? styles.spoilerOn : ""}`}
            onClick={toggleSpoilers}
          >
            {spoilers ? "🔓 Spoilers On" : "🔒 Spoiler Safe"}
          </button>
        </div>

        <div className={styles.grid}>
          <CinemaScreen
            displayShow={displayShow}
            shows={shows}
            spoilers={spoilers}
            revealed={revealed}
            onReveal={(id) => { analytics.seriesSpoilerRevealed(id); setRevealed((p) => new Set([...p, id])); }}
            curtainsClosed={curtainsClosed}
          />
          <div className={styles.ticketList}>
            {shows.map((show, i) => (
              <TicketCard
                key={show.id}
                show={show}
                index={i}
                active={show.id === activeId}
                onClick={() => handleSelectShow(show.id)}
              />
            ))}
          </div>
        </div>
      </ScrollReveal>

      <FilmStrip shows={shows} />
      <div className={styles.seatIndicator}>Row A, Seat 7</div>
    </div>
  );
}

/* ── Mobile ticket — same face, mobile wrapper ───────────── */
function MobileTicket({ show, index, active, onClick }) {
  return (
    <div
      className={`${styles.mobileTicket} ${active ? styles.mobileTicketActive : ""}`}
      onClick={onClick}
    >
      <TicketFace show={show} index={index} active={active} />
    </div>
  );
}

/* ── Mobile layout ───────────────────────────────────────── */
function SeriesMobile({ shows, copy }) {
  const [activeId, setActiveId] = useState(shows[0].id);
  const [curtainsClosed, setCurtainsClosed] = useState(true);
  const [spoilers, setSpoilers] = useState(false);
  const [revealed, setRevealed] = useState(new Set());
  const screenRef = useRef(null);
  const spotlightRef = useRef(null);
  const crosshairRef = useRef(null);
  // Position in a ref: direct DOM mutations, zero React re-renders on move.
  const posRef = useRef({ x: 50, y: 40 });
  const draggingRef = useRef(false);
  // Rect cached once at pointerdown — avoids getBoundingClientRect() on every
  // move frame (which forces a layout reflow and is the source of jitter).
  const gestureRectRef = useRef(null);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("spoilerSafe");
      if (saved !== null) setSpoilers(saved === "true");
    } catch {}
  }, []);

  /* Open curtains on first scroll-into-view */
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRevealedRef.current) {
          hasRevealedRef.current = true;
          setTimeout(() => setCurtainsClosed(false), 500);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggleSpoilers = () => {
    const next = !spoilers;
    analytics.seriesSpoilersToggled(next);
    setSpoilers(next);
    setRevealed(new Set());
    try { localStorage.setItem("spoilerSafe", String(next)); } catch {}
  };

  function handleSelectShow(id) {
    if (id === activeId) return;
    analytics.seriesShowSelected(shows.find((s) => s.id === id));
    /* If the projector screen isn't comfortably in view (e.g. the user
       tapped a ticket far below it), slide it up so the incoming content
       is actually visible. Offset for the fixed navbar; only scroll when
       it's actually needed so already-visible selections don't jump. */
    const el = screenRef.current;
    if (el) {
      const navOffset = 64;
      const rect = el.getBoundingClientRect();
      const tooHigh = rect.top < navOffset - 4;
      const tooLow = rect.top > window.innerHeight * 0.4;
      if (tooHigh || tooLow) {
        window.scrollTo({
          top: window.scrollY + rect.top - navOffset,
          behavior: "smooth",
        });
      }
    }
    /* Curtain transition */
    setCurtainsClosed(true);
    setTimeout(() => {
      setActiveId(id);
      setTimeout(() => setCurtainsClosed(false), 80);
    }, 320);
  }

  /* ── Spotlight / crosshair drag ─────────────────────────────────────
     A drag only starts when the touch lands ON the crosshair (within GRAB_R
     of its current centre) — tapping elsewhere does nothing and leaves the
     tap free for the CTA button / spoiler reveal. The rect is cached once at
     pointerdown and reused for every move (no per-frame reflow). Pointer is
     captured for the gesture so the drag keeps tracking even if the finger
     slides off the small crosshair target. */
  const GRAB_R = 44; // px radius around the crosshair centre that counts as a grab

  function applyPos(rawX, rawY) {
    const x = Math.max(5, Math.min(95, rawX));
    const y = Math.max(5, Math.min(95, rawY));
    posRef.current = { x, y };
    if (spotlightRef.current) {
      spotlightRef.current.style.background =
        `radial-gradient(ellipse 55% 45% at ${x}% ${y}%, rgba(255,242,200,0.12) 0%, transparent 100%)`;
    }
    if (crosshairRef.current) {
      crosshairRef.current.style.left = `${x}%`;
      crosshairRef.current.style.top  = `${y}%`;
    }
  }

  function onScreenPointerDown(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Crosshair centre in px from its current % position.
    const cx = rect.left + (posRef.current.x / 100) * rect.width;
    const cy = rect.top  + (posRef.current.y / 100) * rect.height;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > GRAB_R) return; // not on the crosshair → ignore
    draggingRef.current = true;
    gestureRectRef.current = rect; // cache once for the whole gesture
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // No teleport — the crosshair stays put until the finger actually moves it.
  }

  function onScreenPointerMove(e) {
    if (!draggingRef.current || !gestureRectRef.current) return;
    const rect = gestureRectRef.current;
    applyPos(
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top)  / rect.height) * 100,
    );
  }

  function onScreenPointerUp(e) {
    draggingRef.current = false;
    gestureRectRef.current = null;
    e?.currentTarget?.releasePointerCapture?.(e.pointerId);
  }

  const activeShow = shows.find((s) => s.id === activeId) ?? shows[0];
  const isBlurred = spoilers && !revealed.has(activeShow.id);

  return (
    <div className={styles.mobileWrap}>
      <div className={styles.mobileHeader}>
        <div>
          <div className={styles.eyebrow}>&#10022; {copy.eyebrow}</div>
          <h2 className={styles.mobileSectionTitle}>{copy.title}</h2>
          <p className={styles.mobileSub}>{copy.introMobile}</p>
          {copy.instructionMobile && <SectionGuide>{copy.instructionMobile}</SectionGuide>}
        </div>
        <button
          className={`${styles.spoilerToggle} ${spoilers ? styles.spoilerOn : ""}`}
          onClick={toggleSpoilers}
        >
          {spoilers ? "🔓" : "🔒"} {spoilers ? "Spoilers On" : "Safe"}
        </button>
      </div>

      {/* Projector screen */}
      <div
        ref={screenRef}
        className={styles.mobileScreen}
        style={{ background: activeShow.bg }}
        onPointerDown={onScreenPointerDown}
        onPointerMove={onScreenPointerMove}
        onPointerUp={onScreenPointerUp}
        onPointerCancel={onScreenPointerUp}
      >
        <div className={styles.filmGrain} />
        <div className={styles.screenTint} />
        <div className={styles.scanLines} />
        <div className={styles.vignette} />
        <div className={styles.projectionCone} />
        <div
          ref={spotlightRef}
          className={styles.spotlight}
          style={{
            background: `radial-gradient(ellipse 55% 45% at ${posRef.current.x}% ${posRef.current.y}%, rgba(255,242,200,0.12) 0%, transparent 100%)`,
          }}
        />

        {/* Crosshair — visual only, handlers are on the screen element */}
        <div
          ref={crosshairRef}
          className={styles.crosshair}
          style={{ left: `${posRef.current.x}%`, top: `${posRef.current.y}%` }}
        >
          <CrosshairSvg />
        </div>

        <div key={activeShow.id} className={styles.mobileScreenContent}>
          <div className={styles.nowScreeningRow}>
            <div className={styles.screeningLine} style={{ background: activeShow.accentColor }} />
            <span className={styles.nowScreening} style={{ color: activeShow.accentColor }}>NOW SCREENING</span>
            <div className={styles.screeningLine} style={{ background: activeShow.accentColor }} />
          </div>
          <div className={styles.mobileLobbyHead}>
            <PosterPanel show={activeShow} className={styles.posterPanelMobile} />
            <div className={styles.mobileHeadText}>
              <h3 className={styles.showTitle}>{activeShow.title}</h3>
              <div className={styles.seasonLine}>{coreMeta(activeShow)}</div>
              <div className={styles.verdictStamp} style={{ borderColor: activeShow.accentColor, color: activeShow.accentColor }}>
                {activeShow.verdict}
              </div>
            </div>
          </div>

          {/* Hot take on screen */}
          <div className={styles.mobileHotWrap}>
            <p
              className={styles.mobileHotTake}
              style={{
                filter: isBlurred ? "blur(5px)" : "none",
                cursor: isBlurred ? "pointer" : "default",
                userSelect: isBlurred ? "none" : "auto",
              }}
              onClick={() => { if (isBlurred) { analytics.seriesSpoilerRevealed(activeShow.id); setRevealed((p) => new Set([...p, activeShow.id])); } }}
            >
              {activeShow.hot}
            </p>
            {isBlurred && (
              <div className={styles.revealHint}>&#8212; tap to reveal &#8212;</div>
            )}
          </div>

          {/* CTA button — hidden when spoilers on */}
          {activeShow.buttonUrl && !spoilers && (
            <a
              href={activeShow.buttonUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.screenBtn}
              style={{ borderColor: activeShow.accentColor, color: activeShow.accentColor }}
              onClick={(e) => e.stopPropagation()}
            >
              {activeShow.buttonLabel || "Watch Trailer"}
            </a>
          )}
        </div>

        {/* Velvet curtain overlay */}
        <div className={`${styles.curtainOverlay} ${curtainsClosed ? styles.curtainsClosed : ""}`}>
          <div
            className={styles.curtainLeft}
            style={{
              background: `linear-gradient(170deg, ${activeShow.accentColor}d8 0%, ${activeShow.accentColor}88 50%, ${activeShow.accentColor}b8 100%)`,
            }}
          />
          <div
            className={styles.curtainRight}
            style={{
              background: `linear-gradient(190deg, ${activeShow.accentColor}b8 0%, ${activeShow.accentColor}88 50%, ${activeShow.accentColor}d8 100%)`,
            }}
          />
        </div>
      </div>

      <div className={styles.mobileTicketList}>
        {shows.map((show, i) => (
          <MobileTicket
            key={show.id}
            show={show}
            index={i}
            active={show.id === activeId}
            onClick={() => handleSelectShow(show.id)}
          />
        ))}
      </div>

      {/* Film strip closes the section — separates Series from Gallery below. */}
      <FilmStrip shows={shows} />
    </div>
  );
}

/* ── Section export ──────────────────────────────────────── */
export default function SeriesSection({ shows, copy = FALLBACK_SECTION_COPY.series }) {
  if (!shows?.length) return null;
  return (
    <section id="series">
      <div className="desktop-only">
        <SeriesDesktop shows={shows} copy={copy} />
      </div>
      <div className="mobile-only">
        <SeriesMobile shows={shows} copy={copy} />
      </div>
    </section>
  );
}
