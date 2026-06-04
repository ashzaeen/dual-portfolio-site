import { notFound } from "next/navigation";
import PersonalLanding from "@/components/personal/PersonalLanding";
import StackedJournal from "@/components/personal/story/StackedJournal";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchTravelData } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

// Only multi-story locations (≥2 stories) get nested URLs; single-story
// locations continue to use the flat /personal/travel/<storySlug> pattern.
// First segment param is named `slug` to stay consistent with the sibling
// `[slug]/page.jsx` (Next.js requires matching names at the same depth).
export async function generateStaticParams() {
  const { locations, locationStories } = await fetchTravelData();
  const params = [];
  for (const loc of locations) {
    const slugs = locationStories[loc.id] ?? [];
    if (slugs.length > 1) {
      for (const storySlug of slugs) {
        params.push({ slug: loc.id, storySlug });
      }
    }
  }
  return params;
}

// Direct URL visits to a nested story render the landing underneath with
// both modal layers stacked: StoryIndex (bottom) + StoryView (top), so
// closing the story exposes the index just like the in-app flow.
export default async function NestedTravelStoryPage({ params }) {
  const { slug: locSlug, storySlug } = params;
  const { locations, storiesBySlug, locationStories } = await fetchTravelData();

  const location = locations.find((l) => l.id === locSlug) ?? null;
  const story = storiesBySlug[storySlug] ?? null;
  const stories = (locationStories[locSlug] ?? [])
    .map((s) => storiesBySlug[s])
    .filter(Boolean);

  if (!location || !story || stories.length === 0) notFound();

  return (
    <>
      <PersonalLanding />
      <SlugLandingChoreography sectionId="travel">
        <StackedJournal
          location={location}
          stories={stories}
          initialStory={story}
          autoplay={false}
        />
      </SlugLandingChoreography>
    </>
  );
}
