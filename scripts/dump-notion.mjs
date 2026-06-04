// READ-ONLY: pulls every Notion-backed dataset via the app's real fetchers and
// writes one JSON snapshot to scripts/_notion-dump.json. No Notion writes, no
// app-file changes. Used to verify connectivity and inspect live content before
// regenerating fallbacks.
import { writeFileSync } from "node:fs";
import * as N from "@/lib/notion";

const out = {};
const errors = {};

async function grab(name, fn) {
  try {
    out[name] = await fn();
    const v = out[name];
    const n = Array.isArray(v) ? v.length : (v && typeof v === "object" ? Object.keys(v).length : 1);
    console.log(`✓ ${name} (${n})`);
  } catch (err) {
    errors[name] = err.message;
    console.log(`✗ ${name}: ${err.message}`);
  }
}

await grab("roles", N.fetchRoles);
await grab("sectionCopy", N.fetchSectionCopy);
await grab("proSectionCopy", N.fetchProSectionCopy);
await grab("personalHero", N.fetchPersonalHero);
await grab("heroConfig", N.fetchHeroConfig);
await grab("heroChips", N.fetchHeroChips);
await grab("heroStats", N.fetchHeroStats);
await grab("heroTicker", N.fetchHeroTicker);
await grab("heroStatus", N.fetchHeroStatus);
await grab("travel", N.fetchTravelData);
await grab("projects", N.fetchProjects);
await grab("experiences", N.fetchExperiences);
await grab("credentials", N.fetchCredentials);
await grab("techstack", N.fetchTechStack);
await grab("proFooter", N.fetchProFooter);
await grab("personalFooter", N.fetchPersonalFooter);
await grab("songs", N.fetchSongs);
await grab("shows", N.fetchShows);
await grab("desk", N.fetchDesk);
await grab("writing", N.fetchWriting);
await grab("pinboardPhotos", N.fetchPinboardPhotos);
await grab("curatedOverrides", N.fetchCuratedOverrides);

writeFileSync("scripts/_notion-dump.json", JSON.stringify({ out, errors }, null, 2));
console.log(`\nWrote scripts/_notion-dump.json — ${Object.keys(out).length} ok, ${Object.keys(errors).length} errors`);
