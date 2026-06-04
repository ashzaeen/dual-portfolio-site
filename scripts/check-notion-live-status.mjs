// One-shot probe: verifies the Live Status Config DB is reachable + shaped
// right. Shows all 5 input fields the cron pipeline will read.
// Run: node --env-file=.env.local scripts/check-notion-live-status.mjs

import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_LIVE_STATUS_CONFIG_DB_ID;

if (!token) {
  console.error("[fatal] Missing NOTION_TOKEN");
  process.exit(1);
}
if (!dbId) {
  console.error("[fatal] Missing NOTION_LIVE_STATUS_CONFIG_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const PUBLISHED = { property: "Status", status: { equals: "Published" } };

const readTitle = (p) =>
  p?.title?.map((t) => t.plain_text).join("").trim() ?? "";
const readText = (p) =>
  p?.rich_text?.map((t) => t.plain_text).join("").trim() ?? "";
const readCheckbox = (p) => (p?.type === "checkbox" ? p.checkbox : false);

async function pageBodyAsText(pageId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);

  const lines = [];
  for (const b of blocks) {
    const text = (rt) => (rt ?? []).map((t) => t.plain_text ?? "").join("");
    switch (b.type) {
      case "paragraph":
      case "heading_1":
      case "heading_2":
      case "heading_3":
      case "quote":
      case "callout":
        lines.push(text(b[b.type].rich_text));
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do":
        lines.push("- " + text(b[b.type].rich_text));
        break;
      case "code":
        lines.push(text(b.code.rich_text));
        break;
      case "divider":
        lines.push("---");
        break;
    }
  }
  return lines.filter((s) => s !== "").join("\n");
}

try {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) {
    console.error("[fatal] No data source on database");
    process.exit(1);
  }

  console.log("── Live Status Config ──");
  console.log(`  data_source_id=${dataSourceId}`);

  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: PUBLISHED,
    page_size: 1,
  });

  if (res.results.length === 0) {
    console.log("  [warn] no Published rows — cron will skip until a row is published");
    process.exit(0);
  }

  const row = res.results[0];
  const p = row.properties ?? {};

  const name = readTitle(p.Name);
  const loc = readText(p["Current Location"]);
  const info = readText(p["Personal Info"]);
  const statusLine = readText(p["Status Line"]);
  const update = readCheckbox(p.Update);
  // System Prompt lives in the page body
  const sys = await pageBodyAsText(row.id);

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 3) + "..." : s);

  console.log(`  name:              "${name}"`);
  console.log(`  currentLocation:   "${loc || "(empty)"}"`);
  console.log(`  systemPrompt:      ${sys ? `${sys.length} chars (from page body) — "${truncate(sys, 100)}"` : "(empty — write the prompt in the row's page body)"}`);
  console.log(`  personalInfo:      ${info ? `${info.length} chars — "${truncate(info, 100)}"` : "(empty)"}`);
  console.log(`  statusLine:        ${statusLine ? `"${truncate(statusLine, 100)}" (manual override — cron will push this)` : "(empty — cron will regenerate via GPT)"}`);
  console.log(`  update:            ${update ? "✓ TICKED (next cron tick will act immediately)" : "·"}`);

  console.log("\n── done ──");
} catch (err) {
  console.error(`[error] ${err.code ?? "?"} ${err.status ?? ""} ${err.message}`);
  process.exit(1);
}
