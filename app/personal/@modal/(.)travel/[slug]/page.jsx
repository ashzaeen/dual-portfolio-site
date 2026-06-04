import StoryModal from "@/components/personal/story/StoryModal";
import StoryView from "@/components/personal/story/StoryView";
import StackedJournal from "@/components/personal/story/StackedJournal";
import { fetchTravelData } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function InterceptedStoryPage({ params }) {
  const { slug } = params;
  const { locations, storiesBySlug, locationStories } = await fetchTravelData();

  const story = storiesBySlug[slug] ?? null;
  const location = locations.find((l) => l.id === slug) ?? null;
  const stories = (locationStories[slug] ?? [])
    .map((s) => storiesBySlug[s])
    .filter(Boolean);

  // Multi-story location wins over a coincidental story-slug match —
  // mirrors the canonical route + TravelSection resolver.
  const preferIndex = location && stories.length > 1;

  if (preferIndex || (location && stories.length > 0)) {
    return (
      <StackedJournal location={location} stories={stories} autoplay={false} />
    );
  }
  if (story) {
    return (
      <StoryModal>
        <StoryView story={story} autoplay={false} />
      </StoryModal>
    );
  }
  return null;
}
