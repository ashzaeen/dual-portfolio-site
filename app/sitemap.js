import {
  fetchProjects,
  fetchExperiences,
  fetchWriting,
  fetchGalleryItems,
  fetchTravelData,
} from "@/lib/notion";

// Stories are noindex — excluded from sitemap intentionally.

const BASE = "https://www.ashzaeen.com";

export default async function sitemap() {
  const static_routes = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/personal`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/copyright`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [projects, experiences, writing, gallery, travelData] =
    await Promise.allSettled([
      fetchProjects(),
      fetchExperiences(),
      fetchWriting(),
      fetchGalleryItems(),
      fetchTravelData(),
    ]).then((results) =>
      results.map((r) => (r.status === "fulfilled" ? r.value : null))
    );

  const projectRoutes = (projects ?? [])
    .filter((p) => p.slug)
    .map((p) => ({ url: `${BASE}/projects/${p.slug}`, changeFrequency: "monthly", priority: 0.8 }));

  const experienceRoutes = (experiences ?? [])
    .filter((e) => e.slug)
    .map((e) => ({ url: `${BASE}/experiences/${e.slug}`, changeFrequency: "monthly", priority: 0.8 }));

  const writingRoutes = (writing ?? [])
    .filter((w) => w.id && !w.externalUrl)
    .map((w) => ({ url: `${BASE}/personal/writing/${w.id}`, changeFrequency: "monthly", priority: 0.7 }));

  const galleryRoutes = (gallery ?? [])
    .filter((g) => g.slug)
    .map((g) => ({ url: `${BASE}/personal/gallery/${g.slug}`, changeFrequency: "yearly", priority: 0.5 }));

  const { locations = [] } = travelData ?? {};

  const travelRoutes = locations
    .filter((l) => l.id)
    .map((l) => ({ url: `${BASE}/personal/travel/${l.id}`, changeFrequency: "monthly", priority: 0.7 }));

  return [
    ...static_routes,
    ...projectRoutes,
    ...experienceRoutes,
    ...writingRoutes,
    ...galleryRoutes,
    ...travelRoutes,
  ];
}
