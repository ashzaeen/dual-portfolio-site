// One-off: seed the TechStack Categories + Skills DBs from FALLBACK_TECHSTACK.
// Categories are created first so their page IDs can be referenced as the
// `Category` relation on each Skill.
//
// Safe to re-run: skips when Categories DB already has rows. Pass --force
// to archive existing rows in BOTH DBs (Skills first to avoid orphans).
//
// Run: node --env-file=.env.local scripts/bootstrap-techstack.mjs
// Force: node --env-file=.env.local scripts/bootstrap-techstack.mjs --force

import { Client } from "@notionhq/client";
import { FALLBACK_TECHSTACK } from "../data/techstack.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CATS_DB = process.env.NOTION_TECHSTACK_CATEGORIES_DB_ID;
const SKILLS_DB = process.env.NOTION_TECHSTACK_SKILLS_DB_ID;

if (!NOTION_TOKEN || !CATS_DB || !SKILLS_DB) {
  console.error("Missing NOTION_TOKEN, NOTION_TECHSTACK_CATEGORIES_DB_ID, or NOTION_TECHSTACK_SKILLS_DB_ID");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");
if (FORCE) console.log("⚠ --force: existing rows in BOTH DBs will be archived before seeding\n");

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

async function archiveAll(label, dataSourceId) {
  const rows = await queryAll(dataSourceId);
  if (rows.length === 0) return 0;
  console.log(`  archiving ${rows.length} existing ${label} row(s)...`);
  for (const row of rows) {
    await notion.pages.update({ page_id: row.id, archived: true });
  }
  return rows.length;
}

const catsDsId = await dsId(CATS_DB);
const skillsDsId = await dsId(SKILLS_DB);

const existingCats = await queryAll(catsDsId);
if (existingCats.length > 0 && !FORCE) {
  console.log(`[skip] Categories DB has ${existingCats.length} row(s) — pass --force to wipe + reseed`);
  process.exit(0);
}
if (FORCE) {
  await archiveAll("skill", skillsDsId);
  if (existingCats.length > 0) {
    console.log(`  archiving ${existingCats.length} existing category row(s)...`);
    for (const row of existingCats) {
      await notion.pages.update({ page_id: row.id, archived: true });
    }
  }
  console.log("");
}

let catsCreated = 0;
let skillsCreated = 0;

for (let i = 0; i < FALLBACK_TECHSTACK.length; i++) {
  const cat = FALLBACK_TECHSTACK[i];
  const catPage = await notion.pages.create({
    parent: { data_source_id: catsDsId },
    properties: {
      Name: { title: [{ text: { content: cat.name } }] },
      Side: { select: { name: cat.side } },
      Order: { number: i + 1 },
      Status: { status: { name: "Published" } },
    },
  });
  console.log(`── ${i + 1}. [${cat.side}] ${cat.name}  →  page=${catPage.id.slice(0, 8)}…`);
  catsCreated++;

  for (let si = 0; si < (cat.skills ?? []).length; si++) {
    const skill = cat.skills[si];
    await notion.pages.create({
      parent: { data_source_id: skillsDsId },
      properties: {
        Name: { title: [{ text: { content: skill } }] },
        Category: { relation: [{ id: catPage.id }] },
        Order: { number: si + 1 },
        Status: { status: { name: "Published" } },
      },
    });
    console.log(`     ↳ skill ${si + 1}. ${skill}`);
    skillsCreated++;
  }
}

console.log(`\n── done ── ${catsCreated} category(ies), ${skillsCreated} skill(s)`);
console.log("Edit categories/skills in Notion to update the graph.");
