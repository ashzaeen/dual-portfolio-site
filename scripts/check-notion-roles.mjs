// One-shot probe: verifies the Notion Roles DB is reachable and shaped right.
// Run with: node --env-file=.env.local scripts/check-notion-roles.mjs
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_ROLES_DB_ID;

if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_ROLES_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

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

  console.log(`Got ${res.results.length} published role(s):`);
  for (const row of res.results) {
    const name =
      row.properties?.Name?.title?.map((t) => t.plain_text).join("") ?? "";
    const order = row.properties?.Order?.number ?? null;
    console.log(`  ${order ?? "?"}. ${name}`);
  }
} catch (err) {
  console.error("Notion query failed:");
  console.error(`  code:    ${err.code}`);
  console.error(`  status:  ${err.status}`);
  console.error(`  message: ${err.message}`);
  process.exit(1);
}
