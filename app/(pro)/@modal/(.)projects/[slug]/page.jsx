import EditorialModal from "@/components/professional/projects/EditorialModal";
import { fetchProjectBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function InterceptedProjectPage({ params }) {
  const project = await fetchProjectBySlug(params.slug);
  if (!project) return null;
  return <EditorialModal project={project} />;
}
