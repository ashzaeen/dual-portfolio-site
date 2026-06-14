import { notFound } from "next/navigation";
import ProLanding from "@/components/professional/ProLanding";
import EditorialModal from "@/components/professional/projects/EditorialModal";
import SlugLandingChoreography from "@/components/shared/SlugLandingChoreography";
import { fetchProjectBySlug, fetchProjects } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export async function generateMetadata({ params }) {
  const project = await fetchProjectBySlug(params.slug);
  return { description: project?.summary || undefined };
}

// Pre-render every known project slug at build time so first-visit-ever is
// already cached. Slugs added in Notion after a build render on-demand
// (dynamicParams defaults to true) and cache on first hit.
export async function generateStaticParams() {
  const projects = await fetchProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

// Direct URL visits render the pro landing + EditorialModal on top so
// shared links land in the same visual state as an in-app card click.
export default async function ProjectPage({ params }) {
  const project = await fetchProjectBySlug(params.slug);
  if (!project) notFound();

  return (
    <>
      <ProLanding />
      <SlugLandingChoreography sectionId="projects">
        <EditorialModal project={project} />
      </SlugLandingChoreography>
    </>
  );
}
