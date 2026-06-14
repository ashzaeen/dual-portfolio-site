import { cache } from "react";
import { Client } from "@notionhq/client";
import { FALLBACK_ROLES } from "@/data/roles";
import { FALLBACK_HERO_STATUS } from "@/data/status";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import {
  FALLBACK_HERO_CONFIG,
  FALLBACK_HERO_CHIPS,
  FALLBACK_HERO_STATS,
  FALLBACK_HERO_TICKER,
} from "@/data/hero";
import { LOCATIONS as FALLBACK_LOCATIONS } from "@/data/locations";
import { STORIES as FALLBACK_STORIES, LOCATION_STORIES as FALLBACK_LOCATION_STORIES } from "@/data/stories";
import { FALLBACK_SONGS } from "@/data/songs";
import { FALLBACK_SHOWS } from "@/data/shows";
import { FALLBACK_PIECES, DESK_SLOTS, withPdfArticles } from "@/data/pieces";
import { FALLBACK_DESK } from "@/data/desk";
import { ITEMS as CURATED_PINBOARD_ITEMS, gallerySlug } from "@/data/pinboard";
import { FALLBACK_PROJECTS, PROJECTS_BY_SLUG } from "@/data/projects";
import { FALLBACK_EXPERIENCES, EXPERIENCES_BY_SLUG } from "@/data/experiences";
import {
  FALLBACK_EDUCATION,
  FALLBACK_CERTIFICATIONS,
  FALLBACK_COURSEWORK,
  FALLBACK_CURIOSITY,
} from "@/data/credentials";
import { FALLBACK_TECHSTACK } from "@/data/techstack";
import {
  FALLBACK_FOOTER_PRO,
  FALLBACK_FOOTER_PERSONAL,
  FALLBACK_FOOTER_SOCIALS,
} from "@/data/footer";
import { pickSlot, fillStatus } from "@/lib/liveStatus";

const token = process.env.NOTION_TOKEN;

export const notion = token ? new Client({ auth: token }) : null;

// ── Build-time request dedup ─────────────────────────────────────────────────
// React's cache() only dedupes within a single render. During `next build`,
// every statically-generated slug page re-renders the full landing underneath,
// which would re-issue every Notion read and trip Notion's rate limit (~3 req/s)
// — hundreds of calls across the build. In the BUILD PHASE ONLY, memoize the
// read methods so each distinct request is made once per build worker (calls
// drop from ~hundreds to ~once-per-DB). Failed requests are NOT cached, so a
// transient rate-limit can still be retried and never bakes fallback data into a
// static page. Runtime (ISR / per-request) is left completely untouched.
if (notion && process.env.NEXT_PHASE === "phase-production-build") {
  const memoize = (obj, method) => {
    const orig = obj[method].bind(obj);
    const cache = new Map();
    obj[method] = (args) => {
      const key = JSON.stringify(args ?? {});
      if (!cache.has(key)) {
        cache.set(
          key,
          Promise.resolve(orig(args)).catch((err) => {
            cache.delete(key); // don't cache failures — let a later page retry
            throw err;
          })
        );
      }
      return cache.get(key);
    };
  };
  memoize(notion.dataSources, "query");
  memoize(notion.databases, "retrieve");
  memoize(notion.blocks.children, "list");
}

const PUBLISHED_FILTER = {
  property: "Status",
  status: { equals: "Published" },
};

const ORDER_SORT = [{ property: "Order", direction: "ascending" }];

// In Notion API 2025+, a database holds one or more data sources;
// queries run against the data source, not the database. We resolve
// the (single) data source ID once per database and cache it.
const dataSourceCache = new Map();

