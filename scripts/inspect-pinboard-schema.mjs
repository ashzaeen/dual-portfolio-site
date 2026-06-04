// Inspect the Pinboard DB: prints column names + types, verifies the
// columns the autofill script needs, and shows what the first row
// currently looks like.
// Run: node --env-file=.env.local scripts/inspect-pinboard-schema.mjs

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dbId = process.env.NOTION_PINBOARD_DB_ID;

if (!dbId) {
  console.error("✗ NOTION_PINBOARD_DB_ID not set in .env.local");
  process.exit(1);
}

const db = await notion.databases.retrieve({ database_id: dbId });
const dsId = db.data_sources?.[0]?.id;
if (!dsId) {
  console.error("✗ No data source found on this database");
  process.exit(1);
}
const ds = await notion.dataSources.retrieve({ data_source_id: dsId });

console.log(`\n📋 Pinboard DB: ${db.title?.[0]?.plain_text || "(no title)"}\n`);
console.log("Columns:");
for (const [name, p] of Object.entries(ds.properties ?? {})) {
  let detail = "";
  if (p.type === "select") detail = ` (options: ${p.select.options.map((o) => o.name).join(", ")})`;
  if (p.type === "status") detail = ` (options: ${p.status.options.map((o) => o.name).join(", ")})`;
  console.log(`  ${name.padEnd(20)} ${p.type}${detail}`);
}

// Check for required columns
const required = [
  { name: "Title",           type: "title" },
  { name: "Photo",           type: "files" },
  { name: "Image URL",       type: "url" },
  { name: "Story",           type: "rich_text" },
  { name: "Width",           type: "number" },
  { name: "Height",          type: "number" },
  { name: "Display H",       type: "number" },
  { name: "Mount",           type: "select" },
  { name: "Pin Color",       type: "rich_text" },
  { name: "Order",           type: "number" },
  { name: "Needs Auto-fill", type: "checkbox" },
  { name: "Status",          type: "status" },
  // Optional — only needed for manual coordinate placement:
  { name: "Wall X",          type: "number" },
  { name: "Wall Y",          type: "number" },
];

console.log("\nRequired column check:");
const props = ds.properties ?? {};
let missing = 0;
for (const req of required) {
  const found = props[req.name];
  if (!found) {
    console.log(`  ✗ ${req.name.padEnd(20)} MISSING (need: ${req.type})`);
    missing++;
  } else if (found.type !== req.type) {
    console.log(`  ⚠ ${req.name.padEnd(20)} type mismatch: have ${found.type}, need ${req.type}`);
    missing++;
  } else {
    console.log(`  ✓ ${req.name.padEnd(20)} ${found.type}`);
  }
}

if (missing > 0) {
  console.log(`\n⚠ ${missing} column(s) missing or wrong type — add them in Notion before running watch-notion.`);
} else {
  console.log("\n✓ All required columns present.");
}

// Sample one row
const sample = await notion.dataSources.query({
  data_source_id: dsId,
  page_size: 3,
});
if (sample.results.length === 0) {
  console.log("\nℹ DB is empty — add at least one row in Notion before testing autofill.");
} else {
  console.log(`\n${sample.results.length} row(s) found:\n`);
  for (const row of sample.results) {
    const p = row.properties;
    const title = p.Title?.title?.map((t) => t.plain_text).join("") || "(untitled)";
    const photo = p.Photo?.files?.length > 0 ? `${p.Photo.files.length} file(s)` : "—";
    const url = p["Image URL"]?.url || "—";
    const status = p.Status?.status?.name || "—";
    const needsFill = p["Needs Auto-fill"]?.checkbox ?? false;
    console.log(`  • ${title}`);
    console.log(`    Photo: ${photo}    Image URL: ${url}`);
    console.log(`    Status: ${status}   Needs Auto-fill: ${needsFill ? "✓" : "—"}`);
  }
}
