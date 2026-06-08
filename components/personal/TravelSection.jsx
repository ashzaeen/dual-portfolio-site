"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeader from "@/components/shared/SectionHeader";
import ScrollReveal from "@/components/shared/ScrollReveal";
import ViewMore from "@/components/shared/ViewMore";
import SectionGuide from "@/components/shared/SectionGuide";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import Postcard from "./Postcard";
import StoryModal from "./story/StoryModal";
import StoryView from "./story/StoryView";
import StoryIndex from "./story/StoryIndex";
import AllStopsBook from "./AllStopsBook";
import styles from "./TravelSection.module.css";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";
import mapStyles from "./TravelMap.module.css";

const TravelMap = dynamic(() => import("./TravelMap"), { ssr: false });
const MobileTravelMap = dynamic(() => import("./MobileTravelMap"), {
  ssr: false,
});

const ROTATIONS = [-2.2, 1.5, -1.0, 0.8, -1.8, 1.2];
const CAROUSEL_SIZE = 6;

// Featured locations sort by Notion's last_edited_time desc so the most
// recently toggled "Show on Carousel" row lands leftmost. Falls back to
// the Notion Order (input array order) when last_edited_time is absent —
// e.g. the static /data/locations.js fallback bundle.
function sortFeatured(locs) {
  return [...locs]
    .filter((l) => l.carousel !== false)
    .sort((a, b) => {
      const at = a.lastEditedTime || "";
      const bt = b.lastEditedTime || "";
      if (at === bt) return 0;
      return at > bt ? -1 : 1;
    });
}

// In-app clicks open the story modal LOCALLY (state + history.pushState),
// not via router.push. All travel data is already in props so there's
// nothing to fetch. URL still updates so it's shareable; popstate keeps
// state in sync with browser back/forward.
//
// URL grammar:
//   /personal/travel/<X>          — single story (X = story slug) OR
//                                   index for a multi-story location (X = loc id)
//   /personal/travel/<X>/<Y>      — nested: X is multi-story location id,
//                                   Y is a story slug under it. Renders index +
//                                   story stacked.
const SLUG_PATTERN_NESTED = /^\/personal\/travel\/([^/]+)\/([^/]+)/;
const SLUG_PATTERN_SINGLE = /^\/personal\/travel\/([^/]+)/;

