// One-off: seed the 4 pro-Hero Notion DBs (Config / Chips / Stats / Ticker)
// with the current fallback content from data/hero.js — each row created as
// Published so the site picks them up immediately on the next revalidate.
//
// Safe to re-run: skips any DB that already has rows (idempotent), so once
// you've started editing the content in Notion this script becomes a no-op.
//
// Pass --force to archive (soft-delete) existing rows in each DB before
// seeding. Useful when DBs have placeholder rows from initial schema setup.
// Archived rows can be restored from Notion's trash if you change your mind.
//
// Run: node --env-file=.env.local scripts/bootstrap-hero.mjs
// Force-reseed: node --env-file=.env.local scripts/bootstrap-hero.mjs --force
//
// Requires:
//   - NOTION_TOKEN
//   - Each Hero DB env var (script skips and continues if any is missing)
//   - Each DB shared with the "Portfolio SIte" integration
//   - "Published" must exist as an option on each DB's Status column

import { Client } from "@notionhq/client";
import {
  FALLBACK_HERO_CONFIG,
  FALLBACK_HERO_CHIPS,
  FALLBACK_HERO_STATS,
  FALLBACK_HERO_TICKER,
} from "../data/hero.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("Missing NOTION_TOKEN");
  process.exit(1);
}

const CONFIG_DB = process.env.NOTION_HERO_CONFIG_DB_ID;
const CHIPS_DB = process.env.NOTION_HERO_CHIPS_DB_ID;
const STATS_DB = process.env.NOTION_HERO_STATS_DB_ID;
const TICKER_DB = process.env.NOTION_HERO_TICKER_DB_ID;

const FORCE = process.argv.includes("--force");
if (FORCE) console.log("⚠ --force mode: existing rows will be archived (soft-deleted) before seeding\n");

const notion = new Client({ auth: NOTION_TOKEN });

async function dsId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on ${databaseId}`);
  return id;
}

// Seed wrapper: each DB is independent so a failure on one (missing column,
// unshared integration, etc.) doesn't block the others. Returns counts.
async function seed(label, envVar, dbId, run) {
  console.log(`\n── ${label} ──`);
  if (!dbId) {
    console.log(`  [skip] ${envVar} not set`);
    return { created: 0, skipped: 0 };
  }
  try {
    const ds = await dsId(dbId);
    const existing = await notion.dataSources.query({
      data_source_id: ds,
      page_size: 100,
    });
    if (existing.results.length > 0) {
      if (!FORCE) {
        console.log(`  [skip] DB already has ${existing.results.length} row(s) — bootstrap is one-off (pass --force to wipe + reseed)`);
        return { created: 0, skipped: existing.results.length };
      }
      // Archive existing rows (Notion soft delete — restorable from trash).
      console.log(`  archiving ${existing.results.length} existing row(s)...`);
      for (const row of existing.results) {
        await notion.pages.update({ page_id: row.id, archived: true });
      }
    }
    return await run(ds);
  } catch (err) {
    console.error(`  [error] ${err.code ?? "?"} ${err.message}`);
    if (err.code === "validation_error") {
      console.error(
        `          (check the Status column has a "Published" option,\n` +
        `           and all column names match the schema in .env.local.example)`
      );
    }
    return { created: 0, skipped: 0 };
  }
}

// ── 1. Hero Config (single row) ─────────────────────────────────────────────

const configResult = await seed(
  "Hero Config",
  "NOTION_HERO_CONFIG_DB_ID",
  CONFIG_DB,
  async (ds) => {
    const c = FALLBACK_HERO_CONFIG;
    await notion.pages.create({
      parent: { data_source_id: ds },
      properties: {
        Name: { title: [{ text: { content: c.name } }] },
        Email: { rich_text: [{ text: { content: c.email } }] },
        "Resume URL": { url: c.resumeUrl === "#" ? null : c.resumeUrl },
        "Location Label": { rich_text: [{ text: { content: c.locationLabel } }] },
        "Location Coords": { rich_text: [{ text: { content: c.locationCoords } }] },
        Status: { status: { name: "Published" } },
      },
    });
    console.log(`  ✓ created config row: "${c.name}"`);
    return { created: 1, skipped: 0 };
  }
);

// ── 2. Hero Role Chips ──────────────────────────────────────────────────────

const chipsResult = await seed(
  "Hero Role Chips",
  "NOTION_HERO_CHIPS_DB_ID",
  CHIPS_DB,
  async (ds) => {
    let created = 0;
    for (let i = 0; i < FALLBACK_HERO_CHIPS.length; i++) {
      const chip = FALLBACK_HERO_CHIPS[i];
      await notion.pages.create({
        parent: { data_source_id: ds },
        properties: {
          Name: { title: [{ text: { content: chip } }] },
          Order: { number: i + 1 },
          Status: { status: { name: "Published" } },
        },
      });
      console.log(`  ✓ ${i + 1}. ${chip}`);
      created++;
    }
    return { created, skipped: 0 };
  }
);

// ── 3. Hero Stats ───────────────────────────────────────────────────────────

const statsResult = await seed(
  "Hero Stats",
  "NOTION_HERO_STATS_DB_ID",
  STATS_DB,
  async (ds) => {
    let created = 0;
    for (let i = 0; i < FALLBACK_HERO_STATS.length; i++) {
      const stat = FALLBACK_HERO_STATS[i];
      await notion.pages.create({
        parent: { data_source_id: ds },
        properties: {
          Name: { title: [{ text: { content: stat.label } }] },
          "Line 1": { rich_text: [{ text: { content: stat.line1 } }] },
          "Line 2": { rich_text: [{ text: { content: stat.line2 } }] },
          Order: { number: i + 1 },
          Status: { status: { name: "Published" } },
        },
      });
      console.log(`  ✓ ${i + 1}. ${stat.label}  →  "${stat.line1}" / "${stat.line2}"`);
      created++;
    }
    return { created, skipped: 0 };
  }
);

// ── 4. Hero Ticker Logs ─────────────────────────────────────────────────────

const tickerResult = await seed(
  "Hero Ticker Logs",
  "NOTION_HERO_TICKER_DB_ID",
  TICKER_DB,
  async (ds) => {
    let created = 0;
    for (let i = 0; i < FALLBACK_HERO_TICKER.length; i++) {
      const line = FALLBACK_HERO_TICKER[i];
      await notion.pages.create({
        parent: { data_source_id: ds },
        properties: {
          Name: { title: [{ text: { content: line } }] },
          Order: { number: i + 1 },
          Status: { status: { name: "Published" } },
        },
      });
      console.log(`  ✓ ${i + 1}. ${line}`);
      created++;
    }
    return { created, skipped: 0 };
  }
);

// ── Summary ─────────────────────────────────────────────────────────────────

const total = configResult.created + chipsResult.created + statsResult.created + tickerResult.created;
console.log(`\n── done ── created ${total} row(s) across 4 DB(s).`);
console.log(`Edit any field in Notion to change what the site shows.`);
console.log(`Re-running this script is safe — it skips DBs that already have rows.`);
