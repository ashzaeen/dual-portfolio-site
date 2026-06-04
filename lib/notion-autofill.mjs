// Background watcher for Locations + Stories DBs.
// Polls Notion for rows with "Needs Auto-fill" = true.
//
// Locations: geocodes Name (Nominatim), GPT-derives Country/Slug/Region.
// Stories: deterministically derives Slug from Title, sets defaults.
// In both: writes back to Notion and unchecks the box.
//
// Run: npm run watch:notion   (or directly: node --env-file=.env.local scripts/watch-notion.mjs)
// Stop: Ctrl+C

import { Client } from "@notionhq/client";
import OpenAI from "openai";
import { imageSize } from "image-size";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const LOC_DB = process.env.NOTION_LOCATIONS_DB_ID;
const STORY_DB = process.env.NOTION_STORIES_DB_ID;
const REG_DB = process.env.NOTION_REGIONS_DB_ID;
const MUSIC_DB = process.env.NOTION_MUSIC_DB_ID; // optional
const SERIES_DB = process.env.NOTION_SERIES_DB_ID; // optional
const WRITING_DB = process.env.NOTION_WRITING_DB_ID; // optional
const PINBOARD_DB = process.env.NOTION_PINBOARD_DB_ID; // optional
const HERO_CHIPS_DB = process.env.NOTION_HERO_CHIPS_DB_ID;   // optional
const HERO_STATS_DB = process.env.NOTION_HERO_STATS_DB_ID;   // optional
const HERO_TICKER_DB = process.env.NOTION_HERO_TICKER_DB_ID; // optional
const PROJECTS_DB = process.env.NOTION_PROJECTS_DB_ID;             // optional
const PROJECT_MEDIA_DB = process.env.NOTION_PROJECT_MEDIA_DB_ID;   // optional
const EXPERIENCES_DB = process.env.NOTION_EXPERIENCES_DB_ID;       // optional
const EDUCATION_DB = process.env.NOTION_EDUCATION_DB_ID;           // optional
const CERTIFICATIONS_DB = process.env.NOTION_CERTIFICATIONS_DB_ID; // optional
const COURSEWORK_DB = process.env.NOTION_COURSEWORK_DB_ID;         // optional
const CURIOSITY_DB = process.env.NOTION_CURIOSITY_DB_ID;           // optional
const TECHSTACK_CATS_DB = process.env.NOTION_TECHSTACK_CATEGORIES_DB_ID; // optional
const TECHSTACK_SKILLS_DB = process.env.NOTION_TECHSTACK_SKILLS_DB_ID;   // optional
const FOOTER_SOCIALS_DB = process.env.NOTION_FOOTER_SOCIALS_DB_ID;       // optional
const LIVE_STATUS_CONFIG_DB = process.env.NOTION_LIVE_STATUS_CONFIG_DB_ID; // optional
const LIVE_STATUS_REGEN_URL = process.env.LIVE_STATUS_REGEN_URL || "http://localhost:3000/api/cron/regenerate-status";
const YT_API_KEY = process.env.YOUTUBE_API_KEY;   // optional — enables YouTube ID auto-fill
const OMDB_API_KEY = process.env.OMDB_API_KEY;    // optional — enables series auto-fill

export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);
const NOMINATIM_UA = "ashzaeen-personal-site/1.0 (auto-fill watcher)";

// Lazily constructed so merely importing this module (e.g. inside the Vercel
// route, or during `next build`) never throws when a key is absent. runAutofill()
// builds them on first use and returns an error summary if required env is gone.
let notion = null;
let openai = null;
function ensureClients() {
  if (!notion) notion = new Client({ auth: NOTION_TOKEN });
  if (!openai && OPENAI_KEY) openai = new OpenAI({ apiKey: OPENAI_KEY });
}

// Informational "X not set → feature disabled" notices. Printed by the local
// watcher loop only; the serverless route stays quiet.
export function logConfig() {
  if (!MUSIC_DB) console.log("ℹ NOTION_MUSIC_DB_ID not set — music auto-fill disabled");
  if (MUSIC_DB && !YT_API_KEY) console.log("ℹ YOUTUBE_API_KEY not set — YouTube ID auto-fill disabled (fill manually in Notion)");
  if (!SERIES_DB) console.log("ℹ NOTION_SERIES_DB_ID not set — series auto-fill disabled");
  if (SERIES_DB && !OMDB_API_KEY) console.log("ℹ OMDB_API_KEY not set — series will only get slug derivation (fill meta manually in Notion)");
  if (!WRITING_DB) console.log("ℹ NOTION_WRITING_DB_ID not set — writing auto-fill disabled");
  if (!PINBOARD_DB) console.log("ℹ NOTION_PINBOARD_DB_ID not set — pinboard auto-fill disabled");
  if (!HERO_CHIPS_DB) console.log("ℹ NOTION_HERO_CHIPS_DB_ID not set — hero chips auto-fill disabled");
  if (!HERO_STATS_DB) console.log("ℹ NOTION_HERO_STATS_DB_ID not set — hero stats auto-fill disabled");
  if (!HERO_TICKER_DB) console.log("ℹ NOTION_HERO_TICKER_DB_ID not set — hero ticker auto-fill disabled");
  if (!PROJECTS_DB) console.log("ℹ NOTION_PROJECTS_DB_ID not set — projects auto-fill disabled");
  if (!PROJECT_MEDIA_DB) console.log("ℹ NOTION_PROJECT_MEDIA_DB_ID not set — project media auto-fill disabled");
  if (!EXPERIENCES_DB) console.log("ℹ NOTION_EXPERIENCES_DB_ID not set — experiences auto-fill disabled");
  if (!EDUCATION_DB) console.log("ℹ NOTION_EDUCATION_DB_ID not set — education auto-fill disabled");
  if (!CERTIFICATIONS_DB) console.log("ℹ NOTION_CERTIFICATIONS_DB_ID not set — certifications auto-fill disabled");
  if (!COURSEWORK_DB) console.log("ℹ NOTION_COURSEWORK_DB_ID not set — coursework auto-fill disabled");
  if (!CURIOSITY_DB) console.log("ℹ NOTION_CURIOSITY_DB_ID not set — curiosity auto-fill disabled");
  if (!TECHSTACK_CATS_DB) console.log("ℹ NOTION_TECHSTACK_CATEGORIES_DB_ID not set — techstack categories auto-fill disabled");
  if (!TECHSTACK_SKILLS_DB) console.log("ℹ NOTION_TECHSTACK_SKILLS_DB_ID not set — techstack skills auto-fill disabled");
  if (!FOOTER_SOCIALS_DB) console.log("ℹ NOTION_FOOTER_SOCIALS_DB_ID not set — footer socials auto-fill disabled");
  if (!LIVE_STATUS_CONFIG_DB) console.log("ℹ NOTION_LIVE_STATUS_CONFIG_DB_ID not set — live status Update auto-trigger disabled");
}

