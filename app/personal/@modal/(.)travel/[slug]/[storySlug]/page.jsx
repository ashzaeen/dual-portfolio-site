import StackedJournal from "@/components/personal/story/StackedJournal";
import { fetchTravelData } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

// Intercepting equivalent of the nested canonical route. In-app flows use
// pushState (no router navigation), so this mainly exists for parity with
// the single-segment intercept and for any future <Link> use. First
// segment param is `slug` to match the sibling [slug]/page.jsx.
export default async function InterceptedNestedStoryPage({ params }) {
  const { slug: locSlug, storySlug } = params;
  const { locations, storiesBySlug, locationStories } = await fetchTravelData();

  const location = locations.find((l) => l.id === locSlug) ?? null;
  const story = storiesBySlug[storySlug] ?? null;
  const stories = (locationStories[locSlug] ?? [])
    .map((s) => storiesBySlug[s])
    .filter(Boolean);

  if (!location || !story || stories.length === 0) return null;

  return (
    <StackedJournal
      location={location}
      stories={stories}
      initialStory={story}
      autoplay={false}
    />
  );
}
