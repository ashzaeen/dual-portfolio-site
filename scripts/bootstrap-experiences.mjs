// One-off: seed the Experiences Notion DB from FALLBACK_EXPERIENCES in
// data/experiences.js. Metadata only — page bodies (the expanded story
// content) stay empty for the user to write directly in Notion's editor.
//
// Safe to re-run: skips when DB already has rows. Pass --force to archive
// (soft-delete, restorable from Notion trash) all existing rows before seed.
//
// Run: node --env-file=.env.local scripts/bootstrap-experiences.mjs
// Force: node --env-file=.env.local scripts/bootstrap-experiences.mjs --force

import { Client } from "@notionhq/client";
import { FALLBACK_EXPERIENCES } from "../data/experiences.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const EXPERIENCES_DB = process.env.NOTION_EXPERIENCES_DB_ID;

if (!NOTION_TOKEN || !EXPERIENCES_DB) {
  console.error("Missing NOTION_TOKEN or NOTION_EXPERIENCES_DB_ID");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");
if (FORCE) console.log("⚠ --force: existing rows will be archived before seeding\n");

const notion = new Client({ auth: NOTION_TOKEN });

async function dsId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on ${databaseId}`);
  return id;
}

async function queryAll(dataSourceId) {
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
  return all;
}

const dataSourceId = await dsId(EXPERIENCES_DB);

const existing = await queryAll(dataSourceId);
if (existing.length > 0 && !FORCE) {
  console.log(`[skip] Experiences DB has ${existing.length} row(s) — pass --force to wipe + reseed`);
  process.exit(0);
}
if (FORCE && existing.length > 0) {
  console.log(`  archiving ${existing.length} existing row(s)...`);
  for (const row of existing) {
    await notion.pages.update({ page_id: row.id, archived: true });
  }
  console.log("");
}

let created = 0;
for (let i = 0; i < FALLBACK_EXPERIENCES.length; i++) {
  const exp = FALLBACK_EXPERIENCES[i];
  await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties: {
      Name: { title: [{ text: { content: exp.role } }] },
      Slug: { rich_text: [{ text: { content: exp.slug } }] },
      Kind: { select: { name: exp.kind } },
      Category: { select: { name: exp.category } },
      Organization: { rich_text: [{ text: { content: exp.organization || "" } }] },
      Date: { rich_text: [{ text: { content: exp.date || "" } }] },
      "Tech Stack": { multi_select: (exp.techStack ?? []).map((name) => ({ name })) },
      Order: { number: i + 1 },
      Status: { status: { name: "Published" } },
    },
  });
  console.log(`  ✓ ${i + 1}. [${exp.kind}] ${exp.role}  [${exp.slug}]`);
  created++;
}

console.log(`\n── done ── created ${created} row(s)`);
console.log("Next: open each Notion page and write the expanded story body");
console.log("      using paragraph/heading/callout/quote/code/table/list blocks.");
