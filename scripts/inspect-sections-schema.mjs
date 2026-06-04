// One-off: inspect the "Section Copy" DB schema so we know which columns exist
// before seeding. Run: node --env-file=.env.local scripts/inspect-sections-schema.mjs
import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) { console.error("Missing NOTION_TOKEN"); process.exit(1); }

// DB id from the URL the user provided.
const DB_ID = process.env.NOTION_SECTIONS_DB_ID || "3744c240420f80859c5ec6724b46354b";

const notion = new Client({ auth: NOTION_TOKEN });

try {
  const db = await notion.databases.retrieve({ database_id: DB_ID });
  const title = (db.title || []).map((t) => t.plain_text).join("");
  console.log("DB title:", JSON.stringify(title));
  const dsId = db.data_sources?.[0]?.id;
  console.log("data_source_id:", dsId);

  // Properties live on the data source in API 2025+.
  const ds = await notion.dataSources.retrieve({ data_source_id: dsId });
  console.log("\nProperties:");
  for (const [name, def] of Object.entries(ds.properties)) {
    let extra = "";
    if (def.type === "status") {
      const opts = (def.status?.options || []).map((o) => o.name);
      extra = ` options=[${opts.join(", ")}]`;
    }
    console.log(`  - ${JSON.stringify(name)}: ${def.type}${extra}`);
  }

  const rows = await notion.dataSources.query({ data_source_id: dsId, page_size: 100 });
  console.log(`\nExisting rows: ${rows.results.length}`);
} catch (err) {
  console.error(`[error] ${err.code ?? "?"} ${err.message}`);
  process.exit(1);
}
