// One-off: seed the "Sections" DB from data/sections.js (FALLBACK_SECTION_COPY).
// Upserts by Name (the section key) so it fills an existing row instead of
// duplicating, and is safe to re-run. Status is set to Published.
//
// Columns written: Name (title), Eyebrow, Title, Introduction, Instruction,
// Mobile Instruction (rich text), Status.
//
// Run: node --env-file=.env.local scripts/bootstrap-sections.mjs

import { Client } from "@notionhq/client";
import { FALLBACK_SECTION_COPY } from "../data/sections.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) { console.error("Missing NOTION_TOKEN"); process.exit(1); }

const DB_ID = process.env.NOTION_SECTIONS_DB_ID || "3744c240420f80859c5ec6724b46354b";

const notion = new Client({ auth: NOTION_TOKEN });

const rt = (s) => ({ rich_text: [{ text: { content: s || "" } }] });

function buildProps(key, c) {
  return {
    Name: { title: [{ text: { content: key } }] },
    Eyebrow: rt(c.eyebrow),
    Title: rt(c.title),
    Introduction: rt(c.intro),
    Instruction: rt(c.instruction),
    "Mobile Instruction": rt(c.instructionMobile),
    Status: { status: { name: "Published" } },
  };
}

const readTitle = (page) => {
  for (const def of Object.values(page.properties)) {
    if (def.type === "title") return def.title.map((t) => t.plain_text).join("").trim();
  }
  return "";
};

try {
  const db = await notion.databases.retrieve({ database_id: DB_ID });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) throw new Error("No data source on DB");

  // Map existing rows by lowercased Name so we upsert instead of duplicate.
  const existing = await notion.dataSources.query({ data_source_id: dsId, page_size: 100 });
  const byKey = new Map();
  for (const row of existing.results) {
    const k = readTitle(row).toLowerCase();
    if (k) byKey.set(k, row.id);
  }

  let created = 0, updated = 0;
  for (const [key, copy] of Object.entries(FALLBACK_SECTION_COPY)) {
    const props = buildProps(key, copy);
    const pageId = byKey.get(key);
    if (pageId) {
      await notion.pages.update({ page_id: pageId, properties: props });
      console.log(`  ↻ updated  ${key}`);
      updated++;
    } else {
      await notion.pages.create({ parent: { data_source_id: dsId }, properties: props });
      console.log(`  ✓ created  ${key}`);
      created++;
    }
  }

  // Report any leftover rows whose Name isn't one of our keys.
  const keys = new Set(Object.keys(FALLBACK_SECTION_COPY));
  const orphans = existing.results.filter((r) => {
    const k = readTitle(r).toLowerCase();
    return !k || !keys.has(k);
  });
  if (orphans.length) {
    console.log(`\n  note: ${orphans.length} existing row(s) don't match a section key:`);
    for (const r of orphans) console.log(`        - "${readTitle(r) || "(empty Name)"}" (${r.id})`);
    console.log("        leave them, rename their Name to a key, or delete them in Notion.");
  }

  console.log(`\n── done ── created ${created}, updated ${updated}`);
} catch (err) {
  console.error(`[error] ${err.code ?? "?"} ${err.message}`);
  process.exit(1);
}
