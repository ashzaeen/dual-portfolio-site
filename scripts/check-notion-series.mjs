// One-shot probe: verifies the Notion Series DB is reachable and shaped right.
// Run with: node --env-file=.env.local scripts/check-notion-series.mjs
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_SERIES_DB_ID;

if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_SERIES_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const readTitle = (p) => p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "";
const readText = (p) => p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
const readNumber = (p) => p?.type === "number" ? p.number : null;
const readSelect = (p) => p?.type === "select" ? p.select?.name ?? null : null;
const readMulti = (p) => p?.type === "multi_select" ? p.multi_select.map((s) => s.name) : [];

try {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) {
    console.error("No data source found on database");
    process.exit(1);
  }
  console.log(`Database OK. data_source_id=${dataSourceId}`);

  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: { property: "Status", status: { equals: "Published" } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });

  console.log(`Got ${res.results.length} published show(s):`);
  for (const row of res.results) {
    const p = row.properties ?? {};
    const title = readTitle(p.Name);
    const order = readNumber(p.Order);
    const seasons = readNumber(p.Seasons);
    const episodes = readNumber(p.Episodes);
    const showStatus = readSelect(p["Show Status"]);
    const verdict = readText(p.Verdict);
    const genres = readMulti(p.Genres);
    const bg = readText(p["BG Color"]);
    const accent = readText(p["Accent Color"]);
    console.log(`  ${order ?? "?"}. ${title}`);
    console.log(`     S${seasons ?? "?"} · ${episodes ?? "?"} ep · ${showStatus ?? "?"} · ${verdict || "(no verdict)"}`);
    console.log(`     genres=[${genres.join(", ")}] bg=${bg || "(none)"} accent=${accent || "(none)"}`);
  }
} catch (err) {
  console.error("Notion query failed:");
  console.error(`  code:    ${err.code}`);
  console.error(`  status:  ${err.status}`);
  console.error(`  message: ${err.message}`);
  process.exit(1);
}
