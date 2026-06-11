"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import styles from "./Pinboard.module.css";
import { ITEMS, SPOS, FLEX_ROWS, INTERACTIVE_BOXES, gallerySlug } from "@/data/pinboard";
import { placeItem, buildExistingBoxes, itemBoundingBox, seededRotationFromId } from "@/lib/pinboard-placement";
import { StaticItem } from "./Items";
import { StringLights, StringConnection } from "./Decorations";
import { ImmersiveWall } from "./ImmersiveWall";
// Memoized so opening a photo/poster modal (setPhoto/setPoster in this section)
// doesn't re-render the wall's 40+ Framer items underneath the modal — that
// re-render was the "laggy" hitch on open. Skips when all props are referentially
// equal, which holds because every prop below is stabilized (useMemo/useCallback).
const MemoImmersiveWall = memo(ImmersiveWall);
import { ImmersiveWallMobile } from "./ImmersiveWallMobile";
// Mobile-first rebuild of the immersive wall. Same memo rationale as desktop:
// keep modal-state flips from re-rendering the wall underneath the modal.
const MemoImmersiveWallMobile = memo(ImmersiveWallMobile);
import PinboardBoardMobile from "./PinboardBoardMobile";
import { useIsMobile } from "./useIsMobile";
import mobileStyles from "./PinboardMobile.module.css";
import { PhotoModal, PosterModal, TripModal, SubwayModal } from "./Modals";
import { useSoundFX } from "./useSoundFX";
import SectionGuide from "@/components/shared/SectionGuide";
import ScrollReveal from "@/components/shared/ScrollReveal";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";

// Static-board design width. The hand-placed items (SPOS) span design-x
// ~6 → ~1324; this frame width hugs that content with a small symmetric
// margin so there's no dead cork on the right. The string lights span the
// same width. Everything on the static board scales/centres relative to it.
const BOARD_DESIGN_W = 1350;

// Shareable picture URL: /personal/gallery/<filename-slug>
const GALLERY_SLUG_PATTERN = /^\/personal\/gallery\/([^/]+)/;