export default function TravelSection({
  locations = [],
  storiesBySlug = {},
  locationStories = {},
  copy = FALLBACK_SECTION_COPY.travel,
}) {
  const [activeId, setActiveId] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  // Two independent layers. indexSlug names a multi-story location whose
  // StoryIndex should be visible. storySlug names the StoryView on top.
  // Either can be set alone; when both are set, the two modals stack.
  const [indexSlug, setIndexSlug] = useState(null);
  const [storySlug, setStorySlug] = useState(null);
  const [carouselIds, setCarouselIds] = useState(() =>
    sortFeatured(locations)
      .slice(0, CAROUSEL_SIZE)
      .map((l) => l.id)
  );
  const railRef = useRef(null);
  // Gates popstate sync — see Projects.jsx for explanation. Prevents an
  // initial-load popstate (Safari legacy / older Chrome) on a canonical
  // /personal/travel/<slug> route from mounting a SECOND StoryModal beside
  // SlugLandingChoreography's modal.
  const hasInteracted = useRef(false);
  // Slug of the open StoryView, kept in a ref so story_closed can name it
  // after storySlug clears.
  const openedStoryRef = useRef(null);
  useDwellDuration(!!storySlug, (d) => analytics.storyClosed(openedStoryRef.current, d));

  // ── derived state ───────────────────────────────────────────────
  const indexLocation = indexSlug
    ? locations.find((l) => l.id === indexSlug) ?? null
    : null;
  const indexStories = indexLocation
    ? (locationStories[indexLocation.id] ?? [])
        .map((s) => storiesBySlug[s])
        .filter(Boolean)
    : [];
  const indexOpen = indexLocation !== null && indexStories.length > 0;

  const story = storySlug ? storiesBySlug[storySlug] ?? null : null;
  const storyShown = story !== null;

  // Any modal open at all (used to gate AllStopsBook ESC handling).
  const storyOpen = indexOpen || storyShown;

  // ── openers ─────────────────────────────────────────────────────

  // Public opener used by Postcard (TravelMap rail, AllStopsBook). Decides
  // index vs story based on whether the slug is a multi-story location.
  // Single-story locs and bare story slugs both fall through to storyShown.
  function openStory(slug) {
    if (!slug) return;
    const loc = locations.find((l) => l.id === slug);
    const locStories = loc ? locationStories[loc.id] ?? [] : [];
    if (loc && locStories.length > 1) {
      // Multi-story location → open the index alone.
      setIndexSlug(slug);
      setStorySlug(null);
    } else {
      // Story slug (or single-story loc treated as direct story).
      openedStoryRef.current = slug;
      analytics.storyOpened(slug, loc?.city ?? slug);
      setStorySlug(slug);
      setIndexSlug(null);
    }
    window.history.pushState({}, "", `/personal/travel/${slug}`);
    hasInteracted.current = true;
  }

  // Called from StoryIndex when a card is clicked — opens the story
  // while keeping the index mounted underneath (nested URL).
  function selectFromIndex(slug) {
    if (!slug || !indexSlug) return;
    openedStoryRef.current = slug;
    analytics.storyOpened(slug, indexSlug);
    setStorySlug(slug);
    window.history.pushState({}, "", `/personal/travel/${indexSlug}/${slug}`);
    hasInteracted.current = true;
  }

  // ── closers ─────────────────────────────────────────────────────
  function closeStory() {
    setStorySlug(null);
    if (indexSlug) {
      // Drop one layer — back to the index URL.
      window.history.pushState({}, "", `/personal/travel/${indexSlug}`);
    } else {
      window.history.pushState({}, "", "/personal");
    }
  }
  function closeIndex() {
    setIndexSlug(null);
    setStorySlug(null);
    window.history.pushState({}, "", "/personal");
  }

  // Sync both slugs with URL on browser back/forward — gated on user
  // interaction so an initial-load popstate doesn't clash with
  // SlugLandingChoreography.
  useEffect(() => {
    function onPopState() {
      if (!hasInteracted.current) return;
      const pathname = window.location.pathname;
      const nested = pathname.match(SLUG_PATTERN_NESTED);
      if (nested) {
        setIndexSlug(nested[1]);
        setStorySlug(nested[2]);
        return;
      }
      const single = pathname.match(SLUG_PATTERN_SINGLE);
      if (single) {
        const slug = single[1];
        const loc = locations.find((l) => l.id === slug);
        const locStories = loc ? locationStories[loc.id] ?? [] : [];
        if (loc && locStories.length > 1) {
          setIndexSlug(slug);
          setStorySlug(null);
        } else {
          setStorySlug(slug);
          setIndexSlug(null);
        }
      } else {
        setIndexSlug(null);
        setStorySlug(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [locations, locationStories]);

  // carouselIds is the source of truth for order. activatePin always moves
  // the tapped id to position 0 in state, so the order persists after
  // deselect — no dynamic float on activeId needed here.
  const carouselLocations = carouselIds
    .map((id) => locations.find((l) => l.id === id))
    .filter(Boolean);

  function handlePinTap(id) {
    const rail = railRef.current;
    if (!id) {
      // Cards don't reorder on deselect (order is baked into carouselIds),
      // so no scroll-position pinning needed — just clear the active state.
      setActiveId(null);
      return;
    }

    // If the postcard rail isn't fully in view, glide the page down to
    // it first, then run the postcard animation once it lands — matching
    // the Screening Room ticket-select feel.
    const rect = rail?.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const railInView = rect && rect.top >= 0 && rect.bottom <= vh;

    if (!railInView && rail) {
      rail.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => activatePin(id), 420);
    } else {
      activatePin(id);
    }
  }

  function activatePin(id) {
    const rail = railRef.current;
    if (rail) {
      rail.style.scrollSnapType = "none";
      rail.scrollLeft = 0;
    }
    setActiveId(id);
    setCarouselIds((prev) => {
      // Always move the tapped id to position 0, whether it's new or existing.
      // This bakes the order into state so it survives deselect — previously
      // the order was computed dynamically from activeId, which meant clearing
      // activeId sent the card back to its old slot.
      const without = prev.filter((x) => x !== id);
      if (prev.includes(id)) return [id, ...without];
      return [id, ...without.slice(0, CAROUSEL_SIZE - 1)];
    });
    if (rail) {
      let frames = 0;
      const pin = () => {
        if (!rail.isConnected) return;
        rail.scrollLeft = 0;
        if (frames++ < 30) requestAnimationFrame(pin);
        else rail.style.scrollSnapType = "";
      };
      requestAnimationFrame(pin);
    }
  }

  return (
    <section id="travel" className={styles.section}>
      <div className="section-fade" aria-hidden="true" />
      <ScrollReveal className={styles.inner}>
        <SectionHeader
          label={copy.eyebrow}
          title={copy.title}
          subtitle={copy.intro}
          guide={
            <>
              {copy.instruction && <SectionGuide className="desktop-only">{copy.instruction}</SectionGuide>}
              {copy.instructionMobile && <SectionGuide className="mobile-only">{copy.instructionMobile}</SectionGuide>}
            </>
          }
        />

        <div className="desktop-only">
          <div className={styles.mapWrap}>
            <TravelMap
              locations={locations}
              locationStories={locationStories}
              onViewStory={openStory}
              forcePaused={storyOpen}
            />
            <p className={styles.subtle}>
              Hover to pause auto-cycle · Click a pin to lock its postcard · View Stories to open the story
            </p>
          </div>

          <div className={mapStyles.mobileRail}>
            {sortFeatured(locations)
              .slice(0, CAROUSEL_SIZE)
              .map((loc) => {
                const origIdx = locations.findIndex((l) => l.id === loc.id);
                return (
                  <div key={loc.id} className={mapStyles.mobileCardWrap}>
                    <Postcard
                      loc={loc}
                      storySlugs={locationStories[loc.id] ?? []}
                      rotation={ROTATIONS[origIdx % ROTATIONS.length]}
                      className={mapStyles.mobileCard}
                      onViewStory={openStory}
                    />
                  </div>
                );
              })}
          </div>

          <ViewMore onClick={() => setBookOpen(true)}>View All Stops →</ViewMore>
        </div>

        <div className="mobile-only">
          <MobileTravelMap
            locations={locations}
            activeId={activeId}
            onPinTap={handlePinTap}
          />
          <p className={`${styles.subtle} ${styles.mobileTip}`}>
            Tap a pin to lock its postcard · View Stories to open
          </p>
          <div className={mapStyles.mobileRail} ref={railRef} style={{ overflowAnchor: "none" }}>
            <AnimatePresence initial={false} mode="popLayout">
              {carouselLocations.map((loc) => {
                const origIdx = locations.findIndex((l) => l.id === loc.id);
                return (
                  <motion.div
                    key={loc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{
                      type: "spring", stiffness: 320, damping: 32,
                      // Layout animation must be overdamped (damping > 2√stiffness ≈ 35.8)
                      // so the card never overshoots its final position, which would appear
                      // as the visible leftward jerk reported on mobile.
                      layout: { type: "spring", stiffness: 260, damping: 38 },
                    }}
                    className={mapStyles.mobileCardWrap}
                  >
                    <Postcard
                      loc={loc}
                      storySlugs={locationStories[loc.id] ?? []}
                      rotation={ROTATIONS[origIdx % ROTATIONS.length]}
                      className={mapStyles.mobileCard}
                      onViewStory={openStory}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <ViewMore onClick={() => setBookOpen(true)}>View All Stops →</ViewMore>
        </div>
      </ScrollReveal>

      {/* Field Journal book — opens on "View All Stops". */}
      <AllStopsBook
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        locations={locations}
        locationStories={locationStories}
        onViewStory={openStory}
        ignoreEsc={storyOpen}
      />

      {/* Stacked story modals — index (bottom) and story (top). Either
          renders alone, or both stack when a nested URL is active. Both
          are mounted client-side so click → open is instant. */}
      <AnimatePresence>
        {indexOpen && (
          <StoryModal key="index" onClose={closeIndex}>
            <StoryIndex
              location={indexLocation}
              locationId={indexSlug}
              stories={indexStories}
              onSelect={selectFromIndex}
            />
          </StoryModal>
        )}
        {storyShown && (
          <StoryModal key="story" onClose={closeStory}>
            {/* Single story — no location prop so the StoryMedia header
                (region flag / city / slide counter) stays hidden, matching
                the old inline experience. The close button alone handles
                back-to-index drop; no separate back arrow needed. */}
            <StoryView story={story} />
          </StoryModal>
        )}
      </AnimatePresence>
    </section>
  );
}