// ── Notion plumbing ──────────────────────────────────────────────────────────

const dataSourceCache = new Map();
async function dsId(databaseId) {
  if (dataSourceCache.has(databaseId)) return dataSourceCache.get(databaseId);
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on ${databaseId}`);
  dataSourceCache.set(databaseId, id);
  return id;
}

const readTitle = (p) => p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "";
const readText = (p) => p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
const readNumber = (p) => p?.type === "number" ? p.number : null;
const readSelect = (p) => p?.type === "select" ? p.select?.name ?? null : null;
const readStatus = (p) => p?.type === "status" ? p.status?.name ?? null : null;
const readCheckbox = (p) => p?.type === "checkbox" ? p.checkbox : false;
const readRelationIds = (p) => p?.type === "relation" ? p.relation.map((r) => r.id) : [];
const readMulti = (p) => p?.type === "multi_select" ? p.multi_select.map((s) => s.name) : [];
const readUrl = (p) => p?.type === "url" ? (p.url || null) : null;

async function queryAll(dataSourceId, opts = {}) {
  const all = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      ...opts,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return all;
}

// ── Caches refreshed each tick ───────────────────────────────────────────────

async function loadRegions() {
  const ds = await dsId(REG_DB);
  const rows = await queryAll(ds);
  return rows.map((r) => ({
    pageId: r.id,
    region: readSelect(r.properties?.Region),
    name: readTitle(r.properties?.Name),
    photoGradient: readText(r.properties?.["Photo Gradient"]),
  })).filter((r) => r.region);
}

async function loadLocationStubs() {
  const ds = await dsId(LOC_DB);
  const rows = await queryAll(ds);
  return rows.map((r) => ({
    pageId: r.id,
    slug: readText(r.properties?.Slug),
    order: readNumber(r.properties?.Order),
  }));
}

async function loadStoryStubs() {
  if (!STORY_DB) return [];
  const ds = await dsId(STORY_DB);
  const rows = await queryAll(ds);
  return rows.map((r) => ({
    pageId: r.id,
    slug: readText(r.properties?.Slug),
    order: readNumber(r.properties?.Order),
  }));
}

// ── Geocoding (Nominatim — free, no auth, 1 req/sec polite cap) ──────────────

async function geocode(name) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const arr = await res.json();
  if (!arr.length) throw new Error(`No geocode result for "${name}"`);
  const hit = arr[0];
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    country: hit.address?.country ?? null,
    displayName: hit.display_name,
  };
}

// ── GPT for locations ────────────────────────────────────────────────────────

async function gptDeriveLocation(name, geocoded, regions) {
  const regionList = regions.map((r) => ({ slug: r.region, name: r.name }));
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You fill metadata for a personal travel website's Locations database. " +
          "Output JSON only. Slug rules: lowercase, ASCII letters and digits only, no spaces/hyphens/underscores. " +
          "Examples of valid slugs: arlington, dhaka, newyork, neworleans, kualalumpur. " +
          "Country names: use 'USA' for the United States, 'UK' for the United Kingdom, full name otherwise. " +
          "Region: pick from the provided existing regions; return null if none fit.",
      },
      {
        role: "user",
        content:
          `Place name: "${name}"\n` +
          `Geocoder said: country="${geocoded.country ?? "unknown"}", display="${geocoded.displayName}"\n` +
          `Existing regions: ${JSON.stringify(regionList)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "location_metadata",
        strict: true,
        schema: {
          type: "object",
          properties: {
            country: { type: "string" },
            slug: { type: "string" },
            regionSlug: { type: ["string", "null"] },
          },
          required: ["country", "slug", "regionSlug"],
          additionalProperties: false,
        },
      },
    },
  });
  return JSON.parse(completion.choices[0].message.content);
}

// ── Slug helpers ─────────────────────────────────────────────────────────────

function uniqueSlug(base, existingSlugs, suffixHint) {
  if (!existingSlugs.has(base)) return base;
  if (suffixHint) {
    const withHint = `${base}${suffixHint}`;
    if (!existingSlugs.has(withHint)) return withHint;
  }
  let i = 2;
  while (existingSlugs.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

// Title → "weekndconcertinnola" (lowercase, ASCII alphanumerics, capped at 60 chars)
function deriveSlugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 60);
  return slug || "untitled";
}

// ── Per-row processing: LOCATIONS ────────────────────────────────────────────

