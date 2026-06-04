// Read dimensions of each file in /Postcards and set the `Ratio` select on
// each matching Location row in Notion. Options are `portrait` and `square`
// (Notion title-cases on create — fetcher lowercases on read).
//
//   height / width >= 1.05  → portrait
//   otherwise               → square   (true 1:1, near-1:1 sensor rounding,
//                                       and landscape-leaning shots)
//
// Run:
//   node --env-file=.env.local scripts/set-postcard-ratios.mjs
//
// Idempotent: only writes when the current Ratio differs.

import { Client } from "@notionhq/client";
import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

const POSTCARDS_DIR = path.resolve(process.cwd(), "Postcards");
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const LOC_DB = process.env.NOTION_LOCATIONS_DB_ID;

if (!LOC_DB) {
  console.error("Missing NOTION_LOCATIONS_DB_ID");
  process.exit(1);
}

// slug → { file, width, height, ratio }
const dimsBySlug = new Map();
for (const f of fs.readdirSync(POSTCARDS_DIR)) {
  const m = f.match(/^([a-z0-9]+)\.(jpg|jpeg|png|webp)$/i);
  if (!m) continue;
  const buf = fs.readFileSync(path.join(POSTCARDS_DIR, f));
  const { width, height } = imageSize(buf);
  // 5% tolerance: sensor crops at "1:1" often come out 1-2px taller,
  // which would misclassify as portrait without this guard.
  const ratio = height / width >= 1.05 ? "portrait" : "square";
  dimsBySlug.set(m[1].toLowerCase(), { file: f, width, height, ratio });
}

const db = await notion.databases.retrieve({ database_id: LOC_DB });
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

const readText = (p) =>
  p?.rich_text?.map((t) => t.plain_text).join("") || "";
const readTitle = (p) =>
  p?.title?.map((t) => t.plain_text).join("") || "";

let updated = 0;
let skipped = 0;
let missing = 0;

for (const row of all) {
  const slug = readText(row.properties.Slug);
  const name = readTitle(row.properties.Name);
  if (!slug) continue;

  const dims = dimsBySlug.get(slug);
  if (!dims) {
    console.log(`  - ${name} (${slug}): no matching file, skipped`);
    missing++;
    continue;
  }

  // Notion title-cases select names on create, so check case-insensitively.
  const current = (row.properties.Ratio?.select?.name || "").toLowerCase();
  const target = dims.ratio;
  const dimStr = `${dims.width}×${dims.height}`;

  if (current === target) {
    console.log(`  · ${name} (${slug}): already ${target} (${dimStr})`);
    skipped++;
    continue;
  }

  await notion.pages.update({
    page_id: row.id,
    properties: { Ratio: { select: { name: target } } },
  });
  console.log(`  ✓ ${name} (${slug}): ${current || "(unset)"} → ${target} (${dimStr})`);
  updated++;
}

console.log(`\nDone. updated=${updated}, already-set=${skipped}, no-file=${missing}`);
