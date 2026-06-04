import Navbar from "@/components/shared/Navbar";
import Hero from "@/components/professional/Hero";
import TechStack from "@/components/professional/TechStack";
import Projects from "@/components/professional/Projects";
import Experiences from "@/components/professional/Experiences";
import Credentials from "@/components/professional/Credentials";
import Footer from "@/components/professional/Footer";
import TrackSide from "@/components/shared/TrackSide";
import EngagementTracker from "@/components/shared/EngagementTracker";
import {
  fetchHeroConfig,
  fetchHeroChips,
  fetchHeroStats,
  fetchHeroTicker,
  fetchHeroStatus,
  fetchProjects,
  fetchExperiences,
  fetchCredentials,
  fetchTechStack,
  fetchProFooter,
  fetchProSectionCopy,
} from "@/lib/notion";

// Shared pro landing — rendered by `app/(pro)/page.jsx` and by each
// canonical slug route under (pro)/.../[slug]/page.jsx so direct URL
// visits show the landing underneath the modal. Notion fetchers used here
// are React.cache-wrapped so the slug route doesn't double-hit Notion.
export default async function ProLanding() {
  const [heroConfig, heroChips, heroStats, heroTicker, heroStatus, projects, experiences, credentials, techStack, footer, sections] =
    await Promise.all([
      fetchHeroConfig(),
      fetchHeroChips(),
      fetchHeroStats(),
      fetchHeroTicker(),
      fetchHeroStatus(),
      fetchProjects(),
      fetchExperiences(),
      fetchCredentials(),
      fetchTechStack(),
      fetchProFooter(),
      fetchProSectionCopy(),
    ]);

  return (
    <div className="theme-root" data-theme="pro">
      <TrackSide side="professional" />
      <EngagementTracker side="professional" />
      <Navbar />
      <main>
        <Hero
          config={heroConfig}
          chips={heroChips}
          stats={heroStats}
          tickerLogs={heroTicker}
          status={heroStatus}
        />
        <TechStack techStack={techStack} copy={sections.techstack} />
        <Projects projects={projects} copy={sections.projects} />
        <Experiences experiences={experiences} copy={sections.experiences} extraCopy={sections["experiences-extra"]} />
        <Credentials credentials={credentials} copy={sections.credentials} />
      </main>
      <Footer config={footer.config} socials={footer.socials} />
    </div>
  );
}
