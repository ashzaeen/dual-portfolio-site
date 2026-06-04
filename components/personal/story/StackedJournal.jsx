"use client";

import { useState } from "react";
import StoryModal from "./StoryModal";
import StoryView from "./StoryView";
import StoryIndex from "./StoryIndex";

// Two-layer modal owner used by the canonical + intercepting routes for
// nested travel URLs (/personal/travel/<locSlug>/<storySlug>) and by direct
// deep-links that need both layers mounted at once.
//
// Layers (bottom → top):
//   1. StoryModal containing StoryIndex (the "field journal" page of stories
//      for one location). Closing this drops to the landing page —
//      SlugLandingChoreography injects `onClose` and we forward it here.
//   2. (optional) StoryModal containing StoryView for whichever story is
//      currently open. Closing this drops back to the index URL via
//      replaceState, no router round-trip.
//
// In-app clicks on a story card use `onSelect`, which updates local state
// + replaceState — the underlying TravelSection state machine is not
// involved during a stacked landing (the choreography mounts this child
// directly, so the section state never enters the loop).
export default function StackedJournal({
  location,
  stories = [],
  initialStory = null,
  onClose,
  // `false` → first-mounted story shows the play-gesture overlay before
  // playback begins. After the user taps it once, the StoryMedia module
  // flag flips and every subsequent story this session auto-plays.
  autoplay = true,
}) {
  const [openStory, setOpenStory] = useState(initialStory);
  // Only the INITIAL story (the one the user deep-linked to) needs the
  // play gesture. Stories selected by clicking cards in the index are
  // explicit user gestures and should auto-play immediately.
  const [storyAutoplay, setStoryAutoplay] = useState(autoplay);

  function selectStory(slug) {
    const s = stories.find((x) => x.id === slug);
    if (!s) return;
    setOpenStory(s);
    // Card click is an in-app user gesture — let the next story autoplay.
    setStoryAutoplay(true);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        {},
        "",
        `/personal/travel/${location.id}/${slug}`
      );
    }
  }

  function closeStory() {
    setOpenStory(null);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", `/personal/travel/${location.id}`);
    }
  }

  return (
    <>
      <StoryModal onClose={onClose}>
        <StoryIndex
          location={location}
          locationId={location.id}
          stories={stories}
          onSelect={selectStory}
        />
      </StoryModal>
      {openStory && (
        <StoryModal onClose={closeStory}>
          <StoryView story={openStory} autoplay={storyAutoplay} />
        </StoryModal>
      )}
    </>
  );
}
