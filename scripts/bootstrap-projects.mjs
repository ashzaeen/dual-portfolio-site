// One-off: seed the Projects + Project Media Notion DBs with the current
// fallback content from data/projects.js. Creates Projects rows with metadata
// only (no page bodies — write case studies directly in Notion's editor),
// then creates Project Media rows linked back to each project via relation.
//
// Safe to re-run: skips when Projects DB already has rows. Pass --force to
// archive (soft-delete, restorable from Notion trash) ALL rows in both DBs
// before seeding.
//
// Run: node --env-file=.env.local scripts/bootstrap-projects.mjs
// Force: node --env-file=.env.local scripts/bootstrap-projects.mjs --force

import { Client } from "@notionhq/client";
import { FALLBACK_PROJECTS } from "../data/projects.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PROJECTS_DB = process.env.NOTION_PROJECTS_DB_ID;
const MEDIA_DB = process.env.NOTION_PROJECT_MEDIA_DB_ID;

if (!NOTION_TOKEN || !PROJECTS_DB) {
  console.error("Missing NOTION_TOKEN or NOTION_PROJECTS_DB_ID");
  process.exit(1);
}
if (!MEDIA_DB) {
  console.log("ℹ NOTION_PROJECT_MEDIA_DB_ID not set — Project Media seeding will be skipped");
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

// Map a link's free-form name to one of the 3 fixed URL columns.
function bucketLink(name) {
  const n = name.toLowerCase();
  if (n.includes("github") || n.includes("repo") || n.includes("code")) return "GitHub URL";
  if (n.includes("demo") || n.includes("live") || n.includes("website") || n.includes("app") || n.includes("site")) return "Demo URL";
  return "Writeup URL"; // catch-all: DevPost, blog, paper, slides, etc.
}

const projectsDsId = await dsId(PROJECTS_DB);
const mediaDsId = MEDIA_DB ? await dsId(MEDIA_DB) : null;

// Idempotency / force handling
const existingProjects = await queryAll(projectsDsId);
if (existingProjects.length > 0 && !FORCE) {
  console.log(`[skip] Projects DB has ${existingProjects.length} row(s) — pass --force to wipe + reseed`);
  process.exit(0);
}
if (FORCE) {
  // Archive media first so we don't briefly leave orphaned media when their parent vanishes.
  if (mediaDsId) await archiveAll("media", mediaDsId);
  if (existingProjects.length > 0) {
    console.log(`  archiving ${existingProjects.length} existing project row(s)...`);
    for (const row of existingProjects) {
      await notion.pages.update({ page_id: row.id, archived: true });
    }
  }
  console.log("");
}

// ── Seed projects + their media ─────────────────────────────────────────────

let projectsCreated = 0;
let mediaCreated = 0;

for (let i = 0; i < FALLBACK_PROJECTS.length; i++) {
  const proj = FALLBACK_PROJECTS[i];
  console.log(`── ${i + 1}. ${proj.title}  [${proj.slug}] ──`);

  // Roll free-form links[] into 3 fixed URL columns. "#" is a placeholder
  // in fallback data — store as null so Notion shows the field as empty.
  const urlCols = {};
  for (const link of proj.links ?? []) {
    const col = bucketLink(link.name);
    const url = link.url === "#" ? null : link.url;
    if (url) urlCols[col] = { url };
  }

  const projectProps = {
    Name: { title: [{ text: { content: proj.title } }] },
    Slug: { rich_text: [{ text: { content: proj.slug } }] },
    Category: { rich_text: [{ text: { content: proj.category || "" } }] },
    Summary: { rich_text: [{ text: { content: proj.summary || "" } }] },
    "Tech Stack": { multi_select: (proj.techStack ?? []).map((name) => ({ name })) },
    Order: { number: i + 1 },
    Status: { status: { name: "Published" } },
    ...urlCols,
  };
  if (proj.award) {
    projectProps.Award = { rich_text: [{ text: { content: proj.award } }] };
  }

  const projectPage = await notion.pages.create({
    parent: { data_source_id: projectsDsId },
    properties: projectProps,
  });
  console.log(`  ✓ project created  →  page=${projectPage.id.slice(0, 8)}…`);
  projectsCreated++;

  // Media rows
  if (!mediaDsId) continue;
  for (let mi = 0; mi < (proj.media ?? []).length; mi++) {
    const m = proj.media[mi];
    const mediaName = m.alt || m.placeholder || `Media ${mi + 1}`;

    const mediaProps = {
      Name: { title: [{ text: { content: mediaName } }] },
      Type: { select: { name: m.type || "image" } },
      Project: { relation: [{ id: projectPage.id }] },
      Order: { number: mi + 1 },
      Status: { status: { name: "Published" } },
    };
    if (m.type === "youtube" && m.videoId) {
      mediaProps.URL = { url: `https://www.youtube.com/watch?v=${m.videoId}` };
      mediaProps["YouTube ID"] = { rich_text: [{ text: { content: m.videoId } }] };
    } else if (m.src) {
      mediaProps.URL = { url: m.src };
    }
    // Image placeholders with no real URL: leave URL/File empty — user uploads later.

    await notion.pages.create({
      parent: { data_source_id: mediaDsId },
      properties: mediaProps,
    });
    console.log(`     ↳ media ${mi + 1}. [${m.type || "image"}] ${mediaName}`);
    mediaCreated++;
  }
}

console.log(`\n── done ── ${projectsCreated} project(s), ${mediaCreated} media row(s)`);
console.log("Next: open each project page in Notion and write the case study body.");
console.log("      Drop real image files into the Project Media rows' File column,");
console.log("      or paste image URLs into the URL column for placeholder rows.");
