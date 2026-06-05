import Navbar from "@/components/shared/Navbar";
import Hero from "@/components/personal/Hero";
import TravelSection from "@/components/personal/TravelSection";
import MusicSection from "@/components/personal/MusicSection";
import SeriesSection from "@/components/personal/SeriesSection";
import WritingSection from "@/components/personal/WritingSection";
import PinboardSection from "@/components/personal/pinboard/PinboardSection";
import PersonalFooter from "@/components/personal/PersonalFooter";
import TrackSide from "@/components/shared/TrackSide";
import EngagementTracker from "@/components/shared/EngagementTracker";
import { unstable_cache } from "next/cache";
import {
  fetchRoles,
  fetchTravelData,
  fetchSongs,
  fetchShows,
  fetchWriting,
  fetchDesk,
  fetchPinboardPhotos,
  fetchCuratedOverrides,
  fetchPersonalFooter,
  fetchHeroStatus,
  fetchSectionCopy,
  fetchPersonalHero,
} from "@/lib/notion";

// fetchTravelData and fetchWriting are the two heavy fetchers — they
// recursively pull Notion page-body blocks for every story (~29) and writing
// piece (~6), each requiring 35+ sequential API calls. React.cache dedupes
// within one render, but Next.js builds with multiple workers: each worker
// independently pays the full cost and easily hits the 120s timeout across
// the 60+ slug pages (gallery/travel/writing) that all render PersonalLanding.
// unstable_cache writes the result to disk after the FIRST worker computes it;
// every other worker hits the cache instantly (revalidate matches ISR: 3600s).
const getTravelData = unstable_cache(
  () => fetchTravelData(),
  ["personal-landing-travel"],
  { revalidate: 3600 }
);
const getWriting = unstable_cache(
  () => fetchWriting(),
  ["personal-landing-writing"],
  { revalidate: 3600 }
);

// Shared personal landing — rendered by `app/personal/page.jsx` and by each
// canonical slug route under personal/.../[slug]/page.jsx so direct URL
// visits show the landing underneath the modal.
export default async function PersonalLanding() {
  const [roles, travel, songs, shows, writing, desk, pinboardPhotos, curatedOverrides, footer, heroStatus, sections, heroCopy] =
    await Promise.all([
      fetchRoles(),
      getTravelData(),
      fetchSongs(),
      fetchShows(),
      getWriting(),
      fetchDesk(),
      fetchPinboardPhotos(),
      fetchCuratedOverrides(),
      fetchPersonalFooter(),
      fetchHeroStatus(),
      fetchSectionCopy(),
      fetchPersonalHero(),
    ]);

  return (
    <div className="theme-root" data-theme="personal">
      <TrackSide side="personal" />
      <EngagementTracker side="personal" />
      <Navbar />
      <main>
        <Hero roles={roles} status={heroStatus} copy={heroCopy} />
        <TravelSection
          locations={travel.locations}
          storiesBySlug={travel.storiesBySlug}
          locationStories={travel.locationStories}
          copy={sections.travel}
        />
        <WritingSection pieces={writing} desk={desk} copy={sections.writing} />
        <MusicSection songs={songs} copy={sections.music} />
        <SeriesSection shows={shows} copy={sections.series} />
        <PinboardSection dynamicPhotos={pinboardPhotos} curatedOverrides={curatedOverrides} copy={sections.gallery} />
      </main>
      <PersonalFooter config={footer.config} socials={footer.socials} />
    </div>
  );
}
