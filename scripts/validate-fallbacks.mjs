// Imports every regenerated fallback module and cross-checks counts/values
// against the live dump, asserting the helper-built blocks parse and render
// the same shapes the renderers expect.
import { readFileSync } from "node:fs";
const D = JSON.parse(readFileSync("scripts/_notion-dump.json", "utf8")).out;

const R = await import("@/data/roles");
const ST = await import("@/data/status");
const H = await import("@/data/hero");
const SE = await import("@/data/sections");
const F = await import("@/data/footer");
const C = await import("@/data/credentials");
const TS = await import("@/data/techstack");
const SO = await import("@/data/songs");
const SH = await import("@/data/shows");
const DK = await import("@/data/desk");
const L = await import("@/data/locations");
const STO = await import("@/data/stories");
const P = await import("@/data/projects");
const E = await import("@/data/experiences");
const PI = await import("@/data/pieces");

let fail = 0;
const ok = (cond, msg) => { if (!cond) { console.log("✗ " + msg); fail++; } else console.log("✓ " + msg); };

ok(R.FALLBACK_ROLES.length === D.roles.length, `roles ${R.FALLBACK_ROLES.length}`);
ok(R.FALLBACK_ROLES[0] === D.roles[0], `roles[0] = ${R.FALLBACK_ROLES[0]}`);
ok(ST.FALLBACK_HERO_STATUS.text === D.heroStatus.text, "status text");
ok(H.FALLBACK_HERO_CONFIG.email === D.heroConfig.email, "hero email");
ok(H.FALLBACK_HERO_CHIPS.length === D.heroChips.length, "chips");
ok(H.FALLBACK_HERO_STATS[1].line1 === D.heroStats[1].line1, "stats");
ok(H.FALLBACK_HERO_TICKER.length === D.heroTicker.length, "ticker");
ok(SE.FALLBACK_SECTION_COPY.travel.title === D.sectionCopy.travel.title, "section travel");
ok(SE.FALLBACK_SECTION_COPY.projects.eyebrow === D.proSectionCopy.projects.eyebrow, "section pro projects");
ok(SE.FALLBACK_SECTION_COPY["personal-hero"].intro === D.personalHero.intro, "personal-hero");
ok(F.FALLBACK_FOOTER_PRO.footerName === D.proFooter.config.footerName, "footer pro");
ok(F.FALLBACK_FOOTER_SOCIALS.length === D.proFooter.socials.length, "socials");
ok(C.FALLBACK_EDUCATION.length === D.credentials.education.length, "education");
ok(C.FALLBACK_CERTIFICATIONS.length === D.credentials.certifications.length, "certs");
ok(C.FALLBACK_COURSEWORK.length === D.credentials.coursework.length, "coursework");
ok(C.FALLBACK_CURIOSITY.length === D.credentials.curiosity.length, "curiosity");
ok(TS.FALLBACK_TECHSTACK.length === D.techstack.length, "techstack");
ok(SO.FALLBACK_SONGS.length === D.songs.length, "songs");
ok(SO.FALLBACK_SONGS.every((s) => !String(s.cover ?? "").includes("/api/")), "song covers have no proxy URLs");
ok(SH.FALLBACK_SHOWS.length === D.shows.length, "shows");
ok(SH.FALLBACK_SHOWS.every((s) => s.poster === null), "show posters nulled");
ok(DK.FALLBACK_DESK.polaroids.length === D.desk.polaroids.length, "desk polaroids");
ok(L.LOCATIONS.length === D.travel.locations.length, "locations");
ok(Object.keys(STO.STORIES).length === Object.keys(D.travel.storiesBySlug).length, "stories");
ok(Object.keys(STO.LOCATION_STORIES).length === Object.keys(D.travel.locationStories).length, "locationStories");
ok(P.FALLBACK_PROJECTS.length === D.projects.length, "projects");
ok(!!P.PROJECTS_BY_SLUG[D.projects[0].slug], "PROJECTS_BY_SLUG derived");
ok(E.FALLBACK_EXPERIENCES.length === D.experiences.length, "experiences");
ok(!!E.EXPERIENCES_BY_SLUG[D.experiences[0].slug], "EXPERIENCES_BY_SLUG derived");
ok(E.WORK_EXPERIENCES.length + E.EXTRACURRICULARS.length === D.experiences.length, "exp split");

// Block fidelity: total block count preserved (minus unsupported/url-less files).
const liveBlocks = (bs) => (bs || []).filter((b) => b.type !== "unsupported" &&
  !((b.type === "file" || b.type === "pdf") && !(b[b.type].external?.url || (b[b.type].file?.url && !b[b.type].file.url.startsWith("/api/"))))).length;
const proj0 = P.FALLBACK_PROJECTS.find((p) => p.slug === D.projects[0].slug);
ok(proj0.body.length === liveBlocks(D.projects[0].body), `proj0 body ${proj0.body.length} vs ${liveBlocks(D.projects[0].body)}`);
const mm = PI.FALLBACK_PIECES.find((p) => p.id === "introduction-to-mmwave-sensing");
const mmLive = D.writing.find((w) => w.id === "introduction-to-mmwave-sensing");
ok(!!mm, "mmwave piece present");
ok(mm && mm.blocks.length === liveBlocks(mmLive.blocks), `mmwave blocks ${mm && mm.blocks.length} vs ${liveBlocks(mmLive.blocks)}`);

// withPdfArticles still attaches the PDF to Night Changes.
const withPdf = PI.withPdfArticles(PI.FALLBACK_PIECES);
ok(withPdf.some((p) => p.pdf), "withPdfArticles attaches pdf");

// A paragraph with an inline link round-trips to a real link object.
let linkFound = false;
for (const w of PI.FALLBACK_PIECES)
  for (const b of w.blocks)
    if (b.type === "paragraph") for (const rt of b.paragraph.rich_text) if (rt.text?.link?.url) linkFound = true;
ok(linkFound, "inline link preserved in a writing paragraph");

console.log(fail ? `\n${fail} FAILURES` : "\nAll checks passed.");
process.exit(fail ? 1 : 0);
