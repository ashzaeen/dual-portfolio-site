import WritingReader from "@/components/personal/writing/WritingReader";
import { fetchWritingBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function InterceptedWritingPage({ params }) {
  const piece = await fetchWritingBySlug(params.slug);
  if (!piece) return null;
  return <WritingReader piece={piece} />;
}
