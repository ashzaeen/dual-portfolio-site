// One-shot probe: verifies TechStack Categories + Skills DBs are reachable
// + shaped right, reports per-category skill tally.
// Run: node --env-file=.env.local scripts/check-notion-techstack.mjs

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
const readNumber = (p) => p?.number ?? null;
const readSelect = (p) => p?.select?.name ?? null;
const readRelationIds = (p) => p?.relation?.map((r) => r.id) ?? [];

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
    return null;
  }
  try {
    const dataSourceId = await resolveDataSource(dbId);
    console.log(`  data_source_id=${dataSourceId}`);
    return await runner(dataSourceId);
  } catch (err) {
    console.error(`  [error] ${err.code ?? "?"} ${err.status ?? ""} ${err.message}`);
    return null;
  }
}

const catsByPageId = {};

await probe("Categories", "NOTION_TECHSTACK_CATEGORIES_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published category(ies):`);
  let rightN = 0, leftN = 0;
  for (const row of rows) {
    const p = row.properties ?? {};
    const name = readTitle(p.Name);
    const side = readSelect(p.Side) ?? "(unset)";
    const order = readNumber(p.Order);
    catsByPageId[row.id] = name;
    if (side.toLowerCase() === "right") rightN++;
    else if (side.toLowerCase() === "left") leftN++;
    console.log(`    ${order ?? "?"}. [${side}] ${name}`);
  }
  console.log(`  summary: ${rightN} right, ${leftN} left`);
});

await probe("Skills", "NOTION_TECHSTACK_SKILLS_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published skill(s)`);

  const byCat = {};
  let orphans = 0;
  for (const row of rows) {
    const p = row.properties ?? {};
    const skillName = readTitle(p.Name);
    const catIds = readRelationIds(p.Category);
    if (catIds.length === 0) {
      orphans++;
      continue;
    }
    const catId = catIds[0];
    if (!byCat[catId]) byCat[catId] = [];
    byCat[catId].push({ name: skillName, order: readNumber(p.Order) ?? 999 });
  }

  if (orphans > 0) console.log(`  ⚠ ${orphans} skill(s) have no Category relation — they'll be ignored`);

  for (const catId in byCat) {
    const catName = catsByPageId[catId] ?? `(unknown ${catId.slice(0, 8)})`;
    const skills = byCat[catId].sort((a, b) => a.order - b.order);
    console.log(`  → ${catName}: ${skills.length} skill(s)`);
    for (const s of skills) console.log(`      ${s.order}. ${s.name}`);
  }
});

console.log("\n── done ──");
