"use client";

import { useRouter } from "next/navigation";
import Postcard from "../Postcard";
import styles from "./StoryIndex.module.css";

// Same decorative palette as AllStopsBook so a multi-story location feels
// like flipping the same field journal to a new chapter, just with story
// postcards instead of stop postcards.
const TAPE_COLORS = [
  "rgba(196,160,80,0.40)",
  "rgba(130,175,130,0.36)",
  "rgba(185,125,95,0.34)",
  "rgba(95,145,185,0.30)",
  "rgba(175,155,95,0.36)",
  "rgba(160,100,130,0.32)",
  "rgba(100,165,160,0.30)",
];
const TAPE_ANGLES = [-1.8, 1.3, -0.9, 2.0, -1.4, 0.7, -2.1, 1.6, -0.6, 1.9];
const ROTATIONS = [-2.6, 1.4, -1.1, 2.2, -0.8, 1.9, -2.2, 0.7, -1.5, 2.5];

// Map a Story into a fake-loc so Postcard renders the same visual
// recipe used in AllStopsBook. Photo + headline (city slot) + secondary
// line (country · year slot). Note stays empty — stories don't carry the
// editorial blurb a location entry does, and a blank note actually
// matches Postcard's natural spacing.
function storyToLoc(story, location) {
  return {
    id: story.id,
    city: story.title,
    country: location?.city ?? "",
    year: story.date ?? "",
    note: "",
    coords: location?.coords,
    region: location?.region,
    // Multi-story location index — story-specific photos are usually
    // phone-camera portrait crops; default to portrait so the tile shape
    // matches the source images rather than letterboxing them into a square.
    ratio: "portrait",
    photo: story.coverGradient || "linear-gradient(145deg, #c4a050, #7a5020)",
    photoUrl: story.photoUrl ?? null,
  };
}

export default function StoryIndex({ location, locationId, stories = [], onSelect }) {
  const router = useRouter();

  function handleViewStory(slug) {
    if (onSelect) {
      onSelect(slug);
    } else {
      router.push(`/personal/travel/${slug}`);
    }
  }

  const cityLabel = location?.city ?? locationId ?? "Stories";
  const country = location?.country ?? "Field Journal";
  const yearLabel = location?.year ?? "";

  return (
    <div className={styles.book}>
      {/* ── Leather spine ── */}
      <div className={styles.spine}>
        <div className={styles.spineOrn}>✦</div>
        <div className={styles.spineTitle}>{cityLabel}</div>
        <div className={styles.spineRule} />
        <div className={styles.spineYear}>{yearLabel || country}</div>
        <div className={styles.spineOrn}>✦</div>
      </div>

      {/* ── Parchment page ── */}
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLabel}>— From the Field —</div>
          <div className={styles.pageTitle}>{cityLabel}</div>
          <div className={styles.pageRule} />
          <div className={styles.pageSubtitle}>
            {stories.length}{" "}
            {stories.length === 1 ? "story" : "stories"} from {country}
          </div>
        </div>

        <div className={styles.cardGrid}>
          {stories.map((s, i) => {
            const tapeColor = TAPE_COLORS[i % TAPE_COLORS.length];
            const tapeAngle = TAPE_ANGLES[i % TAPE_ANGLES.length];
            const rotation = ROTATIONS[i % ROTATIONS.length];
            const fakeLoc = storyToLoc(s, location);

            return (
              <div
                key={s.id}
                className={styles.cardWrap}
                onClick={() => handleViewStory(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleViewStory(s.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open story: ${s.title}`}
              >
                <div
                  className={styles.tape}
                  style={{
                    background: tapeColor,
                    transform: `translateX(-50%) rotate(${tapeAngle}deg)`,
                  }}
                  aria-hidden="true"
                />
                <Postcard
                  loc={fakeLoc}
                  storySlugs={[s.id]}
                  rotation={rotation}
                  onViewStory={handleViewStory}
                  buttonLabel="View Stories"
                  style={{ width: "100%" }}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.pageFooter}>
          <div className={styles.pageFooterRule} />
          <span className={styles.pageFooterText}>
            Field Journal · {country}
          </span>
        </div>
      </div>
    </div>
  );
}
