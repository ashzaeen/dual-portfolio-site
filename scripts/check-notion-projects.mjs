// One-shot probe: verifies the Projects + Project Media Notion DBs are
// reachable, shaped right, and report row counts + per-project media tally.
// Run: node --env-file=.env.local scripts/check-notion-projects.mjs
//
// Each DB is probed independently so a missing env var or unshared
// integration on one doesn't blow up the other.

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
const readSelect = (prop) => prop?.select?.name ?? null;
const readMulti = (prop) => prop?.multi_select?.map((s) => s.name) ?? [];
const readRelationIds = (prop) => prop?.relation?.map((r) => r.id) ?? [];

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

// ── Projects (probe first so we can resolve page IDs → titles for Media) ────

const projectsByPageId = {};

await probe("Projects", "NOTION_PROJECTS_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published project(s):`);
  for (const row of rows) {
    const p = row.properties ?? {};
    const title = readTitle(p.Name);
    const slug = readText(p.Slug);
    const category = readText(p.Category);
    const award = readText(p.Award);
    const summary = readText(p.Summary);
    const tech = readMulti(p["Tech Stack"]);
    const order = readNumber(p.Order);
    const github = readUrl(p["GitHub URL"]);
    const demo = readUrl(p["Demo URL"]);
    const writeup = readUrl(p["Writeup URL"]);

    projectsByPageId[row.id] = title;

    console.log(`    ${order ?? "?"}. ${title}  [${slug || "(no slug)"}]`);
    if (category) console.log(`         category: ${category}`);
    if (award) console.log(`         award:    ${award}`);
    if (summary) console.log(`         summary:  "${summary.length > 80 ? summary.slice(0, 77) + "..." : summary}"`);
    if (tech.length) console.log(`         tech:     ${tech.join(", ")}`);
    const linkCount = [github, demo, writeup].filter(Boolean).length;
    console.log(`         links:    ${linkCount} ${linkCount > 0 ? "(" + [github && "GitHub", demo && "Demo", writeup && "Writeup"].filter(Boolean).join(", ") + ")" : ""}`);
  }
  return rows;
});

// ── Project Media (group by project, report per-project counts) ─────────────

await probe("Project Media", "NOTION_PROJECT_MEDIA_DB_ID", async (dsId) => {
  const rows = await queryAll(dsId, { filter: PUBLISHED, sorts: ORDER_SORT });
  console.log(`  ${rows.length} Published media row(s)`);

  const byProject = {};
  let orphans = 0;
  for (const row of rows) {
    const p = row.properties ?? {};
    const projectIds = readRelationIds(p.Project);
    if (projectIds.length === 0) {
      orphans++;
      continue;
    }
    const pid = projectIds[0];
    if (!byProject[pid]) byProject[pid] = [];
    byProject[pid].push({
      name: readTitle(p.Name),
      type: readSelect(p.Type) ?? "image",
      order: readNumber(p.Order) ?? 999,
      hasFile: (p.File?.files?.length ?? 0) > 0,
      hasUrl: !!readUrl(p.URL),
    });
  }

  if (orphans > 0) console.log(`  ⚠ ${orphans} media row(s) have no Project relation — they'll be ignored`);

  for (const pid in byProject) {
    const projectTitle = projectsByPageId[pid] ?? `(unknown project ${pid.slice(0, 8)})`;
    const items = byProject[pid].sort((a, b) => a.order - b.order);
    console.log(`  → ${projectTitle}: ${items.length} item(s)`);
    for (const m of items) {
      const source = m.hasFile ? "File" : m.hasUrl ? "URL" : "(empty)";
      console.log(`      ${m.order}. [${m.type}] ${m.name || "(no name)"}  source: ${source}`);
    }
  }
});

console.log("\n── done ──");
