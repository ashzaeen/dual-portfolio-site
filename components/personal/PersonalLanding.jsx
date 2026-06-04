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

// Shared personal landing — rendered by `app/personal/page.jsx` and by each
// canonical slug route under personal/.../[slug]/page.jsx so direct URL
// visits show the landing underneath the modal. fetchTravelData and
// fetchWriting are React.cache-wrapped so slug routes don't double-fetch.
export default async function PersonalLanding() {
  const [roles, travel, songs, shows, writing, desk, pinboardPhotos, curatedOverrides, footer, heroStatus, sections, heroCopy] =
    await Promise.all([
      fetchRoles(),
      fetchTravelData(),
      fetchSongs(),
      fetchShows(),
      fetchWriting(),
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