async function resolveDataSourceId(databaseId) {
  if (dataSourceCache.has(databaseId)) return dataSourceCache.get(databaseId);
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on database ${databaseId}`);
  dataSourceCache.set(databaseId, id);
  return id;
}

// ── Property readers ─────────────────────────────────────────────────────────

function readTitle(prop) {
  if (!prop || prop.type !== "title") return "";
  return prop.title.map((t) => t.plain_text).join("").trim();
}
function readText(prop) {
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("").trim();
}
// Like readText but preserves the raw Notion rich_text array (annotations
// intact) so consumers can render bold/italic/links. Used by wall paper
// items where italic → green is meaningful (see WallRichText).
function readRichText(prop) {
  if (!prop || prop.type !== "rich_text") return [];
  return prop.rich_text;
}
function readNumber(prop) {
  if (!prop || prop.type !== "number") return null;
  return prop.number;
}
function readSelect(prop) {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}
function readMultiSelect(prop) {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((s) => s.name);
}
function readCheckbox(prop) {
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox;
}
function readUrl(prop) {
  if (!prop || prop.type !== "url") return null;
  return prop.url || null;
}
function readRelationIds(prop) {
  if (!prop || prop.type !== "relation") return [];
  return prop.relation.map((r) => r.id);
}
function readFiles(prop) {
  // Notion Files & media column. For uploaded files Notion returns a
  // pre-signed AWS URL on `.file.url` that expires after ~1 hour; for
  // externally-linked files it's on `.external.url` and is stable.
  if (!prop || prop.type !== "files") return [];
  return prop.files
    .map((f) => f.file?.url || f.external?.url || null)
    .filter(Boolean);
}

// Like readFiles, but routes Notion-UPLOADED files through the image proxy so
// the markup never carries an expiring signed URL. External (pasted) URLs are
// stable and pass through untouched. `pageId`/`propName` let the proxy re-mint
// a fresh signed URL on demand; the index keeps it aligned to the files array.
// See app/api/notion-image/route.js.
function readProxiedFiles(prop, pageId, propName) {
  if (!prop || prop.type !== "files") return [];
  return prop.files
    .map((f, i) => {
      if (f.file?.url) return notionImageProxyUrl({ pageId, prop: propName, index: i });
      if (f.external?.url) return f.external.url;
      return null;
    })
    .filter(Boolean);
}

// Stable URL for the image proxy. Pass either { blockId } for an image block or
// { pageId, prop, index } for a Files & media property entry.
function notionImageProxyUrl({ blockId, pageId, prop, index = 0 }) {
  const qs = new URLSearchParams();
  if (blockId) qs.set("b", blockId);
  else {
    qs.set("p", pageId);
    qs.set("prop", prop);
    qs.set("i", String(index));
  }
  return `/api/notion-image?${qs.toString()}`;
}

// ── Notion blocks (recursive) ────────────────────────────────────────────────

async function fetchBlockChildren(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  for (const block of blocks) {
    // Swap any uploaded (file-type) image block's expiring signed URL for a
    // stable proxy ref keyed on the block id. Every block renderer reads
    // `block.image.file.url`, so this one rewrite covers them all. External
    // (pasted-URL) images are stable and left alone.
    if (block.type === "image" && block.image?.type === "file" && block.image.file?.url) {
      block.image.file.url = notionImageProxyUrl({ blockId: block.id });
    }

    // Same for uploaded file/pdf blocks (the download/link buttons) so their
    // expiring signed URLs don't rot in cached HTML. Pasted external links are
    // stable and left untouched.
    if ((block.type === "file" || block.type === "pdf") &&
        block[block.type]?.type === "file" && block[block.type].file?.url) {
      block[block.type].file.url = notionImageProxyUrl({ blockId: block.id });
    }

    // Recursively populate children for blocks that have them (tables, toggles, etc.)
    if (block.has_children) {
      const children = await fetchBlockChildren(block.id);
      const typeKey = block.type;
      if (block[typeKey]) {
        block[typeKey].children = children;
      }
    }
  }

  return blocks;
}

// ── Roles ────────────────────────────────────────────────────────────────────

export async function fetchRoles() {
  const dbId = process.env.NOTION_ROLES_DB_ID;
  if (!notion || !dbId) return FALLBACK_ROLES;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    const roles = res.results
      .map((row) => readTitle(row.properties?.Name))
      .filter(Boolean);

    return roles.length > 0 ? roles : FALLBACK_ROLES;
  } catch (err) {
    console.error("[notion] fetchRoles failed, using fallback:", err.message);
    return FALLBACK_ROLES;
  }
}

// ── Section copy (eyebrow / title / intro / instruction per section) ──────────
// One row per personal-side section, keyed by the lowercased Name/title. Each
// field falls back to FALLBACK_SECTION_COPY so a blank cell (or a missing row /
// DB) keeps the hand-written default. cache-wrapped because PersonalLanding
// renders on the landing route AND every personal slug route.
// Schema: Name (Title), Eyebrow, Title, Intro, Intro Mobile, Instruction (all
// rich text), Status. Status-gated to "Published".
async function _fetchSectionCopy() {
  const dbId = process.env.NOTION_SECTIONS_DB_ID;
  if (!notion || !dbId) return FALLBACK_SECTION_COPY;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
    });

    const out = { ...FALLBACK_SECTION_COPY };
    for (const row of res.results) {
      const props = row.properties ?? {};
      const key = readTitle(props.Name).toLowerCase().trim();
      if (!key) continue;
      const base = FALLBACK_SECTION_COPY[key] ?? {};
      // Column names follow the live "Sections" DB; aliases tolerate the
      // shorter names too so either convention works.
      const intro = readText(props.Introduction) || readText(props.Intro);
      const introMobile =
        readText(props["Mobile Introduction"]) || readText(props["Intro Mobile"]);
      const instruction = readText(props.Instruction);
      const instructionMobile =
        readText(props["Mobile Instruction"]) || readText(props["Instruction Mobile"]);
      out[key] = {
        eyebrow: readText(props.Eyebrow) || base.eyebrow || "",
        title: readText(props.Title) || base.title || "",
        intro: intro || base.intro || "",
        introMobile: introMobile || intro || base.introMobile || base.intro || "",
        instruction: instruction || base.instruction || "",
        instructionMobile:
          instructionMobile || instruction || base.instructionMobile || base.instruction || "",
      };
    }
    return out;
  } catch (err) {
    console.error("[notion] fetchSectionCopy failed, using fallback:", err.message);
    return FALLBACK_SECTION_COPY;
  }
}
export const fetchSectionCopy = cache(_fetchSectionCopy);

// ── Professional section copy (separate DB) ──────────────────────────────────
// Its own database, one row per pro section. The row's Name can be a friendly
// label (e.g. "Tech Stack", "Experiences - Work") — proKeyFromName maps it to
// the internal key the components read. Fields: Eyebrow, Title, Introduction
// (rich text), Status.
function proKeyFromName(name) {
  const norm = (name || "").toLowerCase().replace(/[\s_]+/g, " ").trim();
  const compact = norm.replace(/[^a-z0-9]/g, "");
  if (compact.startsWith("project")) return "projects";
  if (compact.startsWith("credential")) return "credentials";
  if (compact.startsWith("techstack") || compact.startsWith("knowledgegraph")) return "techstack";
  // "extra" wins over the generic "experiences" check (Experiences - Extra,
  // Extracurriculars) so the second header maps correctly.
  if (norm.includes("extra")) return "experiences-extra";
  if (compact.startsWith("experience")) return "experiences";
  return norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function _fetchProSectionCopy() {
  const dbId = process.env.NOTION_PRO_SECTIONS_DB_ID;
  if (!notion || !dbId) return FALLBACK_SECTION_COPY;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
    });
    const out = { ...FALLBACK_SECTION_COPY };
    for (const row of res.results) {
      const props = row.properties ?? {};
      const key = proKeyFromName(readTitle(props.Name));
      if (!key) continue;
      const base = FALLBACK_SECTION_COPY[key] ?? {};
      out[key] = {
        ...base,
        eyebrow: readText(props.Eyebrow) || base.eyebrow || "",
        title: readText(props.Title) || base.title || "",
        intro: readText(props.Introduction) || readText(props.Intro) || base.intro || "",
      };
    }
    return out;
  } catch (err) {
    console.error("[notion] fetchProSectionCopy failed, using fallback:", err.message);
    return FALLBACK_SECTION_COPY;
  }
}
export const fetchProSectionCopy = cache(_fetchProSectionCopy);

// ── Personal Hero bio (single-row DB) ────────────────────────────────────────
// Just the bio paragraph under the name. The DB has Name (title) + Text (rich
// text); first row wins. Eyebrow ("Personal") stays UI-side.
async function _fetchPersonalHero() {
  const fallback = FALLBACK_SECTION_COPY["personal-hero"];
  const dbId = process.env.NOTION_PERSONAL_HERO_DB_ID;
  if (!notion || !dbId) return fallback;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({ data_source_id: dataSourceId, page_size: 1 });
    const row = res.results[0];
    if (!row) return fallback;
    const text = readText(row.properties?.Text);
    return { eyebrow: fallback.eyebrow, intro: text || fallback.intro };
  } catch (err) {
    console.error("[notion] fetchPersonalHero failed, using fallback:", err.message);
    return fallback;
  }
}
export const fetchPersonalHero = cache(_fetchPersonalHero);

// ── Hero: Config (single-row DB) ─────────────────────────────────────────────
// Holds the scalar identity atoms for the pro Hero. Only the first Published
// row is consumed; subsequent rows are ignored so the DB stays single-source.
// Schema: Name (Title), Email (rich text), Resume URL (url),
// Location Label (rich text), Location Coords (rich text), Status.

export async function fetchHeroConfig() {
  const dbId = process.env.NOTION_HERO_CONFIG_DB_ID;
  if (!notion || !dbId) return FALLBACK_HERO_CONFIG;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return FALLBACK_HERO_CONFIG;
    const props = row.properties ?? {};
    return {
      name: readTitle(props.Name) || FALLBACK_HERO_CONFIG.name,
      email: readText(props.Email) || FALLBACK_HERO_CONFIG.email,
      resumeUrl: readUrl(props["Resume URL"]) || FALLBACK_HERO_CONFIG.resumeUrl,
      locationLabel:
        readText(props["Location Label"]) || FALLBACK_HERO_CONFIG.locationLabel,
      locationCoords:
        readText(props["Location Coords"]) || FALLBACK_HERO_CONFIG.locationCoords,
    };
  } catch (err) {
    console.error("[notion] fetchHeroConfig failed, using fallback:", err.message);
    return FALLBACK_HERO_CONFIG;
  }
}

// ── Hero: Role Chips ─────────────────────────────────────────────────────────
// The 3-ish small uppercase pills next to the name. Schema mirrors the Roles
// DB but the two are conceptually separate — these chips are static
// descriptors, not a typewriter rotation.
// Schema: Name (Title), Order (Number), Status.

export async function fetchHeroChips() {
  const dbId = process.env.NOTION_HERO_CHIPS_DB_ID;
  if (!notion || !dbId) return FALLBACK_HERO_CHIPS;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const chips = res.results
      .map((row) => readTitle(row.properties?.Name))
      .filter(Boolean);
    return chips.length > 0 ? chips : FALLBACK_HERO_CHIPS;
  } catch (err) {
    console.error("[notion] fetchHeroChips failed, using fallback:", err.message);
    return FALLBACK_HERO_CHIPS;
  }
}

// ── Hero: Stats ──────────────────────────────────────────────────────────────
// The 3-card stats row (eyebrow + two body lines per card). Returns up to N
// in Order — Hero will render whatever's there, the layout grid is 3-up at
// md+ and 1-up on mobile.
// Schema: Name (Title — eyebrow), Line 1 (rich text), Line 2 (rich text),
// Order (Number), Status.

export async function fetchHeroStats() {
  const dbId = process.env.NOTION_HERO_STATS_DB_ID;
  if (!notion || !dbId) return FALLBACK_HERO_STATS;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const stats = res.results
      .map((row) => {
        const props = row.properties ?? {};
        return {
          label: readTitle(props.Name),
          line1: readText(props["Line 1"]),
          line2: readText(props["Line 2"]),
        };
      })
      .filter((s) => s.label);
    return stats.length > 0 ? stats : FALLBACK_HERO_STATS;
  } catch (err) {
    console.error("[notion] fetchHeroStats failed, using fallback:", err.message);
    return FALLBACK_HERO_STATS;
  }
}

// ── Hero: Ticker Logs ────────────────────────────────────────────────────────
// The cycling `> INITIALIZING_SYSTEM_CORE... [OK]` lines at the bottom of
// the pro Hero. Schema: Name (Title — full log line), Order, Status.

export async function fetchHeroTicker() {
  const dbId = process.env.NOTION_HERO_TICKER_DB_ID;
  if (!notion || !dbId) return FALLBACK_HERO_TICKER;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const logs = res.results
      .map((row) => readTitle(row.properties?.Name))
      .filter(Boolean);
    return logs.length > 0 ? logs : FALLBACK_HERO_TICKER;
  } catch (err) {
    console.error("[notion] fetchHeroTicker failed, using fallback:", err.message);
    return FALLBACK_HERO_TICKER;
  }
}

// ── Live Status Config (inputs to the GPT regen pipeline) ──────────────────
// Single-row DB the cron route reads each tick. Output cache is the
// Hero Live Status DB below (writeback target).
//
// System Prompt lives in the row's PAGE BODY (not a column) — user gets
// the full Notion editor to write it, with headings/lists/formatting.
// blocksToPlainText flattens common block types into a newline-joined
// string the GPT can ingest directly.

function blocksToPlainText(blocks = []) {
  const lines = [];
  for (const b of blocks) {
    const text = (rt) => (rt ?? []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
    switch (b.type) {
      case "paragraph":
      case "heading_1":
      case "heading_2":
      case "heading_3":
      case "quote":
      case "callout":
        lines.push(text(b[b.type].rich_text));
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do":
        lines.push("- " + text(b[b.type].rich_text));
        break;
      case "code":
        lines.push(text(b.code.rich_text));
        break;
      case "divider":
        lines.push("---");
        break;
      // Skip unknown types silently
    }
  }
  return lines.filter((s) => s !== "").join("\n");
}

export async function fetchLiveStatusConfig() {
  const dbId = process.env.NOTION_LIVE_STATUS_CONFIG_DB_ID;
  if (!notion || !dbId) return null;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return null;
    const p = row.properties ?? {};
    // Page body holds the system prompt; pull it via the existing helper.
    const blocks = await fetchBlockChildren(row.id);
    return {
      _pageId: row.id, // cron needs this to uncheck Update + write back
      currentLocation: readText(p["Current Location"]),
      systemPrompt: blocksToPlainText(blocks),
      personalInfo: readText(p["Personal Info"]),
      // Manual override — if filled, cron pushes this text verbatim to the
      // output cache. If empty, cron calls GPT.
      statusLine: readText(p["Status Line"]),
      // Tick to force the cron's next tick to act immediately (regardless
      // of the 4hr cadence). Cron unchecks after processing.
      update: readCheckbox(p.Update),
    };
  } catch (err) {
    console.error("[notion] fetchLiveStatusConfig failed:", err.message);
    return null;
  }
}

// ── Hero: Live Status output cache (shared across both Heroes) ──────────────
// Single Published row consumed. The cron route overwrites its Name
// (generated sentence) and Generated At (timestamp) each regen. Pro Hero
// shows the relative time as "UPDATED Xs AGO"; Personal renders just the
// sentence. Schema: Name (Title), Generated At (Date with time), Status.
//
// Legacy compatibility: if the DB still has multiple rows from the
// pre-cron seed, takes the lowest Order. If the Generated At column
// doesn't exist yet, returns generatedAt=null (renderer treats as fresh).

export async function fetchHeroStatus() {
  const dbId = process.env.NOTION_HERO_STATUS_DB_ID;
  if (!notion || !dbId) return FALLBACK_HERO_STATUS;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return FALLBACK_HERO_STATUS;
    const p = row.properties ?? {};
    const name = readTitle(p.Name);
    const generatedAt = p["Generated At"]?.date?.start ?? null;

    // Schedule holds the day's batch as JSON { tz, date, slots:[{time,text}] }
    // written by the regenerate-status cron. When present, the active slot for
    // "now" (in the batch's timezone) is the text we render; the client hook
    // (useActiveStatus) then rotates through the slots as their times arrive.
    // Falls back to the plain Name string when absent or malformed.
    let schedule = null;
    let tz = null;
    let text = name;
    const rawSchedule = readText(p.Schedule);
    if (rawSchedule) {
      try {
        const parsed = JSON.parse(rawSchedule);
        if (Array.isArray(parsed?.slots) && parsed.slots.length > 0) {
          schedule = parsed.slots;
          tz = parsed.tz || null;
          const active = pickSlot(schedule, tz);
          if (active?.text) text = active.text;
        }
      } catch {
        /* malformed JSON → use Name */
      }
    }

    // Swap the [TIME] token for the live clock (in the batch's tz) so the
    // server-rendered first paint shows a real time, not the literal token.
    // The client hook re-fills it as the clock ticks / slots rotate.
    return {
      text: fillStatus(text || FALLBACK_HERO_STATUS.text, tz),
      generatedAt,
      schedule,
      tz,
    };
  } catch (err) {
    console.error("[notion] fetchHeroStatus failed, using fallback:", err.message);
    return FALLBACK_HERO_STATUS;
  }
}

// ── Travel: locations + stories + story media ────────────────────────────────

// Used to expand the trailing "<City>, XX" state code in a Location.Name
// into the full state name for the story eyebrow. Non-US locations skip
// this and fall back to the Country field.
const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Builds the eyebrow label that sits above each story title.
//   "Eureka Springs, AR" + "USA"  →  "Arkansas"
//   "Dhaka"              + "Bangladesh" → "Bangladesh"
//   "Arlington"          + "USA"  →  "USA"   (no comma; user can add ", TX")
function deriveLocationLabel(city, country) {
  if (city) {
    const parts = city.split(",").map((s) => s.trim());
    if (parts.length === 2 && parts[1].length === 2) {
      const stateName = US_STATES[parts[1].toUpperCase()];
      if (stateName) return stateName;
    }
  }
  return country || "";
}

// Fetch the Regions DB and return a map: regionPageId → flattened region info.
// Used to resolve a Location's "Region Group" relation into the flat fields
// the rest of the app expects (region, regionGroup, regionOrder, regionFlag).
async function fetchRegionsMap() {
  const dbId = process.env.NOTION_REGIONS_DB_ID;
  if (!notion || !dbId) return {};
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const all = [];
    let cursor;
    do {
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
        page_size: 100,
      });
      all.push(...res.results);
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);

    const map = {};
    for (const row of all) {
      const props = row.properties ?? {};
      map[row.id] = {
        region: readSelect(props.Region) ?? "world",
        regionGroup: readSelect(props["Region Group"]) ?? readTitle(props.Name) ?? "Other",
        regionOrder: readNumber(props["Region Order"]) ?? 99,
        regionFlag: readText(props["Region Flag"]) || "🌍",
        photoGradient: readText(props["Photo Gradient"]) || "",
      };
    }
    return map;
  } catch (err) {
    console.error("[notion] fetchRegionsMap failed:", err.message);
    return {};
  }
}

function mapLocationRow(row, regionsMap) {
  const props = row.properties ?? {};
  const lat = readNumber(props.Lat);
  const lng = readNumber(props.Lng);

  // Region Group is now a Relation → Regions DB. Take the first related row.
  const regionRels = readRelationIds(props["Region Group"]);
  const region = regionRels[0] ? regionsMap[regionRels[0]] ?? null : null;

  return {
    _pageId: row.id,
    id: readText(props.Slug),
    city: readTitle(props.Name),
    country: readText(props.Country),
    year: readText(props.Year),
    note: readText(props.Note),
    coords: lat != null && lng != null ? [lng, lat] : [0, 0],
    region: region?.region ?? "world",
    ratio: readSelect(props.Ratio) ?? "square",
    photo: readText(props["Photo Gradient"]) || region?.photoGradient || "",
    photoUrl: readUrl(props["Photo URL"]),
    regionGroup: region?.regionGroup ?? "Other",
    regionOrder: region?.regionOrder ?? 99,
    regionFlag: region?.regionFlag ?? "🌍",
    carousel: readCheckbox(props["Show on Carousel"]),
    // Used by TravelSection to surface the most recently featured locations
    // first on the carousel. Bumps on any row edit, not just the carousel
    // checkbox — toggle Show on Carousel last when you want fine control.
    lastEditedTime: row.last_edited_time ?? null,
  };
}

export async function fetchLocations() {
  const dbId = process.env.NOTION_LOCATIONS_DB_ID;
  if (!notion || !dbId) return FALLBACK_LOCATIONS;

  try {
    const [regionsMap, dataSourceId] = await Promise.all([
      fetchRegionsMap(),
      resolveDataSourceId(dbId),
    ]);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    const locations = res.results
      .map((row) => mapLocationRow(row, regionsMap))
      .filter((l) => l.id);
    return locations.length > 0 ? locations : FALLBACK_LOCATIONS;
  } catch (err) {
    console.error("[notion] fetchLocations failed, using fallback:", err.message);
    return FALLBACK_LOCATIONS;
  }
}

function mapMediaRow(row, storyPageIdToSlug) {
  const props = row.properties ?? {};
  const storyIds = readRelationIds(props.Story);
  const storySlug = storyIds[0] ? storyPageIdToSlug[storyIds[0]] : null;
  const url = readUrl(props.URL);
  const gradient = readText(props.Gradient);
  return {
    _storySlug: storySlug,
    id: row.id,
    type: readSelect(props.Type) ?? "image",
    src: url || gradient || "",
    alt: readTitle(props.Name),
    durationMs: readNumber(props["Duration MS"]) ?? 6000,
    _order: readNumber(props.Order) ?? 999,
  };
}

async function fetchAllStoryMedia(storyPageIdToSlug) {
  const dbId = process.env.NOTION_STORY_MEDIA_DB_ID;
  if (!notion || !dbId) return {};

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const all = [];
    let cursor;
    do {
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        sorts: [{ property: "Order", direction: "ascending" }],
        start_cursor: cursor,
        page_size: 100,
      });
      all.push(...res.results);
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);

    const bySlug = {};
    for (const row of all) {
      const m = mapMediaRow(row, storyPageIdToSlug);
      if (!m._storySlug) continue;
      if (!bySlug[m._storySlug]) bySlug[m._storySlug] = [];
      bySlug[m._storySlug].push(m);
    }
    // Already sorted by Order from the query, but re-sort as safety
    for (const slug in bySlug) {
      bySlug[slug].sort((a, b) => a._order - b._order);
    }
    return bySlug;
  } catch (err) {
    console.error("[notion] fetchAllStoryMedia failed:", err.message);
    return {};
  }
}

async function mapStoryRow(row, locationPageIdToSlug, mediaBySlug) {
  const props = row.properties ?? {};
  const slug = readText(props.Slug);
  const locationIds = readRelationIds(props.Location);
  const locationId = locationIds[0]
    ? locationPageIdToSlug[locationIds[0]] ?? null
    : null;

  const blocks = await fetchBlockChildren(row.id);

  return {
    id: slug,
    locationId,
    title: readTitle(props.Name),
    date: readText(props.Date),
    coverGradient: readText(props["Cover Gradient"]),
    photoUrl: readUrl(props["Photo URL"]),
    media: mediaBySlug[slug] ?? [],
    blocks,
    _order: readNumber(props.Order) ?? 999,
  };
}

/**
 * Fetches all travel data in one pass: locations + stories + media.
 * Returns shapes the existing components expect.
 *
 * Returns:
 *   {
 *     locations: Location[],
 *     storiesBySlug: { [slug]: Story },
 *     locationStories: { [locationId]: slug[] }   // ordered by Story.Order asc
 *   }
 *
 * Falls back to /data/*.js if NOTION_LOCATIONS_DB_ID or NOTION_STORIES_DB_ID
 * is missing, OR if any API call throws.
 */
// Wrapped in React.cache below so per-request callers (landing + slug
// canonical route in the same render) share one Notion roundtrip.
async function _fetchTravelData() {
  const locDbId = process.env.NOTION_LOCATIONS_DB_ID;
  const storyDbId = process.env.NOTION_STORIES_DB_ID;

  if (!notion || !locDbId || !storyDbId) {
    return {
      locations: FALLBACK_LOCATIONS,
      storiesBySlug: FALLBACK_STORIES,
      locationStories: FALLBACK_LOCATION_STORIES,
    };
  }

  try {
    // 1. Regions + Locations in parallel
    const [regionsMap, locDataSourceId] = await Promise.all([
      fetchRegionsMap(),
      resolveDataSourceId(locDbId),
    ]);
    const locRes = await notion.dataSources.query({
      data_source_id: locDataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const locations = locRes.results
      .map((row) => mapLocationRow(row, regionsMap))
      .filter((l) => l.id);
    const locationPageIdToSlug = {};
    for (const loc of locations) locationPageIdToSlug[loc._pageId] = loc.id;

    // 2. Stories (just metadata + page IDs first, so we can fetch media in parallel)
    const storyDataSourceId = await resolveDataSourceId(storyDbId);
    const storyRes = await notion.dataSources.query({
      data_source_id: storyDataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: [{ property: "Order", direction: "ascending" }],
    });

    // Build slug → pageId map for media resolution
    const storyPageIdToSlug = {};
    for (const row of storyRes.results) {
      const slug = readText(row.properties?.Slug);
      if (slug) storyPageIdToSlug[row.id] = slug;
    }

    // 3. All story media in one query, grouped by story slug
    const mediaBySlug = await fetchAllStoryMedia(storyPageIdToSlug);

    // 4. Map each story (parallel — each fetches its own page body blocks)
    const stories = await Promise.all(
      storyRes.results.map((row) =>
        mapStoryRow(row, locationPageIdToSlug, mediaBySlug)
      )
    );

    // Eyebrow label per location: "Arkansas" / "Bangladesh" / "USA".
    // Denormalized onto each story so FieldNotes can render it without
    // an extra lookup or prop-threading from the route boundary.
    const labelBySlug = {};
    for (const loc of locations) {
      labelBySlug[loc.id] = deriveLocationLabel(loc.city, loc.country);
    }

    const storiesBySlug = {};
    const locationStories = {};
    for (const s of stories) {
      if (!s.id) continue;
      s.locationLabel = labelBySlug[s.locationId] || "";
      storiesBySlug[s.id] = s;
      if (s.locationId) {
        if (!locationStories[s.locationId]) locationStories[s.locationId] = [];
        locationStories[s.locationId].push(s.id);
      }
    }

    if (locations.length === 0 || Object.keys(storiesBySlug).length === 0) {
      // Empty Notion result — prefer fallback so the site isn't blank
      return {
        locations: locations.length > 0 ? locations : FALLBACK_LOCATIONS,
        storiesBySlug:
          Object.keys(storiesBySlug).length > 0 ? storiesBySlug : FALLBACK_STORIES,
        locationStories:
          Object.keys(locationStories).length > 0
            ? locationStories
            : FALLBACK_LOCATION_STORIES,
      };
    }

    return { locations, storiesBySlug, locationStories };
  } catch (err) {
    console.error("[notion] fetchTravelData failed, using fallback:", err.message);
    return {
      locations: FALLBACK_LOCATIONS,
      storiesBySlug: FALLBACK_STORIES,
      locationStories: FALLBACK_LOCATION_STORIES,
    };
  }
}
export const fetchTravelData = cache(_fetchTravelData);

// ── Professional: Projects ───────────────────────────────────────────────────
// Two DBs: Projects (one row per project, body = Notion page blocks = the case
// study itself) and Project Media (each row is one media item with a relation
// back to its project). fetchProjects() resolves both, attaching the project's
// ordered media gallery + Notion blocks. Falls back to /data/projects.js
// when either env var is missing or any API call throws.
//
// Schema notes (kept here so the lib stays self-documenting):
//   Projects:       Name (Title), Slug (rich_text), Category (rich_text),
//                   Award (rich_text), Summary (rich_text),
//                   Tech Stack (multi_select), GitHub URL (url),
//                   Demo URL (url), Writeup URL (url), Order (number),
//                   Status (status).  Page body = case study blocks.
//   Project Media:  Name (Title — caption/alt), Type (select: image|youtube|video),
//                   URL (url), File (files), YouTube ID (rich_text),
//                   Project (relation→Projects), Order (number), Status (status).

function mapProjectMediaRow(row) {
  const props = row.properties ?? {};
  const projectIds = readRelationIds(props.Project);
  if (projectIds.length === 0) return null;

  const type = readSelect(props.Type) ?? "image";
  const ytId = readText(props["YouTube ID"]);
  const files = readProxiedFiles(props.File, row.id, "File");
  const url = readUrl(props.URL);
  const src = files[0] || url || null;

  return {
    _projectId: projectIds[0],
    _rowId: row.id,
    _order: readNumber(props.Order) ?? 999,
    type,
    alt: readTitle(props.Name) || "",
    src,
    // Inline-modal renderer reads videoId for youtube embeds; placeholder
    // is used as the [ XXX ] label in card thumbnails + lightbox header.
    videoId: type === "youtube" ? (ytId || null) : null,
    placeholder: readTitle(props.Name) || null,
  };
}

async function fetchAllProjectMedia() {
  const dbId = process.env.NOTION_PROJECT_MEDIA_DB_ID;
  if (!notion || !dbId) return {};

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const all = [];
    let cursor;
    do {
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        filter: PUBLISHED_FILTER,
        sorts: [{ property: "Order", direction: "ascending" }],
        start_cursor: cursor,
        page_size: 100,
      });
      all.push(...res.results);
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);

    const byProject = {};
    for (const row of all) {
      const m = mapProjectMediaRow(row);
      if (!m) continue;
      if (!byProject[m._projectId]) byProject[m._projectId] = [];
      byProject[m._projectId].push(m);
    }
    for (const pid in byProject) {
      byProject[pid].sort((a, b) => a._order - b._order);
    }
    return byProject;
  } catch (err) {
    console.error("[notion] fetchAllProjectMedia failed:", err.message);
    return {};
  }
}

async function mapProjectRow(row, mediaByProject) {
  const props = row.properties ?? {};
  const slug = readText(props.Slug);
  const blocks = await fetchBlockChildren(row.id);

  // Links are 3 fixed URL columns rolled into the same {name,url}[] shape
  // the inline modal expects. Skip empty ones so the link bar stays clean.
  const links = [];
  const github = readUrl(props["GitHub URL"]);
  if (github) links.push({ name: "GitHub", url: github });
  const demo = readUrl(props["Demo URL"]);
  if (demo) links.push({ name: "Demo", url: demo });
  const writeup = readUrl(props["Writeup URL"]);
  if (writeup) links.push({ name: "Writeup", url: writeup });

  const media = mediaByProject[row.id] ?? [];
  const coverRelId = readRelationIds(props.Cover)[0] ?? null;
  const coverMedia = coverRelId ? (media.find((m) => m._rowId === coverRelId) ?? null) : null;

  return {
    _pageId: row.id,
    slug,
    title: readTitle(props.Name),
    category: readText(props.Category),
    award: readText(props.Award) || null,
    summary: readText(props.Summary),
    techStack: readMultiSelect(props["Tech Stack"]),
    links,
    media,
    coverMedia,
    body: blocks,
  };
}

// Wrapped in React.cache below — landing + slug canonical route in the same
// render share one Notion roundtrip.
async function _fetchProjects() {
  const dbId = process.env.NOTION_PROJECTS_DB_ID;
  if (!notion || !dbId) return FALLBACK_PROJECTS;

  try {
    const [mediaByProject, dataSourceId] = await Promise.all([
      fetchAllProjectMedia(),
      resolveDataSourceId(dbId),
    ]);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    const projects = await Promise.all(
      res.results.map((row) => mapProjectRow(row, mediaByProject))
    );
    const valid = projects.filter((p) => p.slug && p.title);
    return valid.length > 0 ? valid : FALLBACK_PROJECTS;
  } catch (err) {
    console.error("[notion] fetchProjects failed, using fallback:", err.message);
    return FALLBACK_PROJECTS;
  }
}
export const fetchProjects = cache(_fetchProjects);

export async function fetchProjectBySlug(slug) {
  // Simple but cache-friendly: fetchProjects is already memoized by Next's
  // request-level dedup + ISR, so this is one shared query per render.
  const dbId = process.env.NOTION_PROJECTS_DB_ID;
  if (!notion || !dbId) return PROJECTS_BY_SLUG[slug] ?? null;

  try {
    const all = await fetchProjects();
    return all.find((p) => p.slug === slug) ?? null;
  } catch (err) {
    console.error("[notion] fetchProjectBySlug failed, using fallback:", err.message);
    return PROJECTS_BY_SLUG[slug] ?? null;
  }
}

// ── Professional: Experiences ────────────────────────────────────────────────
// Single DB. Kind (select: work|extracurricular) splits cards into the two
// sections on the Experiences page. Page body = the expanded story content
// (Notion blocks: paragraph/heading/callout/quote/code/table/list/divider).
//
// Schema:
//   Name         (Title)        — role (e.g. "Research Assistant")
//   Slug         (rich_text)    — URL slug
//   Kind         (select)       — "work" | "extracurricular"
//   Category     (select)       — "RESEARCH" | "PROFESSIONAL" | "LEADERSHIP" …
//   Organization (rich_text)
//   Date         (rich_text)    — free-form, e.g. "May 2026 — Present"
//   Tech Stack   (multi_select)
//   Order        (number)
//   Status       (status)

async function mapExperienceRow(row) {
  const props = row.properties ?? {};
  const blocks = await fetchBlockChildren(row.id);
  // Notion auto-title-cases Select option names on first creation, so
  // "work" gets stored as "Work". Normalize to lowercase here so the
  // component's `e.kind === "work"` filter keeps working regardless of
  // however the user re-types the option in Notion's UI.
  const rawKind = readSelect(props.Kind);
  return {
    slug: readText(props.Slug),
    kind: rawKind ? rawKind.toLowerCase() : "work",
    category: readSelect(props.Category) ?? "",
    role: readTitle(props.Name),
    organization: readText(props.Organization),
    date: readText(props.Date),
    techStack: readMultiSelect(props["Tech Stack"]),
    body: blocks,
  };
}

export async function fetchExperiences() {
  const dbId = process.env.NOTION_EXPERIENCES_DB_ID;
  if (!notion || !dbId) return FALLBACK_EXPERIENCES;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const exps = await Promise.all(res.results.map(mapExperienceRow));
    const valid = exps.filter((e) => e.slug && e.role);
    return valid.length > 0 ? valid : FALLBACK_EXPERIENCES;
  } catch (err) {
    console.error("[notion] fetchExperiences failed, using fallback:", err.message);
    return FALLBACK_EXPERIENCES;
  }
}

export async function fetchExperienceBySlug(slug) {
  const dbId = process.env.NOTION_EXPERIENCES_DB_ID;
  if (!notion || !dbId) return EXPERIENCES_BY_SLUG[slug] ?? null;

  try {
    const all = await fetchExperiences();
    return all.find((e) => e.slug === slug) ?? null;
  } catch (err) {
    console.error("[notion] fetchExperienceBySlug failed, using fallback:", err.message);
    return EXPERIENCES_BY_SLUG[slug] ?? null;
  }
}

// ── Professional: Credentials (4 DBs) ───────────────────────────────────────
// Each sub-section is its own DB so per-row schemas stay clean (no nullable
// type-discriminator). fetchCredentials() composes them via Promise.all and
// returns the bundle shape the component already consumes. Each sub-fetcher
// falls back independently — a missing env var or API error on one section
// won't poison the others.

async function fetchEducation() {
  const dbId = process.env.NOTION_EDUCATION_DB_ID;
  if (!notion || !dbId) return FALLBACK_EDUCATION;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const items = res.results
      .map((row) => {
        const p = row.properties ?? {};
        return {
          degree: readTitle(p.Name),
          institution: readText(p.Institution),
          date: readText(p.Date),
          category: readText(p.Category),
          tags: readMultiSelect(p.Tags),
        };
      })
      .filter((e) => e.degree);
    return items.length > 0 ? items : FALLBACK_EDUCATION;
  } catch (err) {
    console.error("[notion] fetchEducation failed, using fallback:", err.message);
    return FALLBACK_EDUCATION;
  }
}

async function fetchCertifications() {
  const dbId = process.env.NOTION_CERTIFICATIONS_DB_ID;
  if (!notion || !dbId) return FALLBACK_CERTIFICATIONS;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const items = res.results
      .map((row) => {
        const p = row.properties ?? {};
        const url = readUrl(p["Link URL"]);
        const label = readText(p["Link Label"]) || "View Credential";
        // Verification is a Select (VERIFIED/PENDING/EXPIRED…); Notion
        // title-cases on create, upper-case on read to match the canonical
        // form the card badge renders ("STATUS: VERIFIED").
        const rawVerification = readSelect(p.Verification);
        return {
          title: readTitle(p.Name),
          issuer: readText(p.Issuer),
          date: readText(p.Date),
          hash: readText(p.Hash),
          verification: rawVerification ? rawVerification.toUpperCase() : "",
          link: url ? { label, url } : null,
        };
      })
      .filter((c) => c.title);
    return items.length > 0 ? items : FALLBACK_CERTIFICATIONS;
  } catch (err) {
    console.error("[notion] fetchCertifications failed, using fallback:", err.message);
    return FALLBACK_CERTIFICATIONS;
  }
}

async function fetchCoursework() {
  const dbId = process.env.NOTION_COURSEWORK_DB_ID;
  if (!notion || !dbId) return FALLBACK_COURSEWORK;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const items = res.results
      .map((row) => {
        const p = row.properties ?? {};
        // Notion title-cases Select values; the card renders them inside CSS
        // `uppercase` so visual is the same either way. Uppercase the stored
        // value to match the fallback canonical form (BOOTCAMP/ACADEMIC/…).
        const rawCategory = readSelect(p.Category);
        return {
          name: readTitle(p.Name),
          provider: readText(p.Provider),
          category: rawCategory ? rawCategory.toUpperCase() : "",
          link: readUrl(p["Link URL"]),
          // Optional per-row label override. Component falls back to "View"
          // when this is empty.
          linkLabel: readText(p["Link Label"]),
          // Optional "what I learned" copy; component shows a hover-reveal
          // expansion only when this is non-empty.
          insight: readText(p.Insight),
        };
      })
      .filter((c) => c.name);
    return items.length > 0 ? items : FALLBACK_COURSEWORK;
  } catch (err) {
    console.error("[notion] fetchCoursework failed, using fallback:", err.message);
    return FALLBACK_COURSEWORK;
  }
}

const CURIOSITY_DEFAULT_LABELS = {
  YOUTUBE: "Watch Video",
  GITHUB: "View Repo",
  ANALYSIS: "Read Document",
};

async function fetchCuriosity() {
  const dbId = process.env.NOTION_CURIOSITY_DB_ID;
  if (!notion || !dbId) return FALLBACK_CURIOSITY;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const items = res.results
      .map((row) => {
        const p = row.properties ?? {};
        // Upper-case Category to match the fallback canonical form
        // (YOUTUBE/GITHUB/ANALYSIS) — Notion title-cases on create.
        const rawCategory = readSelect(p.Category);
        const category = rawCategory ? rawCategory.toUpperCase() : "";
        const url = readUrl(p["Link URL"]);
        const label =
          readText(p["Link Label"]) ||
          CURIOSITY_DEFAULT_LABELS[category] ||
          "Open Link";
        return {
          title: readTitle(p.Name),
          category,
          insight: readText(p.Insight),
          link: url ? { label, url } : null,
        };
      })
      .filter((c) => c.title);
    return items.length > 0 ? items : FALLBACK_CURIOSITY;
  } catch (err) {
    console.error("[notion] fetchCuriosity failed, using fallback:", err.message);
    return FALLBACK_CURIOSITY;
  }
}

export async function fetchCredentials() {
  const [education, certifications, coursework, curiosity] = await Promise.all([
    fetchEducation(),
    fetchCertifications(),
    fetchCoursework(),
    fetchCuriosity(),
  ]);
  return { education, certifications, coursework, curiosity };
}

// ── Professional: TechStack (Categories + Skills relation) ──────────────────
// Two DBs joined like Travel's Regions+Locations. Component derives angles
// from Side + index-within-Side, so Order on Categories controls top→bottom
// position within its half-circle, Order on Skills controls list ordering
// within the parent category.
//
// Schema:
//   Categories: Name (Title), Side (Select: right|left), Order, Status
//   Skills:     Name (Title), Category (Relation→Categories), Order, Status

export async function fetchTechStack() {
  const catsDbId = process.env.NOTION_TECHSTACK_CATEGORIES_DB_ID;
  const skillsDbId = process.env.NOTION_TECHSTACK_SKILLS_DB_ID;
  if (!notion || !catsDbId || !skillsDbId) return FALLBACK_TECHSTACK;

  try {
    const [catsDsId, skillsDsId] = await Promise.all([
      resolveDataSourceId(catsDbId),
      resolveDataSourceId(skillsDbId),
    ]);
    const [catsRes, skillsRes] = await Promise.all([
      notion.dataSources.query({
        data_source_id: catsDsId,
        filter: PUBLISHED_FILTER,
        sorts: ORDER_SORT,
      }),
      notion.dataSources.query({
        data_source_id: skillsDsId,
        filter: PUBLISHED_FILTER,
        sorts: ORDER_SORT,
      }),
    ]);

    // Build a name + side map keyed by page ID for skill lookup.
    // Side is title-cased by Notion on Select creation; lowercase to match
    // the component's `c.side === "right"` filter.
    const catMeta = {};
    for (const row of catsRes.results) {
      const p = row.properties ?? {};
      const name = readTitle(p.Name);
      if (!name) continue;
      const rawSide = readSelect(p.Side);
      catMeta[row.id] = {
        name,
        side: rawSide ? rawSide.toLowerCase() : "right",
        order: readNumber(p.Order) ?? 999,
        skills: [],
      };
    }

    // Attach skills to their parent category via the relation. Skills
    // already sorted by Order from the query.
    for (const row of skillsRes.results) {
      const p = row.properties ?? {};
      const skillName = readTitle(p.Name);
      if (!skillName) continue;
      const catIds = readRelationIds(p.Category);
      if (catIds.length === 0) continue;
      const cat = catMeta[catIds[0]];
      if (!cat) continue;
      cat.skills.push(skillName);
    }

    const result = Object.values(catMeta).sort((a, b) => a.order - b.order);
    return result.length > 0 ? result : FALLBACK_TECHSTACK;
  } catch (err) {
    console.error("[notion] fetchTechStack failed, using fallback:", err.message);
    return FALLBACK_TECHSTACK;
  }
}

// ── Footers (Pro + Personal configs + shared Socials) ──────────────────────
// Three DBs:
//   Footer Pro:      single Published row consumed
//   Footer Personal: single Published row consumed
//   Footer Socials:  multi-row, ordered by Order asc, shared across sides
//
// Per-side composers (fetchProFooter / fetchPersonalFooter) Promise.all
// the side config + shared socials so each page makes one call.

async function fetchFooterProConfig() {
  const dbId = process.env.NOTION_FOOTER_PRO_DB_ID;
  if (!notion || !dbId) return FALLBACK_FOOTER_PRO;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return FALLBACK_FOOTER_PRO;
    const p = row.properties ?? {};
    const fb = FALLBACK_FOOTER_PRO;
    return {
      avatarLetter: readText(p["Avatar Letter"]) || fb.avatarLetter,
      footerName: readText(p["Footer Name"]) || fb.footerName,
      quote: readText(p.Quote) || fb.quote,
      bottomTagline: readText(p["Bottom Tagline"]) || fb.bottomTagline,
      sideLabel: readText(p["Side Label"]) || fb.sideLabel,
      stampTitle: readText(p["Stamp Title"]) || fb.stampTitle,
      stampSubtitle: readText(p["Stamp Subtitle"]) || fb.stampSubtitle,
      stampCaption: readText(p["Stamp Caption"]) || fb.stampCaption,
      stampUrl: readUrl(p["Stamp URL"]) || fb.stampUrl,
    };
  } catch (err) {
    console.error("[notion] fetchFooterProConfig failed, using fallback:", err.message);
    return FALLBACK_FOOTER_PRO;
  }
}

async function fetchFooterPersonalConfig() {
  const dbId = process.env.NOTION_FOOTER_PERSONAL_DB_ID;
  if (!notion || !dbId) return FALLBACK_FOOTER_PERSONAL;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return FALLBACK_FOOTER_PERSONAL;
    const p = row.properties ?? {};
    const fb = FALLBACK_FOOTER_PERSONAL;
    return {
      avatarLetter: readText(p["Avatar Letter"]) || fb.avatarLetter,
      footerName: readText(p["Footer Name"]) || fb.footerName,
      quote: readText(p.Quote) || fb.quote,
      bottomTagline: readText(p["Bottom Tagline"]) || fb.bottomTagline,
      sideLabel: readText(p["Side Label"]) || fb.sideLabel,
      stampTitle: readText(p["Stamp Title"]) || fb.stampTitle,
      stampSubtitle: readText(p["Stamp Subtitle"]) || fb.stampSubtitle,
      stampCaption: readText(p["Stamp Caption"]) || fb.stampCaption,
      stampUrl: readUrl(p["Stamp URL"]) || fb.stampUrl,
    };
  } catch (err) {
    console.error("[notion] fetchFooterPersonalConfig failed, using fallback:", err.message);
    return FALLBACK_FOOTER_PERSONAL;
  }
}

async function fetchFooterSocials() {
  const dbId = process.env.NOTION_FOOTER_SOCIALS_DB_ID;
  if (!notion || !dbId) return FALLBACK_FOOTER_SOCIALS;
  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    const items = res.results
      .map((row) => {
        const p = row.properties ?? {};
        const rawIcon = readSelect(p.Icon);
        return {
          name: readTitle(p.Name),
          url: readUrl(p.URL),
          icon: rawIcon ? rawIcon.toLowerCase() : "",
        };
      })
      .filter((s) => s.name && s.url);
    return items.length > 0 ? items : FALLBACK_FOOTER_SOCIALS;
  } catch (err) {
    console.error("[notion] fetchFooterSocials failed, using fallback:", err.message);
    return FALLBACK_FOOTER_SOCIALS;
  }
}

export async function fetchProFooter() {
  const [config, socials] = await Promise.all([
    fetchFooterProConfig(),
    fetchFooterSocials(),
  ]);
  return { config, socials };
}

export async function fetchPersonalFooter() {
  const [config, socials] = await Promise.all([
    fetchFooterPersonalConfig(),
    fetchFooterSocials(),
  ]);
  return { config, socials };
}

// ── Copyright page (shared, pro-themed) ─────────────────────────────────────
// Pulls a single Notion page's block tree to render at /copyright. Both
// footers link to the same route; the page itself is always pro-themed
// regardless of which footer triggered it. The Notion page must be shared
// with the Portfolio SIte integration.

export async function fetchCopyrightContent() {
  const pageId = process.env.NOTION_COPYRIGHT_PAGE_ID;
  if (!notion || !pageId) return [];
  try {
    return await fetchBlockChildren(pageId);
  } catch (err) {
    console.error("[notion] fetchCopyrightContent failed:", err.message);
    return [];
  }
}

// ── Music ────────────────────────────────────────────────────────────────────

function mapSongRow(row) {
  const props = row.properties ?? {};
  return {
    id: readText(props.Slug),
    ytId: readText(props["YouTube ID"]) || null,
    title: readTitle(props.Name),
    artist: readText(props.Artist),
    album: readText(props.Album),
    year: readNumber(props.Year),
    genre: readSelect(props.Genre),
    note: readText(props.Note),
    // Annotated form (bold/italic/underline + line breaks) for the liner-notes
    // renderer. Plain `note` above is kept for alt text and string fallbacks.
    noteRich: readRichText(props.Note),
    accent: readText(props["Accent Color"]) || null,
    // Prefer the watcher-supplied Cover URL; fall back to a manually
    // uploaded album cover in the Cover Media files column for songs the
    // watcher couldn't find a good cover for. Uploaded covers go through the
    // image proxy so their expiring signed URL never lands in cached HTML.
    cover:
      readUrl(props["Cover URL"]) ||
      readProxiedFiles(props["Cover Media"], row.id, "Cover Media")[0] ||
      null,
    snippetStart: readNumber(props["Snippet Start"]) ?? 0,
    snippetEnd: readNumber(props["Snippet End"]) ?? null,
  };
}

export async function fetchSongs() {
  const dbId = process.env.NOTION_MUSIC_DB_ID;
  if (!notion || !dbId) return FALLBACK_SONGS;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    const songs = res.results.map(mapSongRow).filter((s) => s.id);
    return songs.length > 0 ? songs : FALLBACK_SONGS;
  } catch (err) {
    console.error("[notion] fetchSongs failed, using fallback:", err.message);
    return FALLBACK_SONGS;
  }
}

// ── Series ───────────────────────────────────────────────────────────────────

function mapShowRow(row) {
  const props = row.properties ?? {};
  const slug = readText(props.Slug);
  const title = readTitle(props.Name);
  return {
    id: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title,
    // "Movie" | "Series" (Select). Tolerates either "Type"/"type" naming;
    // defaults to Series for back-compat with rows predating the column.
    type: readSelect(props.Type ?? props.type) ?? "Series",
    seasons: readNumber(props.Seasons) ?? 0,
    episodes: readNumber(props.Episodes) ?? 0,
    runtime: readText(props.Runtime),
    years: readText(props.Years),
    genres: readMultiSelect(props.Genres),
    verdict: readText(props.Verdict),
    status: readSelect(props["Show Status"]) ?? "COMPLETED",
    hot: readText(props["Hot Take"]),
    bg: readText(props["BG Color"]) || "#1a1208",
    accentColor: readText(props["Accent Color"]) || "#c4a050",
    buttonLabel: readText(props["Button Label"]) || null,
    buttonUrl: readUrl(props["Button URL"]),
    // Square poster shown on the cinema screen. "Poster Media" is a Files &
    // media column; route uploads through the image proxy so the ~1-hour
    // signed-URL expiry doesn't break cached pages. Null → monogram fallback.
    poster: readProxiedFiles(props["Poster Media"], row.id, "Poster Media")[0] ?? null,
  };
}

// ── Desk decor (polaroids + pinned note + index card) ───────────────────────

export async function fetchDesk() {
  const dbId = process.env.NOTION_DESK_DB_ID;
  if (!notion || !dbId) return FALLBACK_DESK;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: [{ property: "Order", direction: "ascending" }],
    });

    const polaroids = [];
    let pinnedNote = null;
    let indexCard = null;
    // Hidden notes: two pages keyed by Order (1=left, 2=right). First entry per
    // side wins so a misordered duplicate doesn't clobber the page.
    const hiddenNotes = { left: null, right: null };

    // Normalize Type so user-facing options can be "Polaroid" / "Pinned Note" /
    // "Index Card" / "Hidden Notes" (Title Case) while we match on a kebab key
    // internally.
    const normType = (s) => (s ?? "").toLowerCase().replace(/[\s_]+/g, "-");

    for (const row of res.results) {
      const props = row.properties ?? {};
      const type = normType(readSelect(props.Type));

      if (type === "polaroid") {
        const src = readUrl(props["Image URL"]);
        if (!src) continue;
        polaroids.push({
          id: row.id,
          src,
          caption: readText(props.Caption),
          alt: readText(props.Alt) || readText(props.Caption),
          _order: readNumber(props.Order) ?? 99,
        });
      } else if (type === "pinned-note" && !pinnedNote) {
        const text = readText(props.Text);
        pinnedNote = {
          lines: text ? text.split("\n").map((s) => s.trimEnd()) : [],
          byline: readText(props.Caption),
        };
      } else if (type === "index-card" && !indexCard) {
        const text = readText(props.Text);
        indexCard = {
          lines: text ? text.split("\n") : [],
        };
      } else if (type === "hidden-notes") {
        const order = readNumber(props.Order);
        const side = order === 2 ? "right" : "left";
        if (hiddenNotes[side]) continue;
        const text = readText(props.Text);
        hiddenNotes[side] = {
          heading: readText(props.Caption),
          lines: text ? text.split("\n") : [],
        };
      }
    }

    // Polaroids: take up to 2 sorted by Order (1=left, 2=right)
    polaroids.sort((a, b) => a._order - b._order);

    // Per-side fallback so editing only one page in Notion doesn't blank the other.
    const composedHiddenNotes = {
      left: hiddenNotes.left?.lines?.length ? hiddenNotes.left : FALLBACK_DESK.hiddenNotes.left,
      right: hiddenNotes.right?.lines?.length ? hiddenNotes.right : FALLBACK_DESK.hiddenNotes.right,
    };

    // Compose final shape, falling back per-field if Notion left it empty
    return {
      polaroids: polaroids.length > 0 ? polaroids.slice(0, 2) : FALLBACK_DESK.polaroids,
      pinnedNote: pinnedNote?.lines?.length ? pinnedNote : FALLBACK_DESK.pinnedNote,
      indexCard: indexCard?.lines?.length ? indexCard : FALLBACK_DESK.indexCard,
      hiddenNotes: composedHiddenNotes,
    };
  } catch (err) {
    console.error("[notion] fetchDesk failed, using fallback:", err.message);
    return FALLBACK_DESK;
  }
}

// ── Writing ──────────────────────────────────────────────────────────────────

async function mapWritingRow(row) {
  const props = row.properties ?? {};
  const blocks = await fetchBlockChildren(row.id);
  // Type was originally specced as a single Select but some rows use
  // multi-select; accept either shape and take the first value.
  const type =
    readSelect(props.Type) ?? readMultiSelect(props.Type)[0] ?? "Personal";
  return {
    id: readText(props.Slug),
    title: readTitle(props.Name),
    type,
    publication: readText(props.Publication),
    date: readText(props.Date),
    excerpt: readText(props.Excerpt),
    featured: readCheckbox(props.Featured),
    position: readNumber(props.Position),
    pages: readNumber(props.Pages) ?? 1,
    tags: readMultiSelect(props.Tags),
    blocks,
    _lastEdited: row.last_edited_time,
    _order: readNumber(props.Order) ?? 999,
  };
}

// Wrapped in React.cache below for landing + slug canonical route dedup.
async function _fetchWriting() {
  const dbId = process.env.NOTION_WRITING_DB_ID;
  if (!notion || !dbId) return withPdfArticles(FALLBACK_PIECES);

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    // Map + fetch body blocks in parallel
    const pieces = await Promise.all(res.results.map(mapWritingRow));

    // Resolve which featured piece owns each of the 5 slots.
    // Tie-breaker: most-recently-edited wins.
    const slotOwner = new Map(); // position(1-5) → piece.id
    const eligible = pieces
      .filter((p) => p.featured && p.position >= 1 && p.position <= 5)
      .sort((a, b) => new Date(b._lastEdited) - new Date(a._lastEdited));
    for (const p of eligible) {
      if (!slotOwner.has(p.position)) slotOwner.set(p.position, p.id);
    }

    // Attach pos/rotation/z to slot-owning pieces; clear for the rest
    const resolved = pieces
      .filter((p) => p.id) // drop rows with no slug
      .map((p) => {
        if (slotOwner.get(p.position) === p.id) {
          const slot = DESK_SLOTS[p.position - 1];
          return { ...p, pos: slot.pos, rotation: slot.rotation, z: slot.z };
        }
        return { ...p, pos: null, rotation: 0, z: 0, featured: false };
      });

    return withPdfArticles(resolved.length > 0 ? resolved : FALLBACK_PIECES);
  } catch (err) {
    console.error("[notion] fetchWriting failed, using fallback:", err.message);
    return withPdfArticles(FALLBACK_PIECES);
  }
}
export const fetchWriting = cache(_fetchWriting);

// Single-piece lookup for the /personal/writing/[slug] route (canonical +
// intercepting). Mirrors fetchProjectBySlug / fetchExperienceBySlug — defers
// to fetchWriting() which is cached at the request level by Next.
export async function fetchWritingBySlug(slug) {
  const dbId = process.env.NOTION_WRITING_DB_ID;
  if (!notion || !dbId)
    return withPdfArticles(FALLBACK_PIECES).find((p) => p.id === slug) ?? null;

  try {
    const all = await fetchWriting();
    return all.find((p) => p.id === slug) ?? null;
  } catch (err) {
    console.error("[notion] fetchWritingBySlug failed, using fallback:", err.message);
    return withPdfArticles(FALLBACK_PIECES).find((p) => p.id === slug) ?? null;
  }
}

export async function fetchShows() {
  const dbId = process.env.NOTION_SERIES_DB_ID;
  if (!notion || !dbId) return FALLBACK_SHOWS;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });

    const shows = res.results.map(mapShowRow).filter((s) => s.title);
    return shows.length > 0 ? shows : FALLBACK_SHOWS;
  } catch (err) {
    console.error("[notion] fetchShows failed, using fallback:", err.message);
    return FALLBACK_SHOWS;
  }
}

// ── Pinboard photos ──────────────────────────────────────────────────────────
// Required Notion columns (database referenced by NOTION_PINBOARD_DB_ID):
//   - Title       (title)            — photo label, e.g. "Ratargul"
//   - Image URL   (URL)              — direct URL to the image
//   - Story       (Rich text)        — modal body copy
//   - Width       (Number)           — natural pixel width of the image
//   - Height      (Number)           — natural pixel height
//   - Display H   (Number, optional) — preferred render height on wall (default 285)
//   - Mount       (Select)           — "pin" | "tape" | "aged" (default "pin")
//   - Pin Color   (Rich text)        — hex color e.g. "#c4a050" (default gold)
//   - Order       (Number)           — placement order (lower placed first)
//   - Status      (Status)           — only "Published" rows are returned

function mapPinboardRow(row) {
  const props = row.properties ?? {};
  const mount = (readSelect(props.Mount) || "pin").toLowerCase();
  const isAged = mount === "aged";
  // Prefer Notion-native Files & media (drag-drop in Notion), fall back to
  // a pasted Image URL. Uploaded files go through the image proxy so their
  // ~1h expiring signed URL never gets baked into cached HTML.
  const files = readProxiedFiles(props.Photo, row.id, "Photo");
  const src = files[0] || readUrl(props["Image URL"]);
  return {
    id: row.id,
    type: "photo",
    label: readTitle(props.Title) || readTitle(props.Name) || "Untitled",
    src,
    w: readNumber(props.Width) || 1200,
    h: readNumber(props.Height) || 800,
    dH: readNumber(props["Display H"]) || 285,
    mount: isAged ? "tape" : mount,
    sub: isAged ? "aged" : undefined,
    pinColor: readText(props["Pin Color"]) || "#c4a050",
    story: readText(props.Story),
    // Optional manual placement — both must be filled to take effect.
    // When set, the section skips the auto-placer and lands the photo
    // at exactly (manualX, manualY). Tilt stays hash-derived.
    manualX: readNumber(props["Wall X"]),
    manualY: readNumber(props["Wall Y"]),
    // wx / wy / wr are filled in client-side by the placement algorithm
    // (or by the manual override above).
  };
}

export async function fetchPinboardPhotos() {
  const dbId = process.env.NOTION_PINBOARD_DB_ID;
  if (!notion || !dbId) return [];

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      sorts: ORDER_SORT,
    });
    return res.results
      .map(mapPinboardRow)
      .filter((p) => p.id && p.src);
  } catch (err) {
    console.error("[notion] fetchPinboardPhotos failed:", err.message);
    return [];
  }
}

// ── Curated Gallery overrides ────────────────────────────────────────────────
// Separate DB (referenced by NOTION_CURATED_DB_ID) whose rows override the
// label / caption / tagline of hardcoded curated items in data/pinboard.js.
// Image, position, mount, pin color, etc. stay in code — this only edits copy.
//
// Required columns:
//   Title    (title)     — display label
//   Key      (rich text) — must match an id in ITEMS (yjhd, znmd, family, ...)
//   Caption  (rich text) — long modal body copy. For the `subway` / `frontier`
//                          paper items this holds the editable prose
//                          (Subway recipe / boarding journal body); italics
//                          render green on the Subway receipt.
//   Note     (rich text, opt) — Subway handwritten note (the `subway` row only)
//   Tagline  (rich text, opt) — italic tagline (poster items only)
//   Wall X   (number, opt) — immersive-wall X override (see below)
//   Wall Y   (number, opt) — immersive-wall Y override
//   Status   (status)    — only "Published" rows are read
//   Order    (number, opt) — sort order in Notion view
//
// Wall X / Wall Y reposition the item in the IMMERSIVE view only (the inline
// front board uses the hardcoded SPOS map). BOTH must be filled and the
// column type must be Number, or the override is ignored.

function mapCuratedRow(row) {
  const props = row.properties ?? {};
  return {
    key:     readText(props.Key) || null,
    label:   readTitle(props.Title) || "",
    caption: readText(props.Caption) || "",
    tagline: readText(props.Tagline) || "",
    // Annotation-preserving copies for paper items (italic → green etc.).
    bodyRich: readRichText(props.Caption),
    noteRich: readRichText(props.Note),
    // Optional position override — both must be set to take effect.
    // When blank, the curated item keeps its hardcoded wx/wy.
    wallX:   readNumber(props["Wall X"]),
    wallY:   readNumber(props["Wall Y"]),
  };
}

// Returns a map of key → { label, caption, tagline } for all Published rows.
// Empty object when env var is missing or fetch fails — safe fallback to
// hardcoded copy in data/pinboard.js.
export async function fetchCuratedOverrides() {
  const dbId = process.env.NOTION_CURATED_DB_ID;
  if (!notion || !dbId) return {};

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    // No sort: results are folded into a key→override map, so order is
    // irrelevant. (Sorting by a non-existent "Order" column would throw
    // and wipe out every override.)
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
    });
    const map = {};
    for (const row of res.results) {
      const r = mapCuratedRow(row);
      if (r.key) map[r.key] = r;
    }
    return map;
  } catch (err) {
    console.error("[notion] fetchCuratedOverrides failed:", err.message);
    return {};
  }
}

// ── Shareable gallery items (photos + posters) ───────────────────────────────
// Flat list used by the /personal/gallery/[slug] routes to resolve a picture
// from its filename-derived slug. Merges curated ITEMS (with Curated-DB copy
// overrides applied — mirrors PinboardSection's wallItems merge) and dynamic
// Notion photos. Only the fields the PhotoModal/PosterModal read; no wall
// placement. cache-wrapped so the canonical route + generateStaticParams share
// one Notion roundtrip per request.
async function _fetchGalleryItems() {
  const [overrides, dynamic] = await Promise.all([
    fetchCuratedOverrides(),
    fetchPinboardPhotos(),
  ]);

  const curated = CURATED_PINBOARD_ITEMS
    .filter((item) => item.type === "photo" || item.type === "poster")
    .map((item) => {
      const o = overrides[item.id];
      return o
        ? {
            ...item,
            label: o.label || item.label,
            story: o.caption || item.story,
            poem: o.tagline || item.poem,
          }
        : item;
    });

  // Attach filename-derived slugs; dedupe (curated wins; warn in dev).
  const bySlug = new Map();
  for (const item of [...curated, ...dynamic]) {
    const slug = gallerySlug(item);
    if (!slug) continue;
    if (bySlug.has(slug)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[gallery] duplicate slug "${slug}" — keeping ${bySlug.get(slug).id}, ignoring ${item.id}`
        );
      }
      continue;
    }
    bySlug.set(slug, { ...item, slug });
  }
  return [...bySlug.values()];
}
export const fetchGalleryItems = cache(_fetchGalleryItems);

