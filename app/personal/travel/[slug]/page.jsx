import { notFound } from "next/navigation";
import PersonalLanding from "@/components/personal/PersonalLanding";
import StoryModal from "@/components/personal/story/StoryModal";
import StoryView from "@/components/personal/story/StoryView";
import StackedJournal from "@/components/personal/story/StackedJournal";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchTravelData } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

// Pre-render every location AND every story slug — both are valid entry
// points (the route renders StoryIndex for a location id, StoryView for a
// story slug). Dedupe in case any names collide.
export async function generateStaticParams() {
  const { locations, storiesBySlug } = await fetchTravelData();
  const slugs = new Set([
    ...locations.map((l) => l.id),
    ...Object.keys(storiesBySlug),
  ]);
  return [...slugs].map((slug) => ({ slug }));
}

// Direct URL visits render the personal landing underneath with the story
// modal on top — visually identical to clicking a postcard in-app.
// fetchTravelData is React.cache-wrapped so this and PersonalLanding share
// one Notion roundtrip per request.
export default async function TravelStoryPage({ params }) {
  const { slug } = params;
  const { locations, storiesBySlug, locationStories } = await fetchTravelData();

  const story = storiesBySlug[slug] ?? null;
  const stories = (locationStories[slug] ?? [])
    .map((s) => storiesBySlug[s])
    .filter(Boolean);
  const location = locations.find((l) => l.id === slug) ?? null;

  // Mirror TravelSection's resolver: if the slug names a multi-story
  // location, the index wins over any story whose slug happens to match
  // the same string. Single-story locations + bare story slugs fall
  // through to the single-story view as before.
  const preferIndex = location && stories.length > 1;

  if (!story && stories.length === 0 && !preferIndex) notFound();

  return (
    <>
      <PersonalLanding />
      <SlugLandingChoreography sectionId="travel">
        {preferIndex ? (
          // Multi-story location landing — index modal mounted, cards
          // clickable to stack the story on top. autoplay={false} is for
          // the initial story IF one was already mounted (only happens
          // on the nested route, but harmless here since no initialStory).
          <StackedJournal
            location={location}
            stories={stories}
            autoplay={false}
          />
        ) : story ? (
          // Single-story landing — render the story modal alone, matching
          // the click-to-open behaviour. autoplay={false} forces the
          // play-gesture overlay since there was no user click to open.
          <StoryModal>
            <StoryView story={story} autoplay={false} />
          </StoryModal>
        ) : (
          // Location with exactly one published story but no matching
          // story slug — still surface the (one-card) index.
          <StackedJournal
            location={location}
            stories={stories}
            autoplay={false}
          />
        )}
      </SlugLandingChoreography>
    </>
  );
}