async function processLocationRow(row, regions, existingLocations) {
  const name = readTitle(row.properties?.Name);
  if (!name) {
    console.log(`  ⚠ row ${row.id} has no Name — skipping (uncheck box)`);
    await uncheck(row.id);
    return;
  }

  console.log(`  ▸ [Location] ${name}`);

  const geo = await geocode(name);
  console.log(`    nominatim: ${geo.lat}, ${geo.lng} (${geo.displayName.split(",").slice(-1)[0].trim()})`);
  await new Promise((r) => setTimeout(r, 1100)); // Nominatim politeness

  const derived = await gptDeriveLocation(name, geo, regions);
  console.log(`    gpt: country=${derived.country}, slug=${derived.slug}, region=${derived.regionSlug ?? "(none)"}`);

  let regionPageId = null;
  if (derived.regionSlug) {
    const r = regions.find((x) => x.region === derived.regionSlug);
    if (r) regionPageId = r.pageId;
    else console.log(`    ⚠ GPT picked region "${derived.regionSlug}" but no Regions row matches`);
  } else {
    console.log(`    ⚠ no matching region — add a Regions row (e.g. Europe with Region=world) and re-tick`);
  }

  const existingSlugs = new Set(
    existingLocations.filter((l) => l.pageId !== row.id && l.slug).map((l) => l.slug)
  );
  const finalSlug = uniqueSlug(derived.slug, existingSlugs, derived.regionSlug);
  if (finalSlug !== derived.slug) console.log(`    slug collision → using "${finalSlug}"`);

  const props = {
    Country: { rich_text: [{ text: { content: derived.country } }] },
    Slug: { rich_text: [{ text: { content: finalSlug } }] },
    Lat: { number: geo.lat },
    Lng: { number: geo.lng },
    "Region Group": { relation: regionPageId ? [{ id: regionPageId }] : [] },
    "Needs Auto-fill": { checkbox: false },
  };

  if (readNumber(row.properties?.Order) == null) {
    const maxOrder = Math.max(0, ...existingLocations.map((l) => l.order ?? 0));
    props.Order = { number: maxOrder + 1 };
  }
  if (!readStatus(row.properties?.Status)) {
    props.Status = { status: { name: "Draft" } };
  }
  if (!readSelect(row.properties?.Ratio)) {
    props.Ratio = { select: { name: "square" } };
  }
  const currentPhoto = readText(row.properties?.["Photo Gradient"]);
  if (!currentPhoto && regionPageId) {
    const r = regions.find((x) => x.pageId === regionPageId);
    if (r?.photoGradient) {
      props["Photo Gradient"] = { rich_text: [{ text: { content: r.photoGradient } }] };
    }
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(`    ✓ written → slug=${finalSlug}`);
}

// ── Per-row processing: STORIES ──────────────────────────────────────────────

async function processStoryRow(row, existingStories) {
  const title = readTitle(row.properties?.Name);
  if (!title) {
    console.log(`  ⚠ story row ${row.id} has no Name — skipping (uncheck box)`);
    await uncheck(row.id);
    return;
  }

  console.log(`  ▸ [Story] ${title}`);

  const baseSlug = deriveSlugFromTitle(title);
  const existingSlugs = new Set(
    existingStories.filter((s) => s.pageId !== row.id && s.slug).map((s) => s.slug)
  );
  const finalSlug = uniqueSlug(baseSlug, existingSlugs);
  if (finalSlug !== baseSlug) console.log(`    slug collision → using "${finalSlug}"`);

  const props = {
    Slug: { rich_text: [{ text: { content: finalSlug } }] },
    "Needs Auto-fill": { checkbox: false },
  };

  if (readNumber(row.properties?.Order) == null) {
    const maxOrder = Math.max(0, ...existingStories.map((s) => s.order ?? 0));
    props.Order = { number: maxOrder + 1 };
  }
  if (!readStatus(row.properties?.Status)) {
    props.Status = { status: { name: "Draft" } };
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(`    ✓ written → slug=${finalSlug}`);
}

// ── Deezer auto-fill for Music ───────────────────────────────────────────────

async function searchYouTube(title, artist) {
  if (!YT_API_KEY) return null;
  const q = encodeURIComponent(`${artist} ${title}`);
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&videoCategoryId=10&maxResults=1&key=${YT_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = await res.json();
  return data.items?.[0]?.id?.videoId ?? null;
}

async function searchDeezer(query) {
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deezer search ${res.status}`);
  const data = await res.json();
  if (!data.data?.length) throw new Error(`No Deezer result for "${query}"`);
  return data.data[0];
}

async function getDeezerAlbum(albumId) {
  const res = await fetch(`https://api.deezer.com/album/${albumId}`);
  if (!res.ok) throw new Error(`Deezer album ${res.status}`);
  return res.json();
}

function deriveSlugFromSong(title, artist) {
  return (artist + title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 60) || "untitled";
}

async function processMusicRow(row, existingSongs) {
  const raw = readTitle(row.properties?.Name);
  if (!raw) {
    console.log(`  ⚠ music row ${row.id} has no Name — skipping`);
    await uncheck(row.id);
    return;
  }

  console.log(`  ▸ [Music] "${raw}"`);

  // Support "Title - Artist" entry format
  let parsedTitle = raw;
  let parsedArtist = "";
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx > 0) {
    parsedTitle = raw.slice(0, dashIdx).trim();
    parsedArtist = raw.slice(dashIdx + 3).trim();
  }

  // Deezer: best-effort — non-fatal, many non-Western songs won't be on it
  let title = parsedTitle;
  let artist = parsedArtist || parsedTitle;
  let album = "";
  let coverUrl = null;
  let year = null;
  let genre = null;

  try {
    const deezerQ = parsedArtist ? `${parsedTitle} ${parsedArtist}` : parsedTitle;
    const track = await searchDeezer(deezerQ);
    const albumData = await getDeezerAlbum(track.album.id);
    title = track.title;
    artist = track.artist.name;
    album = track.album.title;
    coverUrl = track.album.cover_medium || track.album.cover_xl || null;
    year = albumData.release_date ? parseInt(albumData.release_date.split("-")[0]) : null;
    genre = albumData.genres?.data?.[0]?.name || null;
    console.log(`    deezer: "${title}" by ${artist} (${year ?? "?"})`);
  } catch (e) {
    console.log(`    deezer: skipped (${e.message})`);
  }

  // YouTube ID — search if key available and field not already filled
  const existingYtId = readText(row.properties?.["YouTube ID"]);
  let ytId = existingYtId || null;
  if (!ytId && YT_API_KEY) {
    try {
      ytId = await searchYouTube(title, artist);
      if (ytId) console.log(`    youtube: ${ytId}`);
      else console.log(`    youtube: no result`);
    } catch (e) {
      console.log(`    youtube: error — ${e.message}`);
    }
  }

  const baseSlug = deriveSlugFromSong(title, artist);
  const existingSlugs = new Set(
    existingSongs.filter((s) => s.pageId !== row.id && s.slug).map((s) => s.slug)
  );
  const finalSlug = uniqueSlug(baseSlug, existingSlugs);
  if (finalSlug !== baseSlug) console.log(`    slug collision → using "${finalSlug}"`);

  const props = {
    Name: { title: [{ text: { content: title } }] },
    Slug: { rich_text: [{ text: { content: finalSlug } }] },
    "Needs Auto-fill": { checkbox: false },
  };

  if (artist) props.Artist = { rich_text: [{ text: { content: artist } }] };
  if (album) props.Album = { rich_text: [{ text: { content: album } }] };
  if (year) props.Year = { number: year };
  if (genre) props.Genre = { select: { name: genre } };
  if (coverUrl) props["Cover URL"] = { url: coverUrl };
  if (ytId) props["YouTube ID"] = { rich_text: [{ text: { content: ytId } }] };

  if (readNumber(row.properties?.Order) == null) {
    const maxOrder = Math.max(0, ...existingSongs.map((s) => s.order ?? 0));
    props.Order = { number: maxOrder + 1 };
  }
  if (!readStatus(row.properties?.Status)) {
    props.Status = { status: { name: "Draft" } };
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(`    ✓ written → slug=${finalSlug}`);
}

// ── OMDb auto-fill for Series ────────────────────────────────────────────────

// IMDb image URLs accept inline transforms in the form
// `..._V1_QL75_UX{W}_CR{T},{L},{W},{H}_.jpg`. Most TV/movie posters are ~2:3
// aspect (e.g. 500×750), so a center square crop is W=500, top offset 125.
// If the original URL doesn't fit the IMDb CDN pattern we just return null.
function deriveSquarePosterUrl(posterUrl) {
  if (!posterUrl) return null;
  if (!posterUrl.includes("m.media-amazon.com")) return null;
  // Strip any existing _V1_... suffix and re-append our square transform.
  const base = posterUrl.replace(/\._V1_[^.]*\.(jpg|png|jpeg)$/i, "");
  if (base === posterUrl) return null; // no transform suffix found
  return `${base}._V1_QL75_UX500_CR0,125,500,500_.jpg`;
}

// Vision-derived palette: gpt-4o-mini looks at the poster and picks bg + accent
// hex codes that match the aesthetic of the existing 6 reference palettes.
async function derivePaletteFromPoster(title, genres, posterUrl) {
  const referencePalettes = [
    { mood: "lush, organic", bg: "#1a2810", accent: "#7ac050" },
    { mood: "cold, corporate", bg: "#0f1520", accent: "#6a88b8" },
    { mood: "clinical, alien teal", bg: "#0c1a1f", accent: "#50b8c8" },
    { mood: "haunted, lavender shadow", bg: "#080d15", accent: "#7888d0" },
    { mood: "smoky brown + gold", bg: "#1a1008", accent: "#c4a050" },
    { mood: "dried-blood ember", bg: "#180c0a", accent: "#c06840" },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You pick a 2-color palette for a 'now screening' UI card based on a TV show's poster and genres. " +
          "Output JSON with `bg` (very dark hex, 6-15% HSL lightness, low-to-medium saturation, sets the card mood) " +
          "and `accent` (mid-saturation hex, 45-65% HSL lightness, must be readable on bg, complements the poster's dominant hue). " +
          "Stay in the aesthetic family of these reference palettes (do not copy them — derive a new pair that fits the same vibe):\n" +
          referencePalettes.map((p) => `  ${p.mood}: bg=${p.bg}, accent=${p.accent}`).join("\n") +
          "\nHex format: lowercase #rrggbb, exactly 7 chars.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Show: "${title}". Genres: ${genres.length ? genres.join(", ") : "unknown"}.` },
          { type: "image_url", image_url: { url: posterUrl, detail: "low" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "show_palette",
        strict: true,
        schema: {
          type: "object",
          properties: {
            bg: { type: "string" },
            accent: { type: "string" },
          },
          required: ["bg", "accent"],
          additionalProperties: false,
        },
      },
    },
  });
  const parsed = JSON.parse(completion.choices[0].message.content);
  const hexRe = /^#[0-9a-f]{6}$/i;
  if (!hexRe.test(parsed.bg) || !hexRe.test(parsed.accent)) {
    throw new Error(`bad hex from gpt: bg=${parsed.bg} accent=${parsed.accent}`);
  }
  return { bg: parsed.bg.toLowerCase(), accent: parsed.accent.toLowerCase() };
}

// Exact-title lookup. `omdbType` is "series" | "movie" (omit to let OMDb guess).
async function omdbByTitle(title, yearHint, omdbType) {
  const params = new URLSearchParams({ apikey: OMDB_API_KEY, t: title });
  if (omdbType) params.set("type", omdbType);
  if (yearHint) params.set("y", String(yearHint));
  const res = await fetch(`https://www.omdbapi.com/?${params}`);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response !== "True") throw new Error(`OMDb: ${data.Error || "not found"}`);
  return data;
}

// Direct IMDb-ID lookup. The reliable path for Bengali/Bollywood (or any
// recent/regional) films OMDb can't resolve from an English title — fill the
// optional "IMDb ID" column (e.g. tt1979376) and we use it verbatim.
async function omdbById(imdbId) {
  const params = new URLSearchParams({ apikey: OMDB_API_KEY, i: imdbId });
  const res = await fetch(`https://www.omdbapi.com/?${params}`);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response !== "True") throw new Error(`OMDb: ${data.Error || "not found"}`);
  return data;
}

