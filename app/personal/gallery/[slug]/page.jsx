import { notFound } from "next/navigation";
import PersonalLanding from "@/components/personal/PersonalLanding";
import GalleryReader from "@/components/personal/pinboard/GalleryReader";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchGalleryItems, fetchGalleryBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

// Pre-render every shareable gallery picture (slug derived from filename).
export async function generateStaticParams() {
  const items = await fetchGalleryItems();
  return items.filter((i) => i.slug).map((i) => ({ slug: i.slug }));
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
