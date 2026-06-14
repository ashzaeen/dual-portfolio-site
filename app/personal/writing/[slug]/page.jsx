import { notFound } from "next/navigation";
import PersonalLanding from "@/components/personal/PersonalLanding";
import WritingReader from "@/components/personal/writing/WritingReader";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchWriting, fetchWritingBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export const metadata = { robots: { index: true, follow: true, noimageindex: true } };

// Pre-render every published writing piece. `piece.id` is the slug
// (mapWritingRow stores readText(props.Slug) under id, not slug).
export async function generateStaticParams() {
  const pieces = await fetchWriting();
  return pieces.filter((p) => p.id).map((p) => ({ slug: p.id }));
}

// Direct URL visits render the personal landing + the reader on top.
// fetchWriting (used internally by fetchWritingBySlug) is React.cache-
// wrapped so PersonalLanding's fetchWriting and this slug fetch share one
// Notion roundtrip per request.
export default async function WritingPage({ params }) {
  const piece = await fetchWritingBySlug(params.slug);
  if (!piece) notFound();

  return (
    <>
      <PersonalLanding />
      <SlugLandingChoreography sectionId="writing">
        <WritingReader piece={piece} />
      </SlugLandingChoreography>
    </>
  );
}
