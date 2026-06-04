// Quick: print the autofilled values for each Pinboard row.
// Run: node --env-file=.env.local scripts/check-pinboard-row.mjs

import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const db = await notion.databases.retrieve({ database_id: process.env.NOTION_PINBOARD_DB_ID });
const ds = db.data_sources[0].id;
const res = await notion.dataSources.query({ data_source_id: ds, page_size: 5 });

for (const row of res.results) {
  const p = row.properties;
  const t = (x) => x?.title?.map((y) => y.plain_text).join("") ?? "";
  const r = (x) => x?.rich_text?.map((y) => y.plain_text).join("") ?? "";
  console.log("\n📌 " + t(p.Title));
  console.log("   Width:     " + p.Width?.number);
  console.log("   Height:    " + p.Height?.number);
  console.log("   Display H: " + p["Display H"]?.number);
  console.log("   Pin Color: " + r(p["Pin Color"]));
  console.log("   Mount:     " + (p.Mount?.select?.name ?? "—"));
  console.log("   Status:    " + (p.Status?.status?.name ?? "—"));
  console.log("   Story:     " + (r(p.Story).slice(0, 80) || "(empty)"));
  const photo = p.Photo?.files?.[0];
  if (photo) {
    const url = photo.file?.url || photo.external?.url;
    console.log("   Photo:     " + (url ? "✓ (URL " + (photo.file ? "expires in 1hr" : "external") + ")" : "—"));
  }
}
