// One-off: seed the 3 Footer DBs (Pro + Personal + Socials) from
// data/footer.js. Pro and Personal are single-row configs; Socials gets
// 5 fallback rows (DevPost / GitHub / LinkedIn / Instagram / VSCO).
//
// Safe to re-run: skips per-DB when that DB already has rows. Pass --force
// to archive existing rows in ALL 3 DBs before reseeding.
//
// Run: node --env-file=.env.local scripts/bootstrap-footer.mjs
// Force: node --env-file=.env.local scripts/bootstrap-footer.mjs --force

import { Client } from "@notionhq/client";
import {
  FALLBACK_FOOTER_PRO,
  FALLBACK_FOOTER_PERSONAL,
  FALLBACK_FOOTER_SOCIALS,
} from "../data/footer.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("Missing NOTION_TOKEN");
  process.exit(1);
}

const PRO_DB = process.env.NOTION_FOOTER_PRO_DB_ID;
const PERSONAL_DB = process.env.NOTION_FOOTER_PERSONAL_DB_ID;
const SOCIALS_DB = process.env.NOTION_FOOTER_SOCIALS_DB_ID;

const FORCE = process.argv.includes("--force");
if (FORCE) console.log("⚠ --force: existing rows in ALL 3 footer DBs will be archived before seeding\n");

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

async function seed(label, envVar, dbId, items, buildProps) {
  console.log(`\n── ${label} ──`);
  if (!dbId) {
    console.log(`  [skip] ${envVar} not set`);
    return { created: 0, skipped: 0 };
  }
  try {
    const dataSourceId = await dsId(dbId);
    const existing = await queryAll(dataSourceId);
    if (existing.length > 0 && !FORCE) {
      console.log(`  [skip] DB has ${existing.length} row(s) — pass --force to wipe + reseed`);
      return { created: 0, skipped: existing.length };
    }
    if (FORCE && existing.length > 0) {
      console.log(`  archiving ${existing.length} existing row(s)...`);
      for (const row of existing) {
        await notion.pages.update({ page_id: row.id, archived: true });
      }
    }
    let created = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await notion.pages.create({
        parent: { data_source_id: dataSourceId },
        properties: buildProps(item, i),
      });
      console.log(`  ✓ ${i + 1}. ${item.__label ?? "(seeded)"}`);
      created++;
    }
    return { created, skipped: 0 };
  } catch (err) {
    console.error(`  [error] ${err.code ?? "?"} ${err.message}`);
    if (err.code === "validation_error") {
      console.error(`          (check column names match .env.local.example schema)`);
    }
    return { created: 0, skipped: 0 };
  }
}

const pro = await seed(
  "Footer Pro",
  "NOTION_FOOTER_PRO_DB_ID",
  PRO_DB,
  [{ ...FALLBACK_FOOTER_PRO, __label: "Pro Footer" }],
  (c) => ({
    Name: { title: [{ text: { content: "Pro Footer" } }] },
    "Avatar Letter": { rich_text: [{ text: { content: c.avatarLetter || "" } }] },
    "Footer Name": { rich_text: [{ text: { content: c.footerName || "" } }] },
    Quote: { rich_text: [{ text: { content: c.quote || "" } }] },
    "Bottom Tagline": { rich_text: [{ text: { content: c.bottomTagline || "" } }] },
    "Side Label": { rich_text: [{ text: { content: c.sideLabel || "" } }] },
    "Stamp Title": { rich_text: [{ text: { content: c.stampTitle || "" } }] },
    "Stamp Subtitle": { rich_text: [{ text: { content: c.stampSubtitle || "" } }] },
    "Stamp Caption": { rich_text: [{ text: { content: c.stampCaption || "" } }] },
    "Stamp URL": { url: c.stampUrl || null },
    Status: { status: { name: "Published" } },
  })
);

const personal = await seed(
  "Footer Personal",
  "NOTION_FOOTER_PERSONAL_DB_ID",
  PERSONAL_DB,
  [{ ...FALLBACK_FOOTER_PERSONAL, __label: "Personal Footer" }],
  (c) => ({
    Name: { title: [{ text: { content: "Personal Footer" } }] },
    "Avatar Letter": { rich_text: [{ text: { content: c.avatarLetter || "" } }] },
    "Footer Name": { rich_text: [{ text: { content: c.footerName || "" } }] },
    Quote: { rich_text: [{ text: { content: c.quote || "" } }] },
    "Bottom Tagline": { rich_text: [{ text: { content: c.bottomTagline || "" } }] },
    "Side Label": { rich_text: [{ text: { content: c.sideLabel || "" } }] },
    "Stamp Title": { rich_text: [{ text: { content: c.stampTitle || "" } }] },
    "Stamp Subtitle": { rich_text: [{ text: { content: c.stampSubtitle || "" } }] },
    "Stamp Caption": { rich_text: [{ text: { content: c.stampCaption || "" } }] },
    "Stamp URL": { url: c.stampUrl || null },
    Status: { status: { name: "Published" } },
  })
);

const socials = await seed(
  "Footer Socials",
  "NOTION_FOOTER_SOCIALS_DB_ID",
  SOCIALS_DB,
  FALLBACK_FOOTER_SOCIALS.map((s) => ({ ...s, __label: s.name })),
  (s, i) => ({
    Name: { title: [{ text: { content: s.name } }] },
    URL: { url: s.url || null },
    Icon: { select: { name: s.icon } },
    Order: { number: i + 1 },
    Status: { status: { name: "Published" } },
  })
);

const total = pro.created + personal.created + socials.created;
console.log(`\n── done ── created ${total} row(s) across 3 DB(s)`);
console.log("Edit any field in Notion to change what the footers show.");
