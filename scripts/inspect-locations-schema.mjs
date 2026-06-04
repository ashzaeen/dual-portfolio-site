// Quick schema inspector — prints the current property names + types
// on the Locations DB so we can adjust to schema changes.
// Run: node --env-file=.env.local scripts/inspect-locations-schema.mjs

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const dbId = process.env.NOTION_LOCATIONS_DB_ID;

const db = await notion.databases.retrieve({ database_id: dbId });
const dsId = db.data_sources?.[0]?.id;
const ds = await notion.dataSources.retrieve({ data_source_id: dsId });

console.log("Locations DB properties:");
for (const [name, p] of Object.entries(ds.properties ?? {})) {
  let detail = "";
  if (p.type === "select") detail = ` (options: ${p.select.options.map((o) => o.name).join(", ")})`;
  if (p.type === "status") detail = ` (options: ${p.status.options.map((o) => o.name).join(", ")})`;
  if (p.type === "relation") detail = ` → db ${p.relation.database_id}`;
  console.log(`  ${name.padEnd(22)} ${p.type}${detail}`);
}

// Sample one row to see what data looks like for the relation
const sample = await notion.dataSources.query({
  data_source_id: dsId,
  page_size: 1,
});
if (sample.results[0]) {
  console.log("\nSample row property values:");
  for (const [name, p] of Object.entries(sample.results[0].properties)) {
    let v;
    switch (p.type) {
      case "title": v = p.title.map((t) => t.plain_text).join(""); break;
      case "rich_text": v = p.rich_text.map((t) => t.plain_text).join(""); break;
      case "number": v = p.number; break;
      case "select": v = p.select?.name; break;
      case "status": v = p.status?.name; break;
      case "checkbox": v = p.checkbox; break;
      case "relation": v = `[${p.relation.length} relation(s): ${p.relation.map((r) => r.id).join(", ")}]`; break;
      default: v = `(${p.type})`;
    }
    console.log(`  ${name.padEnd(22)} = ${v}`);
  }
}