// Fuzzy search fallback (the `s=` endpoint). Picks an exact normalized-title
// match if present, else the first hit, then re-fetches full detail by id.
// Catches alternate spellings / transliterations common to Indian cinema.
async function omdbSearch(title, omdbType, yearHint) {
  const params = new URLSearchParams({ apikey: OMDB_API_KEY, s: title });
  if (omdbType) params.set("type", omdbType);
  if (yearHint) params.set("y", String(yearHint));
  const res = await fetch(`https://www.omdbapi.com/?${params}`);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response !== "True" || !Array.isArray(data.Search) || data.Search.length === 0) {
    throw new Error(`OMDb: ${data.Error || "no search results"}`);
  }
  const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const pick = data.Search.find((r) => norm(r.Title) === norm(title)) ?? data.Search[0];
  return omdbById(pick.imdbID);
}

// Unified resolver: explicit IMDb ID wins, then exact title, then fuzzy search.
async function omdbResolve({ title, yearHint, omdbType, imdbId }) {
  if (imdbId) return omdbById(imdbId);
  try {
    return await omdbByTitle(title, yearHint, omdbType);
  } catch {
    return await omdbSearch(title, omdbType, yearHint);
  }
}

async function omdbSeasonEpisodeCount(imdbId, seasonNum) {
  const params = new URLSearchParams({
    apikey: OMDB_API_KEY,
    i: imdbId,
    Season: String(seasonNum),
  });
  const res = await fetch(`https://www.omdbapi.com/?${params}`);
  if (!res.ok) return 0;
  const data = await res.json();
  if (data.Response !== "True") return 0;
  return Array.isArray(data.Episodes) ? data.Episodes.length : 0;
}

