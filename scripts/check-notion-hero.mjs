// One-shot probe: verifies all 5 pro Hero Notion DBs are reachable + shaped right.
// Run with: node --env-file=.env.local scripts/check-notion-hero.mjs
//
// Reports per-DB so a single missing env var (or unshared DB) doesn't blow
// up the others — useful while incrementally adding Notion-side DBs.
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fatal] Missing NOTION_TOKEN");
  process.exit(1);
}

const notion = new Client({ auth: token });

const PUBLISHED = { property: "Status", status: { equals: "Published" } };
const ORDER_SORT = [{ property: "Order", direction: "ascending" }];

const readTitle = (prop) =>
  prop?.title?.map((t) => t.plain_text).join("").trim() ?? "";
const readText = (prop) =>
  prop?.rich_text?.map((t) => t.plain_text).join("").trim() ?? "";
const readUrl = (prop) => prop?.url ?? null;
const readNumber = (prop) => prop?.number ?? null;

async function resolveDataSource(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source on database ${dbId}`);
  return id;
}

// Each probe runs independently; we await sequentially so the output reads
// top-to-bottom, but each is wrapped in its own try/catch.
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

await probe("Hero Config (single row)", "NOTION_HERO_CONFIG_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    page_size: 1,
  });
  if (!res.results.length) {
    console.log("  [warn] no Published rows — fallback will be used");
    return;
  }
  const props = res.results[0].properties ?? {};
  console.log(`  name:           "${readTitle(props.Name)}"`);
  console.log(`  email:          "${readText(props.Email)}"`);
  console.log(`  resumeUrl:      ${readUrl(props["Resume URL"]) ?? "(empty)"}`);
  console.log(`  locationLabel:  "${readText(props["Location Label"])}"`);
  console.log(`  locationCoords: "${readText(props["Location Coords"])}"`);
});

await probe("Hero Role Chips", "NOTION_HERO_CHIPS_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    sorts: ORDER_SORT,
  });
  console.log(`  ${res.results.length} Published chip(s):`);
  for (const row of res.results) {
    const order = readNumber(row.properties?.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(row.properties?.Name)}`);
  }
});

await probe("Hero Stats", "NOTION_HERO_STATS_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    sorts: ORDER_SORT,
  });
  console.log(`  ${res.results.length} Published stat(s):`);
  for (const row of res.results) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)}`);
    console.log(`         line1: "${readText(p["Line 1"])}"`);
    console.log(`         line2: "${readText(p["Line 2"])}"`);
  }
});

await probe("Hero Ticker Logs", "NOTION_HERO_TICKER_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    sorts: ORDER_SORT,
  });
  console.log(`  ${res.results.length} Published log line(s):`);
  for (const row of res.results) {
    const order = readNumber(row.properties?.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(row.properties?.Name)}`);
  }
});

await probe("Hero Live Status (shared)", "NOTION_HERO_STATUS_DB_ID", async (dsId) => {
  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: PUBLISHED,
    sorts: ORDER_SORT,
  });
  console.log(`  ${res.results.length} Published status sentence(s):`);
  for (const row of res.results) {
    const order = readNumber(row.properties?.Order);
    const text = readTitle(row.properties?.Name);
    const preview = text.length > 80 ? text.slice(0, 77) + "..." : text;
    console.log(`    ${order ?? "?"}. ${preview}`);
  }
});

console.log("\n── done ──");
