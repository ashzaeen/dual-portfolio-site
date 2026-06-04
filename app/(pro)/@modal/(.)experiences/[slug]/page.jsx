import CaseStudyModal from "@/components/professional/CaseStudyModal";
import ExperienceDetail from "@/components/professional/experiences/ExperienceDetail";
import { fetchExperienceBySlug } from "@/lib/notion";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function InterceptedExperiencePage({ params }) {
  const experience = await fetchExperienceBySlug(params.slug);
  if (!experience) return null;

  return (
    <CaseStudyModal>
      <ExperienceDetail experience={experience} />
    </CaseStudyModal>
  );
}
