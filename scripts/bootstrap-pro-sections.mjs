// One-off: seed the "Pro Sections" DB (eyebrow/title/intro per professional
// section) and the single-row "Personal Hero" bio DB from data/sections.js.
// Upserts by Name so it's safe to re-run.
//
// Run: node --env-file=.env.local scripts/bootstrap-pro-sections.mjs

import { Client } from "@notionhq/client";
import { FALLBACK_SECTION_COPY } from "../data/sections.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) { console.error("Missing NOTION_TOKEN"); process.exit(1); }

const PRO_DB = process.env.NOTION_PRO_SECTIONS_DB_ID || "3744c240420f809b82fdfe83f4182071";
const HERO_DB = process.env.NOTION_PERSONAL_HERO_DB_ID || "3744c240420f8047a46ee5dd0dac902b";

const notion = new Client({ auth: NOTION_TOKEN });
const rt = (s) => ({ rich_text: [{ text: { content: s || "" } }] });
const readTitle = (pg) => {
  for (const d of Object.values(pg.properties)) {
    if (d.type === "title") return d.title.map((t) => t.plain_text).join("").trim();
  }
  return "";
};

async function dsId(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  return db.data_sources[0].id;
}

// ── Pro Sections ──
const PRO_KEYS = ["projects", "experiences", "experiences-extra", "credentials", "techstack"];
{
  const ds = await dsId(PRO_DB);
  const existing = await notion.dataSources.query({ data_source_id: ds, page_size: 100 });
  const byKey = new Map();
  for (const r of existing.results) { const k = readTitle(r).toLowerCase(); if (k) byKey.set(k, r.id); }

  let created = 0, updated = 0;
  for (const key of PRO_KEYS) {
    const c = FALLBACK_SECTION_COPY[key];
    const props = {
      Name: { title: [{ text: { content: key } }] },
      Eyebrow: rt(c.eyebrow),
      Title: rt(c.title),
      Introduction: rt(c.intro),
      Status: { status: { name: "Published" } },
    };
    const id = byKey.get(key);
    if (id) { await notion.pages.update({ page_id: id, properties: props }); console.log(`  ↻ pro: ${key}`); updated++; }
    else { await notion.pages.create({ parent: { data_source_id: ds }, properties: props }); console.log(`  ✓ pro: ${key}`); created++; }
  }
  console.log(`── pro sections: created ${created}, updated ${updated}`);
}

// ── Personal Hero (single row) ──
{
  const ds = await dsId(HERO_DB);
  const existing = await notion.dataSources.query({ data_source_id: ds, page_size: 1 });
  const bio = FALLBACK_SECTION_COPY["personal-hero"].intro;
  const props = { Name: { title: [{ text: { content: "Personal Hero Bio" } }] }, Text: rt(bio) };
  const row = existing.results[0];
  if (row) { await notion.pages.update({ page_id: row.id, properties: props }); console.log("  ↻ hero bio (updated existing row)"); }
  else { await notion.pages.create({ parent: { data_source_id: ds }, properties: props }); console.log("  ✓ hero bio (created row)"); }
}

console.log("\n── done ──");