function deriveSlugFromShow(title) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

async function processSeriesRow(row, existingShows) {
  const title = readTitle(row.properties?.Name);
  if (!title) {
    console.log(`  ⚠ series row ${row.id} has no Name — skipping`);
    await uncheck(row.id);
    return;
  }

  // Type column: "Movie" | "Series" (defaults to Series for legacy rows).
  // Tolerates either "Type"/"type" property naming.
  const typeRaw = readSelect(row.properties?.Type ?? row.properties?.type);
  const isMovie = (typeRaw ?? "").toLowerCase() === "movie";
  const kind = isMovie ? "Movie" : "Series";

  console.log(`  ▸ [${kind}] ${title}`);

  // Slug derivation always runs
  const baseSlug = deriveSlugFromShow(title);
  const existingSlugs = new Set(
    existingShows.filter((s) => s.pageId !== row.id && s.slug).map((s) => s.slug)
  );
  const finalSlug = uniqueSlug(baseSlug, existingSlugs);
  if (finalSlug !== baseSlug) console.log(`    slug collision → using "${finalSlug}"`);

  const props = {
    Slug: { rich_text: [{ text: { content: finalSlug } }] },
    "Needs Auto-fill": { checkbox: false },
  };

  // OMDb metadata fill (best-effort, only if key is set)
  if (OMDB_API_KEY) {
    try {
      const existingYears = readText(row.properties?.Years);
      const yearHint = existingYears ? existingYears.match(/\d{4}/)?.[0] : null;
      // Optional manual override for films OMDb can't match by title.
      const imdbId = (readText(row.properties?.["IMDb ID"]) || "").trim() || null;
      const data = await omdbResolve({
        title,
        yearHint,
        omdbType: isMovie ? "movie" : "series",
        imdbId,
      });

      if (isMovie) {
        // Films carry no Seasons/Episodes — the UI shows "Movie" instead.
        console.log(`    omdb: ${data.Title} (${data.Year}) · film · ${data.Runtime ?? "?"}`);
      } else {
        console.log(`    omdb: ${data.Title} (${data.Year}) · ${data.totalSeasons} seasons`);

        const totalSeasons = parseInt(data.totalSeasons, 10) || 0;
        const seasonsToFetch = Math.min(totalSeasons, 20); // safety cap

        // Sum episodes across seasons
        let totalEpisodes = 0;
        for (let s = 1; s <= seasonsToFetch; s++) {
          const n = await omdbSeasonEpisodeCount(data.imdbID, s);
          totalEpisodes += n;
        }
        console.log(`    omdb: ${totalEpisodes} total episodes across ${seasonsToFetch} seasons`);

        if (readNumber(row.properties?.Seasons) == null && totalSeasons) {
          props.Seasons = { number: totalSeasons };
        }
        if (readNumber(row.properties?.Episodes) == null && totalEpisodes) {
          props.Episodes = { number: totalEpisodes };
        }
      }

      if (!readText(row.properties?.Runtime) && data.Runtime && data.Runtime !== "N/A") {
        // Series runtime is a per-episode average; a film's is its full length.
        const runtimeText = isMovie ? data.Runtime : `${data.Runtime} avg`;
        props.Runtime = { rich_text: [{ text: { content: runtimeText } }] };
      }
      if (!readText(row.properties?.Years) && data.Year && data.Year !== "N/A") {
        props.Years = { rich_text: [{ text: { content: data.Year } }] };
      }
      const genreList = (data.Genre && data.Genre !== "N/A")
        ? data.Genre.split(",").map((g) => g.trim()).filter(Boolean)
        : [];
      if (readMulti(row.properties?.Genres).length === 0 && genreList.length) {
        props.Genres = { multi_select: genreList.map((name) => ({ name })) };
      }

      // Poster URLs (rectangular + square crop)
      const posterUrl = data.Poster && data.Poster !== "N/A" ? data.Poster : null;
      if (posterUrl) {
        if (!readUrl(row.properties?.["Poster URL"])) {
          props["Poster URL"] = { url: posterUrl };
        }
        const sq = deriveSquarePosterUrl(posterUrl);
        if (sq && !readUrl(row.properties?.["Poster Square URL"])) {
          props["Poster Square URL"] = { url: sq };
        }
      }

      // Vision palette: only if poster exists and bg/accent are empty
      const needBg = !readText(row.properties?.["BG Color"]);
      const needAccent = !readText(row.properties?.["Accent Color"]);
      if (posterUrl && (needBg || needAccent)) {
        try {
          const genresForPalette = readMulti(row.properties?.Genres).length
            ? readMulti(row.properties?.Genres)
            : genreList;
          const palette = await derivePaletteFromPoster(title, genresForPalette, posterUrl);
          console.log(`    palette: bg=${palette.bg} accent=${palette.accent}`);
          if (needBg) props["BG Color"] = { rich_text: [{ text: { content: palette.bg } }] };
          if (needAccent) props["Accent Color"] = { rich_text: [{ text: { content: palette.accent } }] };
        } catch (e) {
          console.log(`    palette: skipped (${e.message})`);
        }
      }
    } catch (e) {
      console.log(`    omdb: skipped (${e.message})`);
    }
  }

  // Order + Status defaults (only if empty)
  if (readNumber(row.properties?.Order) == null) {
    const maxOrder = Math.max(0, ...existingShows.map((s) => s.order ?? 0));
    props.Order = { number: maxOrder + 1 };
  }
  if (!readStatus(row.properties?.Status)) {
    props.Status = { status: { name: "Draft" } };
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(`    ✓ written → slug=${finalSlug}`);
}

// ── Writing auto-fill ────────────────────────────────────────────────────────

// Recursively walk a block tree and sum words across every rich_text array
// (paragraphs, headings, quotes, callouts, list items, table cells, columns).
// Empty cells and image captions count too — close enough for a page estimate.
async function countPageWords(pageId) {
  const countRichText = (rt) => {
    if (!Array.isArray(rt)) return 0;
    return rt.reduce((sum, t) => {
      const s = t.plain_text || t.text?.content || "";
      return sum + s.trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  };

  const fetchAll = async (blockId) => {
    const all = [];
    let cursor;
    do {
      const res = await notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });
      all.push(...res.results);
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);
    return all;
  };

  let total = 0;
  const visit = async (id) => {
    const children = await fetchAll(id);
    for (const block of children) {
      const inner = block[block.type];
      if (inner?.rich_text) total += countRichText(inner.rich_text);
      if (block.type === "table_row") {
        for (const cell of block.table_row.cells) total += countRichText(cell);
      }
      if (block.has_children) await visit(block.id);
    }
  };
  await visit(pageId);
  return total;
}

async function processWritingRow(row, existingPieces) {
  const title = readTitle(row.properties?.Name);
  if (!title) {
    console.log(`  ⚠ writing row ${row.id} has no Name — skipping`);
    await uncheck(row.id);
    return;
  }

  console.log(`  ▸ [Writing] ${title}`);

  // Deterministic slug (kebab-case for readability in URLs)
  const baseSlug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
  const existingSlugs = new Set(
    existingPieces.filter((p) => p.pageId !== row.id && p.slug).map((p) => p.slug)
  );
  const finalSlug = uniqueSlug(baseSlug, existingSlugs);
  if (finalSlug !== baseSlug) console.log(`    slug collision → using "${finalSlug}"`);

  // Word-count → pages (250 words/page, min 1)
  const words = await countPageWords(row.id);
  const pages = Math.max(1, Math.ceil(words / 250));
  console.log(`    words: ${words} → pages: ${pages}`);

  const props = {
    Slug: { rich_text: [{ text: { content: finalSlug } }] },
    Pages: { number: pages },
    "Needs Auto-fill": { checkbox: false },
  };

  if (readNumber(row.properties?.Order) == null) {
    const maxOrder = Math.max(0, ...existingPieces.map((p) => p.order ?? 0));
    props.Order = { number: maxOrder + 1 };
  }
  if (!readStatus(row.properties?.Status)) {
    props.Status = { status: { name: "Draft" } };
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(`    ✓ written → slug=${finalSlug} pages=${pages}`);
}

// ── Uncheck helper (used on errors and for empty-Name rows) ──────────────────

async function uncheck(pageId) {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: { "Needs Auto-fill": { checkbox: false } },
    });
  } catch (e) {
    console.log(`    ⚠ failed to uncheck: ${e.message}`);
  }
}

