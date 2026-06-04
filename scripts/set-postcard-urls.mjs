// Backfill `Photo URL` on Notion Locations + Stories DBs using the CDN-hosted
// postcards in /Postcards. Filenames there are slug-based (matching the
// Location.Slug values), so the URL for each row is:
//
//   <CDN_BASE>/<slug>.<ext>
//
// Stories reuse the URL of their parent Location, except for stories whose
// own slug has a matching file in /Postcards (currently just
// washingtondcspring) — those get their own URL.
//
// Run:
//   node --env-file=.env.local scripts/set-postcard-urls.mjs
//
// Idempotent: only writes when the current value differs from the target.

import { Client } from "@notionhq/client";
import fs from "node:fs";
import path from "node:path";

const CDN_BASE = "https://cdn.ashzaeen.com/postcards";
const POSTCARDS_DIR = path.resolve(process.cwd(), "Postcards");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const LOC_DB = process.env.NOTION_LOCATIONS_DB_ID;
const STORY_DB = process.env.NOTION_STORIES_DB_ID;

if (!LOC_DB || !STORY_DB) {
  console.error("Missing NOTION_LOCATIONS_DB_ID or NOTION_STORIES_DB_ID");
  process.exit(1);
}

// slug → "<slug>.<ext>" for whatever file is on disk
const filesBySlug = new Map();
for (const f of fs.readdirSync(POSTCARDS_DIR)) {
  const m = f.match(/^([a-z0-9]+)\.(jpg|jpeg|png|webp)$/i);
  if (!m) continue;
  filesBySlug.set(m[1].toLowerCase(), f);
}
console.log(`Found ${filesBySlug.size} postcard files`);

function urlFor(slug) {
  const file = filesBySlug.get(slug);
  return file ? `${CDN_BASE}/${file}` : null;
}

async function queryAll(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const dsId = db.data_sources?.[0]?.id;
  const all = [];
  let cursor;
  do {
    const r = await notion.dataSources.query({
      data_source_id: dsId,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...r.results);
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);
  return all;
}

const readText = (p) =>
  p?.rich_text?.map((t) => t.plain_text).join("") || "";
const readTitle = (p) =>
  p?.title?.map((t) => t.plain_text).join("") || "";

const locations = await queryAll(LOC_DB);
const stories = await queryAll(STORY_DB);

// pageId → slug for locations (so we can resolve story.Location → slug)
const locSlugByPageId = new Map();
for (const row of locations) {
  const slug = readText(row.properties.Slug);
  if (slug) locSlugByPageId.set(row.id, slug);
}

let updated = 0;
let skipped = 0;
let missing = 0;

async function setPhotoUrl(pageId, label, currentUrl, targetUrl) {
  if (!targetUrl) {
    console.log(`  - ${label}: no matching file, skipped`);
    missing++;
    return;
  }
  if (currentUrl === targetUrl) {
    console.log(`  · ${label}: already set`);
    skipped++;
    return;
  }
  await notion.pages.update({
    page_id: pageId,
    properties: { "Photo URL": { url: targetUrl } },
  });
  console.log(`  ✓ ${label}: ${targetUrl}`);
  updated++;
}

console.log("\nLocations:");
for (const row of locations) {
  const slug = readText(row.properties.Slug);
  const name = readTitle(row.properties.Name);
  if (!slug) continue;
  const current = row.properties["Photo URL"]?.url || "";
  await setPhotoUrl(row.id, `${name} (${slug})`, current, urlFor(slug));
}

console.log("\nStories:");
for (const row of stories) {
  const slug = readText(row.properties.Slug);
  const name = readTitle(row.properties.Name);
  if (!slug) continue;

  // If a postcard exists for the story's own slug, prefer that. Otherwise
  // fall back to the parent location's postcard.
  let target = urlFor(slug);
  if (!target) {
    const locId = row.properties.Location?.relation?.[0]?.id;
    const locSlug = locId ? locSlugByPageId.get(locId) : null;
    target = locSlug ? urlFor(locSlug) : null;
  }
  const current = row.properties["Photo URL"]?.url || "";
  await setPhotoUrl(row.id, `${name} (${slug})`, current, target);
}

console.log(
  `\nDone. updated=${updated}, already-set=${skipped}, no-file=${missing}`
);
