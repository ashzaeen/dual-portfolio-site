import { notFound } from "next/navigation";
import PersonalLanding from "@/components/personal/PersonalLanding";
import GalleryReader from "@/components/personal/pinboard/GalleryReader";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchGalleryBySlug } from "@/lib/notion";
import { ITEMS as CURATED_ITEMS, gallerySlug } from "@/data/pinboard";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export async function generateMetadata({ params }) {
  const item = await fetchGalleryBySlug(params.slug);
  return { description: item?.story || undefined };
}

// Pre-render only the stable curated gallery items (hardcoded in data/pinboard.js).
// Notion-added dynamic photos are server-rendered on first visit instead.
// This avoids fetching all Notion pinboard photos + curated overrides at build
// time across 25+ workers — a race condition that caused intermittent build
// timeouts when Notion's API was slow.
export async function generateStaticParams() {
  return CURATED_ITEMS
    .filter((i) => i.type === "photo" || i.type === "poster")
    .map((i) => ({ slug: gallerySlug(i) }))
    .filter((i) => i.slug);
}

// Direct URL visits render the personal landing, then SlugLandingChoreography
// smooth-scrolls to #gallery and mounts the picture modal on top.
// fetchGalleryItems is React.cache-wrapped so the landing's own pinboard fetch
// and this lookup don't double-hit Notion per request.
export default async function GalleryPage({ params }) {
  const item = await fetchGalleryBySlug(params.slug);
  if (!item) notFound();

  return (
    <>
      <PersonalLanding />
      <SlugLandingChoreography sectionId="gallery">
        <GalleryReader item={item} />
      </SlugLandingChoreography>
    </>
  );
}