// ── Pinboard auto-fill ───────────────────────────────────────────────────────
// On "Needs Auto-fill" tick:
//   1. Pull image (Files & media column "Photo" preferred, else Image URL)
//   2. Read natural Width × Height via image-size
//   3. Set Display H — 460 for poster-ish (h/w > 1.3), 285 otherwise
//   4. Ask gpt-4o-mini vision for category: nature/friends/family/solo
//   5. Map category → Pin Color hex and write back

const PINBOARD_CATEGORY_TO_HEX = {
  nature:  "#6b9b65", // green
  friends: "#c4a050", // gold
  family:  "#a85f42", // terracotta
  solo:    "#5b7fa3", // blue
};

const PINBOARD_FILES_FIRST = (prop) => {
  if (prop?.type !== "files") return null;
  for (const f of prop.files) {
    const url = f.file?.url || f.external?.url;
    if (url) return url;
  }
  return null;
};

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function readDimensions(url) {
  const buf = await fetchImageBuffer(url);
  const { width, height } = imageSize(buf);
  if (!width || !height) throw new Error("image-size returned no dimensions");
  return { width, height };
}

async function classifyPinColor(imageUrl) {
  // gpt-4o-mini supports vision input. We constrain it to one of four
  // labels and short-circuit if it answers with anything else.
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "Classify this photo into exactly one category:",
            "- nature  (landscapes, scenery, plants, wildlife, the photo has no people prominently featured)",
            "- friends (a group of friends / peers / classmates / college-age people who look like friends)",
            "- family  (family members — parents, siblings, cousins, aunts/uncles, kids — extended family included)",
            "- solo    (just one person)",
            "Respond with ONLY the lowercase category name, nothing else.",
          ].join("\n"),
        },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    }],
    max_tokens: 5,
    temperature: 0,
  });
  const raw = completion.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "";
  // Tolerate a little wrap (e.g. punctuation, trailing period).
  const cat = raw.replace(/[^a-z]/g, "");
  if (cat in PINBOARD_CATEGORY_TO_HEX) return { category: cat, hex: PINBOARD_CATEGORY_TO_HEX[cat] };
  // Fall back to friends — best generic guess for personal-site photos.
  return { category: "friends", hex: PINBOARD_CATEGORY_TO_HEX.friends };
}

async function processPinboardRow(row) {
  const props = row.properties ?? {};
  const title = readTitle(props.Title) || readTitle(props.Name) || "(untitled)";
  console.log(`  ▸ [Pinboard] ${title}`);

  const imageUrl = PINBOARD_FILES_FIRST(props.Photo) || readUrl(props["Image URL"]);
  if (!imageUrl) {
    console.log(`    ⚠ no Photo or Image URL — uncheck`);
    await uncheck(row.id);
    return;
  }

  // Dimensions
  let width = 1200, height = 800;
  try {
    const d = await readDimensions(imageUrl);
    width = d.width; height = d.height;
    console.log(`    📐 ${width}×${height}`);
  } catch (e) {
    console.log(`    ⚠ dimension read failed (${e.message}) — defaulting to ${width}×${height}`);
  }

  // Display H — bigger for poster-shaped (tall) images.
  const displayH = (height / width) > 1.3 ? 460 : 285;

  // Pin Color via vision classification.
  let category = "friends";
  let hex = PINBOARD_CATEGORY_TO_HEX.friends;
  try {
    const result = await classifyPinColor(imageUrl);
    category = result.category;
    hex = result.hex;
    console.log(`    🎨 ${category} → ${hex}`);
  } catch (e) {
    console.log(`    ⚠ classification failed (${e.message}) — defaulting to friends/gold`);
  }

  await notion.pages.update({
    page_id: row.id,
    properties: {
      Width: { number: width },
      Height: { number: height },
      "Display H": { number: displayH },
      "Pin Color": { rich_text: [{ text: { content: hex } }] },
      "Needs Auto-fill": { checkbox: false },
    },
  });
}

