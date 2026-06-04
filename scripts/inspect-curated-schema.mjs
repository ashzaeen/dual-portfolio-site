// Inspect the Curated Gallery DB: prints columns + types, verifies the
// columns the override logic needs, and shows current row state.
// Run: node --env-file=.env.local scripts/inspect-curated-schema.mjs

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dbId = process.env.NOTION_CURATED_DB_ID;

if (!dbId) {
  console.error("✗ NOTION_CURATED_DB_ID not set in .env.local");
  process.exit(1);
}

const db = await notion.databases.retrieve({ database_id: dbId });
const dsId = db.data_sources?.[0]?.id;
if (!dsId) {
  console.error("✗ No data source on this database");
  process.exit(1);
}
const ds = await notion.dataSources.retrieve({ data_source_id: dsId });

console.log(`\n📋 Curated Gallery DB: ${db.title?.[0]?.plain_text || "(no title)"}\n`);
console.log("Columns:");
for (const [name, p] of Object.entries(ds.properties ?? {})) {
  let detail = "";
  if (p.type === "status") detail = ` (options: ${p.status.options.map((o) => o.name).join(", ")})`;
  console.log(`  ${name.padEnd(18)} ${p.type}${detail}`);
}

const required = [
  { name: "Title",   type: "title" },
  { name: "Key",     type: "rich_text" },
  { name: "Caption", type: "rich_text" },
  { name: "Tagline", type: "rich_text" },
  { name: "Status",  type: "status" },
  { name: "Wall X",  type: "number" },
  { name: "Wall Y",  type: "number" },
];

console.log("\nRequired column check:");
const props = ds.properties ?? {};
let missing = 0;
for (const req of required) {
  const found = props[req.name];
  if (!found) {
    console.log(`  ✗ ${req.name.padEnd(18)} MISSING (need: ${req.type})`);
    missing++;
  } else if (found.type !== req.type) {
    console.log(`  ⚠ ${req.name.padEnd(18)} type mismatch: have ${found.type}, need ${req.type}`);
    missing++;
  } else {
    console.log(`  ✓ ${req.name.padEnd(18)} ${found.type}`);
  }
}

if (missing > 0) {
  console.log(`\n⚠ ${missing} column(s) missing or wrong type — add them in Notion.`);
} else {
  console.log("\n✓ All required columns present.");
}

const sample = await notion.dataSources.query({ data_source_id: dsId, page_size: 100 });
const VALID_KEYS = new Set([
  "yjhd", "znmd", "bd_group", "sylhet", "boys_suit",
  "cox_beach", "cox_table", "cousins", "colorado",
  "boshonto", "nobo", "family", "frontier", "subway",
]);

if (sample.results.length === 0) {
  console.log("\nℹ DB is empty. Run scripts/bootstrap-curated-pinboard.mjs to seed it.");
} else {
  console.log(`\n${sample.results.length} row(s):`);
  for (const row of sample.results) {
    const p = row.properties;
    const t = (x) => x?.title?.map((y) => y.plain_text).join("") ?? "";
    const r = (x) => x?.rich_text?.map((y) => y.plain_text).join("") ?? "";
    const title = t(p.Title);
    const key = r(p.Key);
    const valid = key && VALID_KEYS.has(key);
    const status = p.Status?.status?.name ?? "—";
    const tag = key ? (valid ? "✓" : "⚠ unknown key") : "⚠ no key";
    console.log(`  ${tag}  Key: ${key.padEnd(11)}  Title: ${title}  (${status})`);
  }
}
