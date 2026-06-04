// One-shot probe: verifies the Notion Writing DB is reachable and shaped right.
// Run with: node --env-file=.env.local scripts/check-notion-writing.mjs
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_WRITING_DB_ID;

if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_WRITING_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const readTitle = (p) => p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "";
const readText = (p) => p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
const readNumber = (p) => p?.type === "number" ? p.number : null;
const readSelect = (p) => p?.type === "select" ? p.select?.name ?? null : null;
const readCheckbox = (p) => p?.type === "checkbox" ? p.checkbox : false;
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

  console.log(`Got ${res.results.length} published piece(s):`);

  // Surface featured-slot resolution so you can spot conflicts
  const slotMap = new Map();
  const featured = res.results
    .filter((r) => readCheckbox(r.properties?.Featured) && readNumber(r.properties?.Position) >= 1 && readNumber(r.properties?.Position) <= 5)
    .sort((a, b) => new Date(b.last_edited_time) - new Date(a.last_edited_time));
  for (const r of featured) {
    const pos = readNumber(r.properties?.Position);
    if (!slotMap.has(pos)) slotMap.set(pos, readTitle(r.properties?.Name));
  }

  for (const row of res.results) {
    const p = row.properties ?? {};
    const title = readTitle(p.Name);
    const order = readNumber(p.Order);
    const type = readSelect(p.Type);
    const isFeat = readCheckbox(p.Featured);
    const pos = readNumber(p.Position);
    const pages = readNumber(p.Pages);
    const tags = readMulti(p.Tags);
    const claimed = slotMap.get(pos) === title;
    const featTag = isFeat
      ? (claimed ? `featured · slot ${pos}` : `featured · slot ${pos} (LOST tiebreak)`)
      : "archive-only";
    console.log(`  ${order ?? "?"}. ${title} [${type ?? "?"}] · ${pages ?? "?"} pp · ${featTag}`);
    if (tags.length) console.log(`     tags=[${tags.join(", ")}]`);
  }

  console.log(`\nSlot assignments (most-recent-edit wins on clash):`);
  for (let i = 1; i <= 5; i++) {
    console.log(`  ${i}. ${slotMap.get(i) ?? "(empty)"}`);
  }
} catch (err) {
  console.error("Notion query failed:");
  console.error(`  code:    ${err.code}`);
  console.error(`  status:  ${err.status}`);
  console.error(`  message: ${err.message}`);
  process.exit(1);
}