// Section-level entry. Owns:
//   - the static board preview (desktop absolute + mobile flex collapse)
//   - the "Open the Wall" button
//   - the modal state machine: photo / poster / trip / subway / wall
//   - merging curated items with Notion-driven dynamic photos via the
//     deterministic placement algorithm
export default function PinboardSection({ dynamicPhotos = [], curatedOverrides = {}, copy = FALLBACK_SECTION_COPY.gallery }) {
  const [photo, setPhoto] = useState(null);
  const [poster, setPoster] = useState(null);
  const [showTrip, setShowTrip] = useState(false);
  const [showSubway, setShowSubway] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  // Notion-hosted image URLs are pre-signed and expire ~1 hour after fetch.
  // When that happens the browser fails to load them and we surface a
  // handwritten "you've been idle, refresh" note over the immersive wall.
  // Once true we leave it true — refresh is the only path back.
  const [photosExpired, setPhotosExpired] = useState(false);
  // Phone-only Gallery rebuild. SSR-safe: `mounted` stays false (→ desktop) on
  // the server and first client render, so no hydration mismatch; the mobile
  // board/wall swap in after mount. The Gallery sits far below the fold, so the
  // swap is never visible during load.
  const { isMobile, mounted } = useIsMobile();
  const useMobileGallery = mounted && isMobile;
  // SFX hook lives at the section level so receipt/boarding-pass clicks on
  // the static board also trigger paper rustle (the immersive modal has its
  // own instance — that's fine, both are cheap).
  const sfx = useSoundFX();

  // Gates the popstate sync so an initial-load popstate on the canonical
  // /personal/gallery/<slug> route doesn't open a SECOND picture modal beside
  // SlugLandingChoreography's. Flips true on the first in-app open. Mirrors
  // WritingSection.
  const hasInteracted = useRef(false);

  // Time-spent tracking. wall_closed fires when the immersive view closes;
  // gallery_item_closed when a photo/poster modal closes (openItemRef holds
  // whichever was last opened so we know what they were looking at).
  const openItemRef = useRef(null);
  useDwellDuration(wallOpen, (d) => analytics.wallClosed(d));
  useDwellDuration(!!(photo || poster), (d) => analytics.galleryItemClosed(openItemRef.current, d));

  // ── Desktop board sizing ───────────────────────────────────────────
  // The static board is authored for a 1600px-wide frame (fixed-px item
  // positions). Across the whole desktop range we scale the WHOLE board
  // (frame + photos) to a target width and centre it (flex wrapper), so
  // there's ALWAYS symmetric parchment on both sides and the board never
  // stretches edge-to-edge. Two limits define the target:
  //   • absolute ceiling  = DESIGN_W × MAX_ZOOM (the "+10% then stop")
  //   • viewport fraction = clientWidth × MAX_FRAC (guarantees gutters)
  // Whichever is smaller wins. On huge monitors the ceiling binds (board
  // parks at 1760, gutters grow); on ~1500–1900px screens (incl. monitors
  // under Windows display scaling) the fraction binds, shrinking the board
  // a touch so the parchment margins stay visible. Below the mobile
  // breakpoint we hand off to the flex-row layout (boardStyle = null).
  const sectionRef = useRef(null);
  const [boardStyle, setBoardStyle] = useState(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const DESIGN_W = BOARD_DESIGN_W;
    const MAX_ZOOM = 1.10; // +10% absolute ceiling, then the board STOPS growing
    const MAX_FRAC = 0.88; // board ≤ 88% of viewport → ≥6% parchment per side
    const MOBILE_MAX = 1100; // ≤ this width the flex-row board takes over
    const compute = () => {
      const cw = el.clientWidth;
      if (cw <= MOBILE_MAX) {
        setBoardStyle(null);
        return;
      }
      // Expand up to +10%, never past it; on wider screens the board parks
      // and the leftover width becomes symmetric parchment gutters.
      const target = Math.min(DESIGN_W * MAX_ZOOM, cw * MAX_FRAC);
      setBoardStyle({ width: `${DESIGN_W}px`, zoom: target / DESIGN_W });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Curated items with Curated Gallery copy-overrides applied. Only
  // label / story / poem (and optional Wall X/Y) are editable from Notion —
  // image, mount, pin color all stay in data/pinboard.js. Falls back to the
  // hardcoded value when an override field is empty. Shared by BOTH the
  // static section board AND the immersive wall so a photo's title/caption
  // reads identically in either view.
  const curatedItems = useMemo(() => {
    const hasOverrides = curatedOverrides && Object.keys(curatedOverrides).length > 0;
    if (!hasOverrides) return ITEMS;
    return ITEMS.map((item) => {
      const o = curatedOverrides[item.id];
      if (!o) return item;
      // Wall X/Y override only takes effect when BOTH are set —
      // matches the dynamic-photo manual placement rule.
      const positionOverride =
        o.wallX != null && o.wallY != null
          ? { wx: o.wallX, wy: o.wallY }
          : null;
      // Surface the common silent-failure case: only one coord filled.
      if (
        process.env.NODE_ENV !== "production" &&
        !positionOverride &&
        (o.wallX != null) !== (o.wallY != null)
      ) {
        console.warn(
          `[pinboard] Curated item "${item.id}" has only one of Wall X / Wall Y set — fill BOTH (Number type) or the position override is ignored.`
        );
      }
      return {
        ...item,
        label: o.label   || item.label,
        story: o.caption || item.story,
        poem:  o.tagline || item.poem,
        ...(positionOverride || {}),
      };
    });
  }, [curatedOverrides]);

  // id → overridden curated item, for the mobile flex board (replaces the
  // static `byId`, which holds the pre-override copy).
  const curatedById = useMemo(() => {
    const m = {};
    for (const it of curatedItems) m[it.id] = it;
    return m;
  }, [curatedItems]);

  // Merge curated items + Notion-driven photos. Curated keep their hand-tuned
  // positions; dynamic photos run through the deterministic placement
  // algorithm (avoiding curated boxes + interactive zones), and each
  // newly-placed photo gets added back to the "existing" list so subsequent
  // photos avoid it too. useMemo so we don't re-place on every render.
  // `_dynamic: true` tag marks the Notion-hosted items so WallItem knows to
  // wire `onError`/`loading="lazy"` (curated photos don't need either).
  const wallItems = useMemo(() => {
    if (!dynamicPhotos.length) return curatedItems;

    // Place dynamic (Gallery DB) photos around the curated items.
    const existing = buildExistingBoxes(curatedItems, INTERACTIVE_BOXES);
    // Two-pass: place manually-positioned photos first (they're authoritative
    // — overlap with curated is allowed since the user explicitly chose the
    // spot), then auto-place the rest so they avoid both curated AND manual.
    const manual = dynamicPhotos.filter((p) => p.manualX != null && p.manualY != null);
    const auto   = dynamicPhotos.filter((p) => p.manualX == null || p.manualY == null);

    const placedManual = manual.map((p) => ({
      ...p,
      wx: p.manualX,
      wy: p.manualY,
      wr: seededRotationFromId(p.id),
      _dynamic: true,
    }));
    placedManual.forEach((p) => existing.push(itemBoundingBox(p)));

    const placedAuto = auto.map((photo) => {
      const placement = placeItem(photo, existing);
      const merged = { ...photo, ...placement, _dynamic: true };
      existing.push(itemBoundingBox(merged));
      return merged;
    });

    return [...curatedItems, ...placedManual, ...placedAuto];
  }, [dynamicPhotos, curatedItems]);

  // Stable (no deps) so it doesn't break memoization of the board / wall.
  const onDynamicImageError = useCallback(() => setPhotosExpired(true), []);

  // Slug → picture lookup over ALL shareable items (curated board + immersive-
  // only dynamic photos), so a popstate / shared URL resolves either source.
  const slugToItem = useMemo(() => {
    const map = {};
    for (const it of wallItems) {
      if (it.type !== "photo" && it.type !== "poster") continue;
      const s = gallerySlug(it);
      if (s && !map[s]) map[s] = it;
    }
    return map;
  }, [wallItems]);

  // playRustle is useCallback-stable inside useSoundFX; pull it out so the
  // handlers below can list a stable dependency (the sfx object itself is a
  // fresh literal each render).
  const { playRustle } = sfx;

  // Open a picture AND push a shareable slug URL (so it's linkable + appears
  // in history). Receipt / boarding-pass aren't pictures — no slug.
  // All callbacks are useCallback-stable so the static board (useMemo) and the
  // immersive wall (memo) don't re-render when modal state flips — that re-render
  // was the lag on open.
  const openPicture = useCallback((item) => {
    if (item.type === "photo") setPhoto(item);
    else setPoster(item);
    openItemRef.current = item;
    analytics.galleryItemOpened(item);
    hasInteracted.current = true;
    window.history.pushState({}, "", `/personal/gallery/${gallerySlug(item)}`);
  }, []);

  // Close the picture modal and restore the clean landing URL.
  const closePicture = useCallback(() => {
    setPhoto(null);
    setPoster(null);
    window.history.pushState({}, "", "/personal");
  }, []);

  // Back/forward sync — gated so it never fires on direct-load (choreography
  // owns that modal). Opens whatever slug the URL now carries, or closes.
  useEffect(() => {
    function onPop() {
      if (!hasInteracted.current) return;
      const slug = window.location.pathname.match(GALLERY_SLUG_PATTERN)?.[1];
      const item = slug ? slugToItem[slug] : null;
      if (!item) { setPhoto(null); setPoster(null); return; }
      if (item.type === "poster") { setPoster(item); setPhoto(null); }
      else { setPhoto(item); setPoster(null); }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [slugToItem]);

  const handleAny = useCallback((item) => {
    if (item.type === "photo" || item.type === "poster") openPicture(item);
    else if (item.type === "receipt") { setShowSubway(true); playRustle(); analytics.wallPaperOpened("subway_receipt"); }
    else if (item.type === "boarding-pass") { setShowTrip(true); playRustle(); analytics.wallPaperOpened("boarding_pass"); }
  }, [openPicture, playRustle]);

  // Stable wall-close so MemoImmersiveWall stays memoized.
  const closeWall = useCallback(() => setWallOpen(false), []);

  // The static preview board (desktop absolute + mobile flex), memoized so a
  // modal open (setPhoto/setPoster) doesn't re-create ~30 StaticItems on the
  // same frame the modal mounts. Deps are all stable, so the board element is
  // reused on modal-state changes and React skips re-rendering it entirely.
  const board = useMemo(() => (
    <div style={boardStyle ? { display: "flex", justifyContent: "center" } : undefined}>
    <div className={styles.boardFrame} style={boardStyle || undefined}>
      <div className={styles.nail} />
      <StringLights width={BOARD_DESIGN_W} />

      {/* Desktop: absolutely positioned static board */}
      <div className={styles.boardAbs}>
        {curatedItems.filter((i) => SPOS[i.id]).map((item) => {
          const p = SPOS[item.id];
          return (
            <StaticItem
              key={item.id}
              item={item}
              onAnyClick={handleAny}
              rotation={p.rot}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                transformOrigin: item.mount === "pin" ? "top center" : "center center",
              }}
            />
          );
        })}
        <StringConnection />
      </div>

      {/* Mobile: flex rows */}
      <div className={styles.boardFlex}>
        {FLEX_ROWS.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: "26px 20px",
              width: "100%",
              marginBottom: 28,
            }}
          >
            {row.map((id) => {
              const item = curatedById[id];
              if (!item) return null;
              // Scale down 80% (or 65% on very narrow phones) so the row fits.
              const sc = typeof window !== "undefined" && window.innerWidth < 500 ? 0.65 : 0.8;
              return (
                <StaticItem
                  key={id}
                  item={{ ...item, dH: Math.round((item.dH || 220) * sc) }}
                  onAnyClick={handleAny}
                  rotation={SPOS[id]?.rot || 0}
                  style={{
                    transformOrigin: item.mount === "pin" ? "top center" : "center center",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom-centre nail — mirrors the top nail so the board reads as
          pinned to the wall at both ends instead of bleeding off-frame. */}
      <div className={`${styles.nail} ${styles.nailBottom}`} />
    </div>
    </div>
  ), [boardStyle, curatedItems, curatedById, handleAny]);

  // Redesigned phone teaser (separate component, desktop board untouched).
  // Memoized on the same stable deps so a modal open never re-renders it.
  const mobileBoard = useMemo(
    () => <PinboardBoardMobile itemsById={curatedById} onAnyClick={handleAny} />,
    [curatedById, handleAny]
  );

  return (
    <section id="gallery" className={styles.wallSection} ref={sectionRef}>
      {/* Header + CTA fade-up on first scroll into view. Board is outside the
          ScrollReveal so it paints at full opacity — avoids the mobile flash
          where the browser defers painting the heavy board background until the
          opacity transition fires. Fixed-position modals must stay outside any
          `transform`-bearing ancestor, so they remain siblings of this block. */}
      <ScrollReveal>
      <div className={styles.wallHdr}>
        <div className={styles.wallHdrText}>
          <div className={styles.sLabel}>✦ {copy.eyebrow}</div>
          <h2 className={styles.sTitle}>{copy.title}</h2>
          <p className={styles.sSub}>{copy.intro}</p>
          <div className={styles.goldRule} />
          {copy.instruction && <SectionGuide className="desktop-only">{copy.instruction}</SectionGuide>}
          {copy.instructionMobile && <SectionGuide className="mobile-only">{copy.instructionMobile}</SectionGuide>}
        </div>
      </div>

      <div className={styles.ctaRow}>
        <button
          className={styles.wallCTA}
          onClick={() => { setWallOpen(true); analytics.wallOpened(); }}
          aria-label="Open Immersive View"
        >
          <span className={styles.ctaAura} aria-hidden="true" />
          <span className={styles.ctaSheen} aria-hidden="true" />
          <span className={styles.ctaText}>Open Immersive View</span>
          <span className={styles.ctaArrow} aria-hidden="true">→</span>
        </button>
      </div>
      </ScrollReveal>

      {/* When capped, this wrapper flex-centers the (zoomed) board so the
          leftover width becomes symmetric parchment gutters on BOTH sides.
          When fluid (boardStyle null), it's a plain full-width block and the
          board keeps its CSS `margin: 0 64px` behavior. Memoized above. The
          shell reserves height so the post-mount desktop→mobile swap on phones
          causes no layout shift. */}
      <div className={mobileStyles.boardShell}>
        {useMobileGallery ? mobileBoard : board}
      </div>

      <AnimatePresence>
        {wallOpen && (
          useMobileGallery ? (
            <MemoImmersiveWallMobile
              key="wall"
              items={wallItems}
              onClose={closeWall}
              onAnyClick={handleAny}
              onDynamicImageError={onDynamicImageError}
              photosExpired={photosExpired}
            />
          ) : (
            <MemoImmersiveWall
              key="wall"
              items={wallItems}
              onClose={closeWall}
              onAnyClick={handleAny}
              onDynamicImageError={onDynamicImageError}
              photosExpired={photosExpired}
            />
          )
        )}
      </AnimatePresence>
      <AnimatePresence>
        {poster && <PosterModal key={poster.id} item={poster} onClose={closePicture} />}
      </AnimatePresence>
      <AnimatePresence>
        {photo && <PhotoModal key={photo.id} item={photo} onClose={closePicture} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSubway && <SubwayModal onClose={() => setShowSubway(false)} data={curatedOverrides.subway} />}
      </AnimatePresence>
      <AnimatePresence>
        {showTrip && <TripModal onClose={() => setShowTrip(false)} body={curatedOverrides.frontier?.bodyRich} />}
      </AnimatePresence>
    </section>
  );
}
