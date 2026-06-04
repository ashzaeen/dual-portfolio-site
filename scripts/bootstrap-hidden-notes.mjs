// One-off seeder for the two Hidden Notes rows in the Desk DB.
// Idempotent: skips a side if an existing Type="Hidden Notes" row with that Order already exists.
// Run with: node --env-file=.env.local scripts/bootstrap-hidden-notes.mjs
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_DESK_DB_ID;

if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_DESK_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const readSelect = (p) => (p?.type === "select" ? p.select?.name ?? null : null);
const readNumber = (p) => (p?.type === "number" ? p.number : null);
const normType = (s) => (s ?? "").toLowerCase().replace(/[\s_]+/g, "-");

const ENTRIES = [
  {
    name: "Hidden Notes — Left",
    order: 1,
    caption: "",
    text: [
      "To-do, Tuesday —",
      "· finish radar draft",
      "· read protests piece",
      "· call Ammu",
      "· buy tea",
    ].join("\n"),
  },
  {
    name: "Hidden Notes — Right",
    order: 2,
    caption: "Notes —",
    text: [
      "“the radar is a phenomenologist.”",
      "— remember to put this somewhere",
    ].join("\n"),
  },
];

try {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) {
    console.error("No data source found on database");
    process.exit(1);
  }
  console.log(`Database OK. data_source_id=${dataSourceId}`);

  const existing = await notion.dataSources.query({ data_source_id: dataSourceId });
  const taken = { 1: null, 2: null };
  for (const row of existing.results) {
    const p = row.properties ?? {};
    if (normType(readSelect(p.Type)) !== "hidden-notes") continue;
    const order = readNumber(p.Order);
    if (order === 1 || order === 2) taken[order] = row.id;
  }

  let created = 0;
  let skipped = 0;
  for (const entry of ENTRIES) {
    if (taken[entry.order]) {
      console.log(`  ↷ skip Order ${entry.order} — already exists (${taken[entry.order]})`);
      skipped++;
      continue;
    }
    const props = {
      Name: { title: [{ text: { content: entry.name } }] },
      Type: { select: { name: "Hidden Notes" } },
      Status: { status: { name: "Published" } },
      Order: { number: entry.order },
      Text: { rich_text: [{ text: { content: entry.text } }] },
    };
    if (entry.caption) {
      props.Caption = { rich_text: [{ text: { content: entry.caption } }] };
    }
    const page = await notion.pages.create({
      parent: { data_source_id: dataSourceId },
      properties: props,
    });
    console.log(`  ✓ created ${entry.name} (Order ${entry.order}) → ${page.id.slice(0, 8)}…`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
} catch (err) {
  console.error("\nNotion seed failed:");
  console.error(`  code:    ${err.code}`);
  console.error(`  status:  ${err.status}`);
  console.error(`  message: ${err.message}`);
  if (err.code === "validation_error") {
    console.error(`          (Type select option "Hidden Notes" may need to be added to the DB schema first,`);
    console.error(`           OR the DB schema doesn't allow auto-creating new Select options.)`);
  }
  process.exit(1);
}