// ── Site Metadata ─────────────────────────────────────────────────────────────
// Single-row DB controlling the <title>, meta description, OG description, and
// OG image shown in search results and link previews. Editable in Notion without
// a deploy.
//
// Schema:
//   Site Title      (title)      — HTML <title> value
//   Search Desc     (rich_text)  — meta description (shown under link in search)
//   OpenGraph Desc  (rich_text)  — OG/Twitter description (blank → falls back to Search Desc)
//   OpenGraph Image (files)      — image for OG/Twitter cards (blank → /opengraph-image.png)
//   Status          (status)     — set to Published to activate

const FALLBACK_SITE_METADATA = {
  title: "Ashzaeen Fatmi Khan - Personal Portfolio",
  description:
    "A site with two souls. Check out my tech stack, projects, and experiences, or take a detour through my travel stories, photos, and blogs. Come say hi!",
  ogDescription: null,
  ogImageUrl: null,
};

async function _fetchSiteMetadata() {
  const dbId = process.env.NOTION_SITE_METADATA_DB_ID;
  if (!notion || !dbId) return FALLBACK_SITE_METADATA;

  try {
    const dataSourceId = await resolveDataSourceId(dbId);
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: PUBLISHED_FILTER,
      page_size: 1,
    });
    const row = res.results[0];
    if (!row) return FALLBACK_SITE_METADATA;
    const props = row.properties ?? {};
    const ogImages = readProxiedFiles(props["OpenGraph Image"], row.id, "OpenGraph Image");
    return {
      title: readText(props["Site Title"]) || FALLBACK_SITE_METADATA.title,
      description: readText(props["Search Desc"]) || FALLBACK_SITE_METADATA.description,
      ogDescription: readText(props["OpenGraph Desc"]) || null,
      ogImageUrl: ogImages[0] || null,
    };
  } catch (err) {
    console.error("[notion] fetchSiteMetadata failed, using fallback:", err.message);
    return FALLBACK_SITE_METADATA;
  }
}
export const fetchSiteMetadata = cache(_fetchSiteMetadata);

// Single-picture lookup for the /personal/gallery/[slug] routes.
export async function fetchGalleryBySlug(slug) {
  if (!slug) return null;
  try {
    const items = await fetchGalleryItems();
    return items.find((i) => i.slug === slug) ?? null;
  } catch (err) {
    console.error("[notion] fetchGalleryBySlug failed:", err.message);
    return null;
  }
}
