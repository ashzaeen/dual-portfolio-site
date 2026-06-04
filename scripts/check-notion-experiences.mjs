// One-shot probe: verifies the Experiences Notion DB is reachable + shaped right.
// Run: node --env-file=.env.local scripts/check-notion-experiences.mjs

import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fatal] Missing NOTION_TOKEN");
  process.exit(1);
}

const dbId = process.env.NOTION_EXPERIENCES_DB_ID;
if (!dbId) {
  console.error("[fatal] Missing NOTION_EXPERIENCES_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const PUBLISHED = { property: "Status", status: { equals: "Published" } };
const ORDER_SORT = [{ property: "Order", direction: "ascending" }];

const readTitle = (prop) =>
  prop?.title?.map((t) => t.plain_text).join("").trim() ?? "";
const readText = (prop) =>
  prop?.rich_text?.map((t) => t.plain_text).join("").trim() ?? "";
const readNumber = (prop) => prop?.number ?? null;
const readSelect = (prop) => prop?.select?.name ?? null;
const readMulti = (prop) => prop?.multi_select?.map((s) => s.name) ?? [];

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

try {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) {
    console.error("[fatal] No data source on database");
    process.exit(1);
  }
  console.log(`── Experiences ──`);
  console.log(`  data_source_id=${dataSourceId}`);

  const rows = await queryAll(dataSourceId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published experience(s):`);

  const byKind = { work: 0, extracurricular: 0, other: 0 };
  for (const row of rows) {
    const p = row.properties ?? {};
    const role = readTitle(p.Name);
    const slug = readText(p.Slug);
    const kind = readSelect(p.Kind);
    const category = readSelect(p.Category);
    const org = readText(p.Organization);
    const date = readText(p.Date);
    const tech = readMulti(p["Tech Stack"]);
    const order = readNumber(p.Order);

    if (kind === "work") byKind.work++;
    else if (kind === "extracurricular") byKind.extracurricular++;
    else byKind.other++;

    console.log(`    ${order ?? "?"}. [${kind ?? "?"}] ${role}  [${slug || "(no slug)"}]`);
    if (category) console.log(`         category: ${category}`);
    if (org) console.log(`         org:      ${org}`);
    if (date) console.log(`         date:     ${date}`);
    if (tech.length) console.log(`         tech:     ${tech.join(", ")}`);
  }

  console.log(`\n  summary: ${byKind.work} work, ${byKind.extracurricular} extracurricular${byKind.other ? `, ${byKind.other} other/unset` : ""}`);
} catch (err) {
  console.error(`[error] ${err.code ?? "?"} ${err.status ?? ""} ${err.message}`);
  process.exit(1);
}

console.log("\n── done ──");
