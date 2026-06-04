// One-shot probe: verifies all 4 Credentials Notion DBs are reachable +
// shaped right. Each DB is probed independently so a missing env var or
// unshared integration on one doesn't blow up the others.
//
// Run: node --env-file=.env.local scripts/check-notion-credentials.mjs

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
const readMulti = (p) => p?.multi_select?.map((s) => s.name) ?? [];

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

await probe("Education", "NOTION_EDUCATION_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published row(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)}`);
    console.log(`         institution: ${readText(p.Institution)}`);
    console.log(`         date:        ${readText(p.Date)}`);
    console.log(`         category:    ${readText(p.Category)}`);
    console.log(`         tags:        ${readMulti(p.Tags).join(", ") || "(none)"}`);
  }
});

await probe("Certifications", "NOTION_CERTIFICATIONS_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published row(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)}`);
    console.log(`         issuer:       ${readText(p.Issuer)}`);
    console.log(`         date:         ${readText(p.Date)}`);
    console.log(`         hash:         ${readText(p.Hash) || "(empty)"}`);
    console.log(`         verification: ${readSelect(p.Verification) ?? "(unset)"}`);
    const url = readUrl(p["Link URL"]);
    console.log(`         link:         ${url ? `"${readText(p["Link Label"]) || "View Credential"}" → ${url}` : "(none)"}`);
  }
});

await probe("Coursework", "NOTION_COURSEWORK_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published row(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)}`);
    console.log(`         provider:   ${readText(p.Provider)}`);
    console.log(`         category:   ${readSelect(p.Category) ?? "(unset)"}`);
    const ins = readText(p.Insight);
    console.log(`         insight:    ${ins ? `"${ins.length > 80 ? ins.slice(0, 77) + "..." : ins}"` : "(empty)"}`);
    const url = readUrl(p["Link URL"]);
    console.log(`         link:       ${url ? `"${readText(p["Link Label"]) || "View"}" → ${url}` : "(none)"}`);
  }
});

await probe("Curiosity", "NOTION_CURIOSITY_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published row(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const order = readNumber(p.Order);
    console.log(`    ${order ?? "?"}. ${readTitle(p.Name)}`);
    console.log(`         category: ${readSelect(p.Category) ?? "(unset)"}`);
    const ins = readText(p.Insight);
    console.log(`         insight: "${ins.length > 80 ? ins.slice(0, 77) + "..." : ins}"`);
    const url = readUrl(p["Link URL"]);
    console.log(`         link:    ${url ? `"${readText(p["Link Label"]) || "(default)"}" → ${url}` : "(none)"}`);
  }
});

console.log("\n── done ──");
