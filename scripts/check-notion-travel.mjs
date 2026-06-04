// Stress-test probe for the travel CMS pipeline.
// Verifies all 3 DBs reachable, schemas correct, relations resolve,
// and blocks fetch for each story. Reports anomalies as warnings.
//
// Run with: node --env-file=.env.local scripts/check-notion-travel.mjs

import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const locDbId = process.env.NOTION_LOCATIONS_DB_ID;
const storyDbId = process.env.NOTION_STORIES_DB_ID;
const mediaDbId = process.env.NOTION_STORY_MEDIA_DB_ID;

if (!token || !locDbId || !storyDbId || !mediaDbId) {
  console.error("Missing one or more NOTION_* env vars");
  process.exit(1);
}

const notion = new Client({ auth: token });

const warnings = [];
const errors = [];
function warn(msg) { warnings.push(msg); }
function err(msg) { errors.push(msg); }

async function getDataSourceId(dbId, label) {
  try {
    const db = await notion.databases.retrieve({ database_id: dbId });
    const dsId = db.data_sources?.[0]?.id;
    if (!dsId) {
      err(`[${label}] no data source on database`);
      return null;
    }
    return dsId;
  } catch (e) {
    err(`[${label}] retrieve failed: ${e.code} — ${e.message}`);
    return null;
  }
}

async function validateSchemaFromDataSource(dataSourceId, label, required) {
  try {
    const ds = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
    const props = ds.properties ?? {};
    for (const [name, expected] of Object.entries(required)) {
      const actual = props[name]?.type ?? "MISSING";
      if (actual !== expected) {
        err(`[${label}] property "${name}" expected ${expected}, got ${actual}`);
      }
    }
  } catch (e) {
    err(`[${label}] data source schema retrieve failed: ${e.code} — ${e.message}`);
  }
}

async function queryAll(dataSourceId, label, opts = {}) {
  const all = [];
  let cursor;
  try {
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
  } catch (e) {
    err(`[${label}] query failed: ${e.code} — ${e.message}`);
  }
  return all;
}

const readTitle = (p) => p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "";
const readText = (p) => p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
const readNumber = (p) => p?.type === "number" ? p.number : null;
const readSelect = (p) => p?.type === "select" ? p.select?.name ?? null : null;
const readStatus = (p) => p?.type === "status" ? p.status?.name ?? null : null;
const readCheckbox = (p) => p?.type === "checkbox" ? p.checkbox : null;
const readUrl = (p) => p?.type === "url" ? p.url : null;
const readRelationIds = (p) => p?.type === "relation" ? p.relation.map((r) => r.id) : [];

function propType(row, name) {
  return row.properties?.[name]?.type ?? "MISSING";
}

console.log("─── Locations ──────────────────────────────────────");
const locDs = await getDataSourceId(locDbId, "Locations");
const locRows = locDs
  ? await queryAll(locDs, "Locations", { sorts: [{ property: "Order", direction: "ascending" }] })
  : [];
console.log(`Total rows (any status): ${locRows.length}`);

const REQUIRED_LOC_PROPS = {
  Name: "title", Slug: "rich_text", Country: "rich_text", Year: "rich_text",
  Note: "rich_text", Lat: "number", Lng: "number",
  "Region Group": "relation",
  "Photo Gradient": "rich_text", "Photo URL": "url",
  Ratio: "select", "Show on Carousel": "checkbox",
  Status: "status", Order: "number",
};

if (locDs) await validateSchemaFromDataSource(locDs, "Locations", REQUIRED_LOC_PROPS);

