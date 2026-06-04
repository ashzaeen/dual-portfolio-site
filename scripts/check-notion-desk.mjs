// One-shot probe: verifies the Notion Desk DB is reachable and shaped right.
// Run with: node --env-file=.env.local scripts/check-notion-desk.mjs
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_DESK_DB_ID;

if (!token || !dbId) {
  console.error("Missing NOTION_TOKEN or NOTION_DESK_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: token });

const readTitle = (p) => p?.type === "title" ? p.title.map((t) => t.plain_text).join("").trim() : "";
const readText = (p) => p?.type === "rich_text" ? p.rich_text.map((t) => t.plain_text).join("").trim() : "";
const readNumber = (p) => p?.type === "number" ? p.number : null;
const readSelect = (p) => p?.type === "select" ? p.select?.name ?? null : null;
const readUrl = (p) => p?.type === "url" ? (p.url || null) : null;
const normType = (s) => (s ?? "").toLowerCase().replace(/[\s_]+/g, "-");

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

  console.log(`Got ${res.results.length} published row(s):`);

  const polaroids = [];
  let pinnedNote = null;
  let indexCard = null;
  const hiddenNotes = { left: null, right: null };

  for (const row of res.results) {
    const p = row.properties ?? {};
    const name = readTitle(p.Name);
    const type = normType(readSelect(p.Type));
    const order = readNumber(p.Order);

    if (type === "polaroid") {
      polaroids.push({
        name,
        order,
        src: readUrl(p["Image URL"]),
        caption: readText(p.Caption),
        alt: readText(p.Alt),
      });
    } else if (type === "pinned-note") {
      pinnedNote = {
        name,
        text: readText(p.Text),
        byline: readText(p.Caption),
      };
    } else if (type === "index-card") {
      indexCard = {
        name,
        text: readText(p.Text),
      };
    } else if (type === "hidden-notes") {
      const side = order === 2 ? "right" : "left";
      hiddenNotes[side] = {
        name,
        order,
        heading: readText(p.Caption),
        text: readText(p.Text),
      };
    } else {
      console.log(`  ⚠ unknown Type "${type}" on row "${name}"`);
    }
  }

  polaroids.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  console.log(`\nPolaroids (${polaroids.length} — site uses first 2 by Order):`);
  for (const p of polaroids) {
    console.log(`  ${p.order ?? "?"}. ${p.name} — "${p.caption}"`);
    console.log(`     src: ${p.src ?? "(missing)"}`);
  }

  console.log(`\nPinned note:`);
  if (pinnedNote) {
    console.log(`  "${pinnedNote.text || "(empty)"}"`);
    console.log(`  byline: "${pinnedNote.byline}"`);
  } else {
    console.log(`  (none — site will use fallback)`);
  }

  console.log(`\nIndex card lines:`);
  if (indexCard) {
    const lines = indexCard.text.split("\n");
    for (const l of lines) console.log(`  ${l}`);
  } else {
    console.log(`  (none — site will use fallback)`);
  }

  console.log(`\nHidden notes:`);
  for (const side of ["left", "right"]) {
    const page = hiddenNotes[side];
    console.log(`  ${side} page:`);
    if (page) {
      if (page.heading) console.log(`    heading: "${page.heading}"`);
      const lines = page.text ? page.text.split("\n") : [];
      for (const l of lines) console.log(`    ${l}`);
      if (!page.heading && lines.length === 0) console.log(`    (empty — site will use fallback)`);
    } else {
      console.log(`    (none — site will use fallback)`);
    }
  }
} catch (err) {
  console.error("\nNotion query failed:");
  console.error(`  code:    ${err.code}`);
  console.error(`  status:  ${err.status}`);
  console.error(`  message: ${err.message}`);
  process.exit(1);
}
