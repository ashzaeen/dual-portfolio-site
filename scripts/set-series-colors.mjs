// One-shot: set BG Color + Accent Color on the Series DB rows, transferring
// the palettes the user liked from the fallback shows onto their real shows.
//
//   Big Bang Theory          ← Severance      (#0c1a1f / #50b8c8)
//   Game of Thrones          ← Mindhunter     (#180c0a / #c06840)
//   Shark Tank               ← Succession     (#0f1520 / #6a88b8)
//   The Prestige             ← Dark           (#080d15 / #7888d0)
//   Yeh Jawaani Hain Deewani ← Peaky Blinders (#1a1008 / #c4a050)
//   Utshob                   ← Breaking Bad   (#1a2810 / #7ac050)
//
// Run:
//   node --env-file=.env.local scripts/set-series-colors.mjs
//
// Idempotent: only writes a property when its current value differs.

import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_SERIES_DB_ID;
if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_SERIES_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

// Keyed by exact Notion title.
const COLORS = {
  "Big Bang Theory":          { bg: "#0c1a1f", accent: "#50b8c8" }, // Severance
  "Game of Thrones":          { bg: "#180c0a", accent: "#c06840" }, // Mindhunter
  "Shark Tank":               { bg: "#0f1520", accent: "#6a88b8" }, // Succession
  "The Prestige":             { bg: "#080d15", accent: "#7888d0" }, // Dark
  "Yeh Jawaani Hain Deewani": { bg: "#1a1008", accent: "#c4a050" }, // Peaky Blinders
  "Utshob":                   { bg: "#1a2810", accent: "#7ac050" }, // Breaking Bad
};

const readTitle = (p) => p?.title?.map((t) => t.plain_text).join("").trim() || "";
const readText = (p) => p?.rich_text?.map((t) => t.plain_text).join("").trim() || "";
const rt = (v) => ({ rich_text: [{ text: { content: v } }] });

const db = await notion.databases.retrieve({ database_id: dbId });
const dsId = db.data_sources?.[0]?.id;
if (!dsId) {
  console.error("No data source found on database");
  process.exit(1);
}

// Page through every row (status-agnostic so drafts are handled too).
const rows = [];
let cursor;
do {
  const r = await notion.dataSources.query({
    data_source_id: dsId,
    start_cursor: cursor,
    page_size: 100,
  });
  rows.push(...r.results);
  cursor = r.has_more ? r.next_cursor : null;
} while (cursor);

console.log(`Fetched ${rows.length} row(s).\n`);

const seen = new Set();
let updated = 0;
let skipped = 0;

for (const row of rows) {
  const title = readTitle(row.properties?.Name);
  const target = COLORS[title];
  if (!target) continue;
  seen.add(title);

  const curBg = readText(row.properties?.["BG Color"]);
  const curAccent = readText(row.properties?.["Accent Color"]);

  const props = {};
  if (curBg !== target.bg) props["BG Color"] = rt(target.bg);
  if (curAccent !== target.accent) props["Accent Color"] = rt(target.accent);

  if (Object.keys(props).length === 0) {
    console.log(`· ${title}: already set (bg=${curBg}, accent=${curAccent})`);
    skipped++;
    continue;
  }

  await notion.pages.update({ page_id: row.id, properties: props });
  console.log(
    `✓ ${title}: bg ${curBg || "(none)"} → ${target.bg}, accent ${curAccent || "(none)"} → ${target.accent}`
  );
  updated++;
}

// Flag any target name we never matched (typo / row missing / not shared).
const missing = Object.keys(COLORS).filter((t) => !seen.has(t));
if (missing.length) {
  console.log(`\n⚠ No DB row matched: ${missing.join(", ")}`);
}

console.log(`\nDone. updated=${updated}, already-set=${skipped}.`);