// Pre-fetch regions so we can resolve Location.Region Group relations
console.log("\n─── Regions ────────────────────────────────────────");
const regionsDbId = process.env.NOTION_REGIONS_DB_ID;
const regionsMap = {}; // pageId → { region, regionGroup, regionFlag }
if (regionsDbId) {
  const regDs = await getDataSourceId(regionsDbId, "Regions");
  if (regDs) {
    const regRows = await queryAll(regDs, "Regions");
    console.log(`Total rows: ${regRows.length}`);
    for (const r of regRows) {
      const region = readSelect(r.properties?.Region);
      const group = readSelect(r.properties?.["Region Group"]) ?? readTitle(r.properties?.Name);
      const flag = readText(r.properties?.["Region Flag"]);
      regionsMap[r.id] = { region, group, flag };
      console.log(`  ${(region ?? "?").padEnd(6)} ${flag ?? ""}  ${group}`);
    }
  }
} else {
  warn("NOTION_REGIONS_DB_ID not set");
}

const locByPageId = {};
const locBySlug = {};
let publishedLoc = 0;
for (const row of locRows) {
  const slug = readText(row.properties?.Slug);
  const name = readTitle(row.properties?.Name);
  const status = readStatus(row.properties?.Status);
  const lat = readNumber(row.properties?.Lat);
  const lng = readNumber(row.properties?.Lng);
  const regionRels = readRelationIds(row.properties?.["Region Group"]);

  if (!slug) warn(`[Locations] "${name || row.id}" has no Slug`);
  if (!name) warn(`[Locations] row ${row.id} has no Name`);
  if (status !== "Published") continue;
  publishedLoc++;

  if (lat == null) warn(`[Locations:${slug}] missing Lat`);
  if (lng == null) warn(`[Locations:${slug}] missing Lng`);

  if (regionRels.length === 0) {
    warn(`[Locations:${slug}] no "Region Group" relation — will default to world`);
  } else {
    const reg = regionsMap[regionRels[0]];
    if (!reg) {
      warn(`[Locations:${slug}] "Region Group" points to unknown Region page ${regionRels[0]}`);
    } else if (!["world", "us", "bd"].includes(reg.region)) {
      warn(`[Locations:${slug}] resolved region="${reg.region}" — not one of world/us/bd, map zoom may be off`);
    }
  }

  if (slug && locBySlug[slug]) warn(`[Locations] duplicate Slug "${slug}"`);
  locByPageId[row.id] = slug;
  if (slug) locBySlug[slug] = { name, lat, lng, region: regionsMap[regionRels[0]]?.region ?? null };
}
console.log(`\nPublished: ${publishedLoc}`);
console.log("Slugs:", Object.keys(locBySlug).map((s) => `${s}(${locBySlug[s].region ?? "?"})`).join(", "));

console.log("\n─── Stories ───────────────────────────────────────");
const storyDs = await getDataSourceId(storyDbId, "Stories");
const storyRows = storyDs
  ? await queryAll(storyDs, "Stories", { sorts: [{ property: "Order", direction: "ascending" }] })
  : [];
console.log(`Total rows (any status): ${storyRows.length}`);

const REQUIRED_STORY_PROPS = {
  Name: "title", Slug: "rich_text", Location: "relation", Date: "rich_text",
  "Cover Gradient": "rich_text", "Photo URL": "url",
  Order: "number", Status: "status", "Needs Auto-fill": "checkbox",
};
if (storyDs) await validateSchemaFromDataSource(storyDs, "Stories", REQUIRED_STORY_PROPS);

const storyByPageId = {};
const storyBySlug = {};
let publishedStory = 0;
for (const row of storyRows) {
  const slug = readText(row.properties?.Slug);
  const title = readTitle(row.properties?.Name);
  const status = readStatus(row.properties?.Status);
  const locRels = readRelationIds(row.properties?.Location);

  if (!slug) warn(`[Stories] "${title || row.id}" has no Slug`);
  if (!title) warn(`[Stories] row ${row.id} has no Name`);
  if (status !== "Published") continue;
  publishedStory++;

  if (locRels.length === 0) {
    warn(`[Stories:${slug}] no Location relation — won't appear under any pin`);
  } else if (locRels.length > 1) {
    warn(`[Stories:${slug}] multiple Location relations (${locRels.length}); only first will be used`);
  } else {
    const locSlug = locByPageId[locRels[0]];
    if (!locSlug) {
      warn(`[Stories:${slug}] Location relation points to unknown/unpublished page ${locRels[0]}`);
    } else {
      storyBySlug[slug] = { title, locationSlug: locSlug };
    }
  }
  if (slug) storyByPageId[row.id] = slug;
}
console.log(`Published: ${publishedStory}`);
for (const [slug, s] of Object.entries(storyBySlug)) {
  console.log(`  ${slug.padEnd(22)} → ${s.locationSlug.padEnd(14)} "${s.title}"`);
}

