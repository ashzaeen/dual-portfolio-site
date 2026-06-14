import { redirect } from "next/navigation";
import { fetchExperienceBySlug, fetchExperiences } from "@/lib/notion";

export async function generateMetadata({ params }) {
  const exp = await fetchExperienceBySlug(params.slug);
  return { title: exp?.role || undefined };
}

// Pre-render every known experience slug so the redirect lookup is cached.
export async function generateStaticParams() {
  const experiences = await fetchExperiences();
  return experiences.map((e) => ({ slug: e.slug }));
}

// The Experiences section is an inline accordion on the landing page that
// reads `?exp=<slug>` to auto-open. Direct visits to /experiences/<slug>
// redirect to the landing with that query so the recipient lands in the
// same scrolled+expanded state.
export default function ExperiencePage({ params }) {
  redirect(`/?exp=${encodeURIComponent(params.slug)}#experience`);
}
