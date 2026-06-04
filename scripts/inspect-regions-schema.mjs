// Inspect the Regions DB (discovered via Locations.Region Group relation).
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const REGIONS_DB_ID = "35e4c240-420f-80c8-9060-c69533199a4d";

const db = await notion.databases.retrieve({ database_id: REGIONS_DB_ID });
const dsId = db.data_sources?.[0]?.id;
const ds = await notion.dataSources.retrieve({ data_source_id: dsId });

console.log("Regions DB properties:");
for (const [name, p] of Object.entries(ds.properties ?? {})) {
  let detail = "";
  if (p.type === "select") detail = ` (options: ${p.select.options.map((o) => o.name).join(", ")})`;
  if (p.type === "status") detail = ` (options: ${p.status.options.map((o) => o.name).join(", ")})`;
  if (p.type === "relation") detail = ` → db ${p.relation.database_id}`;
  console.log(`  ${name.padEnd(22)} ${p.type}${detail}`);
}

console.log("\nAll rows:");
const res = await notion.dataSources.query({ data_source_id: dsId, page_size: 100 });
for (const row of res.results) {
  const propsLine = Object.entries(row.properties).map(([name, p]) => {
    let v;
    switch (p.type) {
      case "title": v = p.title.map((t) => t.plain_text).join(""); break;
      case "rich_text": v = p.rich_text.map((t) => t.plain_text).join(""); break;
      case "number": v = p.number; break;
      case "select": v = p.select?.name; break;
      case "status": v = p.status?.name; break;
      case "relation": v = `[${p.relation.length} rel]`; break;
      default: v = `(${p.type})`;
    }
    return `${name}=${v}`;
  }).join(" | ");
  console.log(`  ${propsLine}`);
}
