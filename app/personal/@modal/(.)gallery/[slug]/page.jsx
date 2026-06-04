import GalleryReader from "@/components/personal/pinboard/GalleryReader";
import { fetchGalleryBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function InterceptedGalleryPage({ params }) {
  const item = await fetchGalleryBySlug(params.slug);
  if (!item) return null;
  return <GalleryReader item={item} />;
}
