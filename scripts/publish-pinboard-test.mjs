// One-off: flip every Pinboard row to Published, so the autofilled test
// row shows up on the live wall. Remove this script once testing is done.

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const db = await notion.databases.retrieve({ database_id: process.env.NOTION_PINBOARD_DB_ID });
const ds = db.data_sources[0].id;
const res = await notion.dataSources.query({ data_source_id: ds });

for (const row of res.results) {
  const title = row.properties.Title?.title?.map((t) => t.plain_text).join("") || "(untitled)";
  const current = row.properties.Status?.status?.name;
  if (current === "Published") {
    console.log(`— ${title} (already Published)`);
    continue;
  }
  await notion.pages.update({
    page_id: row.id,
    properties: { Status: { status: { name: "Published" } } },
  });
  console.log(`✓ ${title} → Published (was ${current})`);
}