async function tickPinboard() {
  if (!PINBOARD_DB) return;
  const ds = await dsId(PINBOARD_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} pinboard photo(s) to process`);
  for (const row of res.results) {
    try {
      await processPinboardRow(row);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

// ── Hero auto-fill (Chips / Stats / Ticker) ──────────────────────────────────
// Shared handler — all three DBs use the same lightweight contract:
//   - User adds a row, types content, ticks `Needs Auto-fill`.
//   - Watcher sets Order = max+1 (only if blank), Status = Draft (only if blank),
//     then unchecks the box.
// No GPT, no external APIs — Hero content is short enough that the value-add
// is purely ergonomic (no manual numbering).
//
// Requires a `Needs Auto-fill` (Checkbox) column on each DB. If you don't add
// the column, the watcher's filter just returns 0 rows for that DB — harmless.

async function tickHeroSimple(label, dbId) {
  if (!dbId) return;
  const ds = await dsId(dbId);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} ${label} row(s) to process`);

  // Compute current max Order once, then increment locally for each new row
  // so a batch of newly-added rows all get sequential numbers in one tick.
  const allRows = await queryAll(ds);
  let nextOrder = Math.max(
    0,
    ...allRows.map((r) => readNumber(r.properties?.Order) ?? 0)
  );

  for (const row of res.results) {
    try {
      const props = { "Needs Auto-fill": { checkbox: false } };
      if (readNumber(row.properties?.Order) == null) {
        nextOrder++;
        props.Order = { number: nextOrder };
      }
      if (!readStatus(row.properties?.Status)) {
        props.Status = { status: { name: "Draft" } };
      }
      await notion.pages.update({ page_id: row.id, properties: props });
      const title = readTitle(row.properties?.Name) || "(blank)";
      console.log(`  ✓ ${label}: "${title}"`);
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

// ── Generic slug auto-fill for sluggable list DBs ────────────────────────────
// Shared handler used by Projects + Experiences. On Needs Auto-fill = true:
//   - Slug derived from Name (kebab-case, ASCII, max 60 chars) if blank
//   - Order = max+1 if blank
//   - Status = Draft if blank
// Page body is never touched — user owns that fully.

async function tickSluggableDB(label, dbId) {
  if (!dbId) return;
  const ds = await dsId(dbId);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} ${label}(s) to process`);
  const allRows = await queryAll(ds);

  for (const row of res.results) {
    try {
      const props = row.properties ?? {};
      const title = readTitle(props.Name);
      if (!title) {
        console.log(`  ⚠ ${label} row ${row.id.slice(0, 8)}… has no Name — uncheck`);
        await uncheck(row.id);
        continue;
      }

      const update = { "Needs Auto-fill": { checkbox: false } };

      if (!readText(props.Slug)) {
        const baseSlug = title
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "untitled";
        const existingSlugs = new Set(
          allRows
            .filter((r) => r.id !== row.id)
            .map((r) => readText(r.properties?.Slug))
            .filter(Boolean)
        );
        update.Slug = { rich_text: [{ text: { content: uniqueSlug(baseSlug, existingSlugs) } }] };
      }

      if (readNumber(props.Order) == null) {
        const maxOrder = Math.max(0, ...allRows.map((r) => readNumber(r.properties?.Order) ?? 0));
        update.Order = { number: maxOrder + 1 };
      }
      if (!readStatus(props.Status)) {
        update.Status = { status: { name: "Draft" } };
      }

      await notion.pages.update({ page_id: row.id, properties: update });
      console.log(`  ✓ ${label}: "${title}"  →  slug=${update.Slug?.rich_text[0].text.content ?? readText(props.Slug)}`);
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

// ── Project Media auto-fill ──────────────────────────────────────────────────
// On Needs Auto-fill = true:
//   - YouTube ID parsed from URL if Type=youtube and ID is blank
//   - Order = max+1 if blank
//   - Status = Draft if blank

function parseYouTubeId(url) {
  if (!url) return null;
  // Accept watch?v=, youtu.be/, and embed/ URLs. All extract the 11-char ID.
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

async function tickProjectMedia() {
  if (!PROJECT_MEDIA_DB) return;
  const ds = await dsId(PROJECT_MEDIA_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} project media row(s) to process`);
  const allRows = await queryAll(ds);

  for (const row of res.results) {
    try {
      const props = row.properties ?? {};
      const update = { "Needs Auto-fill": { checkbox: false } };
      const type = readSelect(props.Type);
      const url = readUrl(props.URL);

      if (type === "youtube" && url && !readText(props["YouTube ID"])) {
        const ytId = parseYouTubeId(url);
        if (ytId) {
          update["YouTube ID"] = { rich_text: [{ text: { content: ytId } }] };
        } else {
          console.log(`  ⚠ youtube row: couldn't parse video ID from URL "${url}"`);
        }
      }

      if (readNumber(props.Order) == null) {
        const maxOrder = Math.max(0, ...allRows.map((r) => readNumber(r.properties?.Order) ?? 0));
        update.Order = { number: maxOrder + 1 };
      }
      if (!readStatus(props.Status)) {
        update.Status = { status: { name: "Draft" } };
      }

      await notion.pages.update({ page_id: row.id, properties: update });
      const name = readTitle(props.Name) || "(no name)";
      console.log(`  ✓ media: "${name}"${update["YouTube ID"] ? ` (yt=${update["YouTube ID"].rich_text[0].text.content})` : ""}`);
    } catch (e) {
      console.log(`  ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

// ── Live Status auto-trigger ────────────────────────────────────────────────
// Polls the Live Status Config DB for `Update` checkbox = true, then hits
// the regenerate-status route to trigger an immediate regen. The route
// itself decides whether to push the Status Line verbatim or call GPT,
// and unchecks Update after processing — so the next watcher tick sees
// the box cleared and stays quiet.
//
// Requires the dev server (npm run dev) to be running so the fetch hits
// localhost:3000. Production gets this for free via Vercel Cron (hourly).

async function tickLiveStatus() {
  if (!LIVE_STATUS_CONFIG_DB) return;
  const ds = await dsId(LIVE_STATUS_CONFIG_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: {
      and: [
        { property: "Status", status: { equals: "Published" } },
        { property: "Update", checkbox: { equals: true } },
      ],
    },
    page_size: 1,
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] live status: Update ticked, triggering regen via ${LIVE_STATUS_REGEN_URL}...`);
  try {
    const r = await fetch(LIVE_STATUS_REGEN_URL);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    if (json?.action) {
      const preview = json.text ? `: "${json.text.length > 80 ? json.text.slice(0, 77) + "..." : json.text}"` : "";
      console.log(`  ✓ ${json.action}${preview}`);
    } else {
      console.log(`  ⚠ regen route responded HTTP ${r.status} — ${text.slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ✗ regen call failed (is the dev server running?): ${e.message}`);
  }
}

// ── Main loop: poll both DBs in parallel ─────────────────────────────────────

async function tickLocations() {
  const ds = await dsId(LOC_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} location(s) to process`);
  const [regions, locStubs] = await Promise.all([loadRegions(), loadLocationStubs()]);
  for (const row of res.results) {
    try {
      await processLocationRow(row, regions, locStubs);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

async function tickStories() {
  if (!STORY_DB) return;
  const ds = await dsId(STORY_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} story(ies) to process`);
  const storyStubs = await loadStoryStubs();
  for (const row of res.results) {
    try {
      await processStoryRow(row, storyStubs);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

async function tickMusic() {
  if (!MUSIC_DB) return;
  const ds = await dsId(MUSIC_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} song(s) to process`);

  // Load all songs for slug uniqueness check
  const allRows = await queryAll(ds);
  const existingSongs = allRows.map((r) => ({
    pageId: r.id,
    slug: readText(r.properties?.Slug),
    order: readNumber(r.properties?.Order),
  }));

  for (const row of res.results) {
    try {
      await processMusicRow(row, existingSongs);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

async function tickSeries() {
  if (!SERIES_DB) return;
  const ds = await dsId(SERIES_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} show(s) to process`);

  const allRows = await queryAll(ds);
  const existingShows = allRows.map((r) => ({
    pageId: r.id,
    slug: readText(r.properties?.Slug),
    order: readNumber(r.properties?.Order),
  }));

  for (const row of res.results) {
    try {
      await processSeriesRow(row, existingShows);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

async function tickWriting() {
  if (!WRITING_DB) return;
  const ds = await dsId(WRITING_DB);
  const res = await notion.dataSources.query({
    data_source_id: ds,
    filter: { property: "Needs Auto-fill", checkbox: { equals: true } },
  });
  if (res.results.length === 0) return;

  console.log(`\n[${new Date().toLocaleTimeString()}] ${res.results.length} writing piece(s) to process`);

  const allRows = await queryAll(ds);
  const existingPieces = allRows.map((r) => ({
    pageId: r.id,
    slug: readText(r.properties?.Slug),
    order: readNumber(r.properties?.Order),
  }));

  for (const row of res.results) {
    try {
      await processWritingRow(row, existingPieces);
    } catch (e) {
      console.log(`    ✗ error: ${e.message}`);
      await uncheck(row.id);
    }
  }
}

async function tick() {
  // Each handler is isolated: a DB that's missing the "Needs Auto-fill" column
  // (Notion throws "Could not find property") or any other per-handler failure
  // must not abort the rest of the pass. allSettled keeps every other DB going;
  // we log the failures so they're visible in the watcher output / route JSON.
  const handlers = [
    ["locations", tickLocations()],
    ["stories", tickStories()],
    ["music", tickMusic()],
    ["series", tickSeries()],
    ["writing", tickWriting()],
    ["pinboard", tickPinboard()],
    ["hero chips", tickHeroSimple("hero chips", HERO_CHIPS_DB)],
    ["hero stats", tickHeroSimple("hero stats", HERO_STATS_DB)],
    ["hero ticker", tickHeroSimple("hero ticker", HERO_TICKER_DB)],
    ["project", tickSluggableDB("project", PROJECTS_DB)],
    ["experience", tickSluggableDB("experience", EXPERIENCES_DB)],
    ["project media", tickProjectMedia()],
    ["education", tickHeroSimple("education", EDUCATION_DB)],
    ["certification", tickHeroSimple("certification", CERTIFICATIONS_DB)],
    ["coursework", tickHeroSimple("coursework", COURSEWORK_DB)],
    ["curiosity", tickHeroSimple("curiosity", CURIOSITY_DB)],
    ["techstack-category", tickHeroSimple("techstack-category", TECHSTACK_CATS_DB)],
    ["techstack-skill", tickHeroSimple("techstack-skill", TECHSTACK_SKILLS_DB)],
    ["footer-social", tickHeroSimple("footer-social", FOOTER_SOCIALS_DB)],
    ["live status", tickLiveStatus()],
  ];
  const results = await Promise.allSettled(handlers.map(([, p]) => p));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.log(`  ⚠ ${handlers[i][0]} skipped: ${r.reason?.message ?? r.reason}`);
    }
  });
}

// One full pass over every DB handler. Wraps tick() with env validation, lazy
// client construction, and console capture so the HTTP route can report what it
// did in its JSON response. Returns { ok, ms, logs } or { ok:false, error }.
export async function runAutofill() {
  if (!NOTION_TOKEN || !OPENAI_KEY || !LOC_DB || !REG_DB) {
    return {
      ok: false,
      error:
        "Missing required env: NOTION_TOKEN, OPENAI_API_KEY, NOTION_LOCATIONS_DB_ID, NOTION_REGIONS_DB_ID",
    };
  }
  ensureClients();
  const logs = [];
  const orig = console.log;
  console.log = (...a) => { logs.push(a.map(String).join(" ")); orig(...a); };
  const startedAt = Date.now();
  try {
    await tick();
  } finally {
    console.log = orig;
  }
  return { ok: true, ms: Date.now() - startedAt, logs };
}