console.log("\n─── Story Media ───────────────────────────────────");
const mediaDs = await getDataSourceId(mediaDbId, "Story Media");
const mediaRows = mediaDs
  ? await queryAll(mediaDs, "Story Media", { sorts: [{ property: "Order", direction: "ascending" }] })
  : [];
console.log(`Total rows: ${mediaRows.length}`);

const REQUIRED_MEDIA_PROPS = {
  Name: "title", Story: "relation", Order: "number", Type: "select",
  URL: "url", Gradient: "rich_text", "Duration MS": "number",
};
if (mediaDs) await validateSchemaFromDataSource(mediaDs, "Story Media", REQUIRED_MEDIA_PROPS);

const mediaByStorySlug = {};
for (const row of mediaRows) {
  const alt = readTitle(row.properties?.Name);
  const storyRels = readRelationIds(row.properties?.Story);
  const type = readSelect(row.properties?.Type);
  const url = readUrl(row.properties?.URL);
  const grad = readText(row.properties?.Gradient);

  if (storyRels.length === 0) {
    warn(`[Story Media] "${alt || row.id}" has no Story relation — orphan`);
    continue;
  }
  const storySlug = storyByPageId[storyRels[0]];
  if (!storySlug) {
    warn(`[Story Media:"${alt}"] Story relation points to unknown/unpublished story ${storyRels[0]}`);
    continue;
  }
  if (!type) warn(`[Story Media:"${alt}" → ${storySlug}] missing Type (image/video)`);
  if (!url && !grad) warn(`[Story Media:"${alt}" → ${storySlug}] no URL and no Gradient — will render blank`);
  if (!alt) warn(`[Story Media → ${storySlug}] missing Name (alt text)`);

  (mediaByStorySlug[storySlug] ??= []).push({ alt, type, hasUrl: !!url, hasGradient: !!grad });
}

console.log("\nMedia per story:");
for (const slug of Object.keys(storyBySlug)) {
  const m = mediaByStorySlug[slug] ?? [];
  console.log(`  ${slug.padEnd(22)} ${m.length} item(s)`);
  if (m.length === 0) warn(`[Stories:${slug}] has no media`);
}

console.log("\n─── Block fetch sanity check (first published story) ──");
const firstStory = storyRows.find((r) => readStatus(r.properties?.Status) === "Published");
if (firstStory) {
  const slug = readText(firstStory.properties?.Slug);
  try {
    let cursor, blockCount = 0, types = {};
    do {
      const res = await notion.blocks.children.list({
        block_id: firstStory.id,
        start_cursor: cursor,
        page_size: 100,
      });
      blockCount += res.results.length;
      for (const b of res.results) types[b.type] = (types[b.type] ?? 0) + 1;
      cursor = res.has_more ? res.next_cursor : null;
    } while (cursor);
    console.log(`Story "${slug}" page body: ${blockCount} top-level blocks`);
    console.log(`  block types:`, types);
    if (blockCount === 0) warn(`[Stories:${slug}] page body is empty`);
  } catch (e) {
    err(`[Stories:${slug}] block fetch failed: ${e.code} — ${e.message}`);
  }
}

console.log("\n═══════════════════════════════════════════════════");
if (errors.length === 0 && warnings.length === 0) {
  console.log("✓ All checks passed");
} else {
  if (errors.length) {
    console.log(`\n✗ ${errors.length} ERROR(S):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
  }
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} WARNING(S):`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
}
process.exit(errors.length > 0 ? 1 : 0);
