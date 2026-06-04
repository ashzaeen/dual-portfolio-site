// One-off: seed all 4 Credentials Notion DBs (Education / Certifications /
// Coursework / Curiosity) from the FALLBACK_* exports in data/credentials.js.
//
// Safe to re-run: skips per-DB when that DB already has rows. Pass --force
// to archive (soft-delete, restorable from Notion trash) all existing rows
// in EVERY credentials DB before reseeding.
//
// Run: node --env-file=.env.local scripts/bootstrap-credentials.mjs
// Force: node --env-file=.env.local scripts/bootstrap-credentials.mjs --force

import { Client } from "@notionhq/client";
import {
  FALLBACK_EDUCATION,
  FALLBACK_CERTIFICATIONS,
  FALLBACK_COURSEWORK,
  FALLBACK_CURIOSITY,
} from "../data/credentials.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("Missing NOTION_TOKEN");
  process.exit(1);
}

const EDU_DB = process.env.NOTION_EDUCATION_DB_ID;
const CERT_DB = process.env.NOTION_CERTIFICATIONS_DB_ID;
const COURSE_DB = process.env.NOTION_COURSEWORK_DB_ID;
const CURIO_DB = process.env.NOTION_CURIOSITY_DB_ID;

const FORCE = process.argv.includes("--force");
if (FORCE) console.log("⚠ --force: existing rows in ALL 4 credentials DBs will be archived before seeding\n");

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
      console.error(`          (check column names match .env.local.example schema; ensure "Published" exists as a Status option)`);
    }
    return { created: 0, skipped: 0 };
  }
}

const edu = await seed(
  "Education",
  "NOTION_EDUCATION_DB_ID",
  EDU_DB,
  FALLBACK_EDUCATION.map((e) => ({ ...e, __label: e.degree })),
  (e, i) => ({
    Name: { title: [{ text: { content: e.degree } }] },
    Institution: { rich_text: [{ text: { content: e.institution || "" } }] },
    Date: { rich_text: [{ text: { content: e.date || "" } }] },
    Category: { rich_text: [{ text: { content: e.category || "" } }] },
    Tags: { multi_select: (e.tags ?? []).map((name) => ({ name })) },
    Order: { number: i + 1 },
    Status: { status: { name: "Published" } },
  })
);

const cert = await seed(
  "Certifications",
  "NOTION_CERTIFICATIONS_DB_ID",
  CERT_DB,
  FALLBACK_CERTIFICATIONS.map((c) => ({ ...c, __label: c.title })),
  (c, i) => {
    const linkUrl = c.link && c.link.url !== "#" ? c.link.url : null;
    const props = {
      Name: { title: [{ text: { content: c.title } }] },
      Issuer: { rich_text: [{ text: { content: c.issuer || "" } }] },
      Date: { rich_text: [{ text: { content: c.date || "" } }] },
      Hash: { rich_text: [{ text: { content: c.hash || "" } }] },
      Verification: { select: { name: c.verification || "VERIFIED" } },
      Order: { number: i + 1 },
      Status: { status: { name: "Published" } },
    };
    if (linkUrl) {
      props["Link URL"] = { url: linkUrl };
      if (c.link?.label) {
        props["Link Label"] = { rich_text: [{ text: { content: c.link.label } }] };
      }
    }
    return props;
  }
);

const course = await seed(
  "Coursework",
  "NOTION_COURSEWORK_DB_ID",
  COURSE_DB,
  FALLBACK_COURSEWORK.map((c) => ({ ...c, __label: c.name })),
  (c, i) => {
    const props = {
      Name: { title: [{ text: { content: c.name } }] },
      Provider: { rich_text: [{ text: { content: c.provider || "" } }] },
      Order: { number: i + 1 },
      Status: { status: { name: "Published" } },
    };
    if (c.category) props.Category = { select: { name: c.category } };
    if (c.link && c.link !== "#") props["Link URL"] = { url: c.link };
    if (c.linkLabel) props["Link Label"] = { rich_text: [{ text: { content: c.linkLabel } }] };
    if (c.insight) props.Insight = { rich_text: [{ text: { content: c.insight } }] };
    return props;
  }
);

const curio = await seed(
  "Curiosity",
  "NOTION_CURIOSITY_DB_ID",
  CURIO_DB,
  FALLBACK_CURIOSITY.map((c) => ({ ...c, __label: c.title })),
  (c, i) => {
    const linkUrl = c.link && c.link.url !== "#" ? c.link.url : null;
    const props = {
      Name: { title: [{ text: { content: c.title } }] },
      Category: { select: { name: c.category } },
      Insight: { rich_text: [{ text: { content: c.insight || "" } }] },
      Order: { number: i + 1 },
      Status: { status: { name: "Published" } },
    };
    if (linkUrl) {
      props["Link URL"] = { url: linkUrl };
      if (c.link?.label) {
        props["Link Label"] = { rich_text: [{ text: { content: c.link.label } }] };
      }
    }
    return props;
  }
);

const total = edu.created + cert.created + course.created + curio.created;
console.log(`\n── done ── created ${total} row(s) across 4 DB(s)`);
console.log("Edit any field in Notion to change what the site shows.");
