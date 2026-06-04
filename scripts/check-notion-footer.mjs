// One-shot probe: verifies the 3 Footer DBs (Pro + Personal + Socials) are
// reachable + shaped right. Each is probed independently.
// Run: node --env-file=.env.local scripts/check-notion-footer.mjs

import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fatal] Missing NOTION_TOKEN");
  process.exit(1);
}

const notion = new Client({ auth: token });

const PUBLISHED = { property: "Status", status: { equals: "Published" } };
const ORDER_SORT = [{ property: "Order", direction: "ascending" }];

const readTitle = (p) =>
  p?.title?.map((t) => t.plain_text).join("").trim() ?? "";
const readText = (p) =>
  p?.rich_text?.map((t) => t.plain_text).join("").trim() ?? "";
const readUrl = (p) => p?.url ?? null;
const readNumber = (p) => p?.number ?? null;
const readSelect = (p) => p?.select?.name ?? null;

async function resolveDataSource(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on database ${dbId}`);
  return id;
}

async function queryAll(dataSourceId, opts = {}) {
  const all = [];
  let cursor;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      ...opts,
      start_cursor: cursor,
      page_size: 100,
    });
    all.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return all;
}

async function probe(name, envVar, runner) {
  const dbId = process.env[envVar];
  console.log(`\n── ${name} ──`);
  if (!dbId) {
    console.log(`  [skip] ${envVar} not set`);
    return;
  }
  try {
    const dataSourceId = await resolveDataSource(dbId);
    console.log(`  data_source_id=${dataSourceId}`);
    await runner(dataSourceId);
  } catch (err) {
    console.error(`  [error] ${err.code ?? "?"} ${err.status ?? ""} ${err.message}`);
  }
}

await probe("Footer Pro (single row)", "NOTION_FOOTER_PRO_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    page_size: 1,
  });
  if (!res.results.length) {
    console.log("  [warn] no Published rows — fallback will be used");
    return;
  }
  const p = res.results[0].properties ?? {};
  console.log(`  name:           "${readTitle(p.Name)}"`);
  console.log(`  avatarLetter:   "${readText(p["Avatar Letter"])}"`);
  console.log(`  footerName:     "${readText(p["Footer Name"])}"`);
  console.log(`  quote:          "${readText(p.Quote)}"`);
  console.log(`  bottomTagline:  "${readText(p["Bottom Tagline"])}"`);
  console.log(`  sideLabel:      "${readText(p["Side Label"])}"`);
  console.log(`  stampTitle:     "${readText(p["Stamp Title"])}"`);
  console.log(`  stampSubtitle:  "${readText(p["Stamp Subtitle"])}"`);
  console.log(`  stampCaption:   "${readText(p["Stamp Caption"])}"`);
  console.log(`  stampUrl:       ${readUrl(p["Stamp URL"]) ?? "(none)"}`);
});

await probe("Footer Personal (single row)", "NOTION_FOOTER_PERSONAL_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    page_size: 1,
  });
  if (!res.results.length) {
    console.log("  [warn] no Published rows — fallback will be used");
    return;
  }
  const p = res.results[0].properties ?? {};
  console.log(`  name:           "${readTitle(p.Name)}"`);
  console.log(`  avatarLetter:   "${readText(p["Avatar Letter"])}"`);
  console.log(`  footerName:     "${readText(p["Footer Name"])}"`);
  console.log(`  quote:          "${readText(p.Quote)}"`);
  console.log(`  bottomTagline:  "${readText(p["Bottom Tagline"])}"`);
  console.log(`  sideLabel:      "${readText(p["Side Label"])}"`);
  console.log(`  stampTitle:     "${readText(p["Stamp Title"])}"`);
  console.log(`  stampSubtitle:  "${readText(p["Stamp Subtitle"])}"`);
  console.log(`  stampCaption:   "${readText(p["Stamp Caption"])}"`);
  console.log(`  stampUrl:       ${readUrl(p["Stamp URL"]) ?? "(none)"}`);
});

await probe("Footer Socials (shared)", "NOTION_FOOTER_SOCIALS_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published social(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    const icon = readSelect(p.Icon);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)} [${icon ?? "?"}]  →  ${readUrl(p.URL) ?? "(no URL)"}`);
  }
});

console.log("\n── done ──");
