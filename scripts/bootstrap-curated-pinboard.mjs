// One-off: seed the Curated Gallery DB with one row per CURATED item from
// data/pinboard.js — each pre-filled with its current title/caption/tagline.
// After running, those 14 rows live in Notion and editing them propagates
// to the site (image and position stay in code).
//
// Safe to re-run: skips any Key that already has a row in the DB.
//
// Run: node --env-file=.env.local scripts/bootstrap-curated-pinboard.mjs

import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CURATED_DB = process.env.NOTION_CURATED_DB_ID;

if (!NOTION_TOKEN || !CURATED_DB) {
  console.error("Missing NOTION_TOKEN or NOTION_CURATED_DB_ID");
  process.exit(1);
}

// Curated metadata mirrored from data/pinboard.js. Keep in lockstep if you
// change copy there — but normally you'll edit in Notion after bootstrap.
// Field names match the Curated Gallery schema (Title / Caption / Tagline).
// wx / wy mirror the current hardcoded positions in data/pinboard.js so
// editing the row's Wall X / Wall Y in Notion is a no-op until you change
// them. (Match these to data/pinboard.js if you re-tune the layout there.)
const CURATED = [
  { key: "yjhd", title: "YJHD · Winter '24", wx: 300, wy: 175,
    tagline: "“Yeh Jawaani Hai Deewani” — this youth is wild, and it won’t be young again.",
    caption: "Freshman winter break. I sublet my dorm, pocketed the rent, packed one backpack, and booked the cheapest flights I could find. Ohio, Pennsylvania, New York City, Tampa, Vegas, Utah — sleeping on family couches and acquaintances' guest rooms. No itinerary. Just youth and a very light bag." },
  { key: "znmd", title: "ZNMD · Summer '25", wx: 560, wy: 155,
    tagline: "“Zindagi Na Milegi Dobara” — life won’t come this way again.",
    caption: "After high school, we all scattered — different universities, different countries. Sophomore summer, we came back. Pabna, Rajshahi, Panchagarh, Cox Bazar — the boys trip every boys group dreams about. Exactly like the movie." },
  { key: "bd_group", title: "The Squad", wx: 1680, wy: 215,
    caption: "The whole gang on the stairs. Dhanmondi, winter coats, far too much collective confidence. The last time most of us were in the same city before flying back to our separate universities. This photo always makes me want to go home." },
  { key: "sylhet", title: "Ratargul", wx: 2150, wy: 200,
    caption: "A wooden boat, a canopy of roots, and nowhere else to be. Ratargul Swamp Forest, Sylhet. The water was impossibly still. We barely spoke for an hour." },
  { key: "boys_suit", title: "Suited Up", wx: 1290, wy: 200,
    caption: "Some nights in Arlington, you put on a suit just because you can. The dock, the dark water, everyone looking like they belong in a movie. The kind of evening that starts with no plan and ends with a photo you'll keep forever." },
  { key: "cox_beach", title: "Cox Bazar · The Beach", wx: 760, wy: 720,
    caption: "The Bay of Bengal at night, all of us in the frame. We were studying abroad on separate continents — but for one summer, we came back and lived it exactly like ZNMD." },
  { key: "cox_table", title: "Cox Bazar · The Table", wx: 290, wy: 730,
    caption: "Pabna, Rajshahi, Panchagarh, Cox Bazar — one summer, all of us together again. We came home from different continents for this. The late-night table, the food, the laughing until someone cried." },
  { key: "cousins", title: "Eid '25", wx: 1620, wy: 720,
    caption: "Every Eid feels different. This one felt like exactly what it should be — everyone in one room, dressed up, a little too loud, genuinely happy." },
  { key: "colorado", title: "White Sands, NM", wx: 290, wy: 1170,
    caption: "14 hours driving from Dallas. We took turns at the wheel, argued about the playlist, stopped at White Sands on the way back. Someone looked down at the right moment. Seven shadows on white sand." },
  { key: "boshonto", title: "Boshontoboron", wx: 730, wy: 1140,
    caption: "বসন্তবরণ in Arlington — the Bengali spring festival, 8,000 miles from Dhaka. Salwar kameez, string lights, and everyone a little homesick and a little bit home at the same time." },
  { key: "nobo", title: "Noboborsho", wx: 1180, wy: 1150,
    caption: "নববর্ষ — Bengali New Year, celebrated properly. The people who make every timezone feel like home." },
  { key: "family", title: "Home", wx: 1680, wy: 1130,
    caption: "The one that lives on my debit card. Cox Bazar beach, sometime in the early 2000s. Dad, Mom, me in the blue shirt, my brother in the striped one. I carry this photo everywhere — literally." },
  // frontier + subway use their own modal copy in code (TripModal / SubwayModal).
  // Bootstrap creates rows for completeness in case you want to wire those
  // modals through Notion later — editing them now won't change anything visible.
  { key: "frontier", title: "Frontier · DFW → MSY", wx: 2150, wy: 760, caption: "" },
  { key: "subway",   title: "Subway · Arlington",   wx: 200,  wy: 880, caption: "" },
];

const notion = new Client({ auth: NOTION_TOKEN });

async function dsId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error("No data source");
  return id;
}

const ds = await dsId(CURATED_DB);

// 1) Look up existing Keys (idempotent re-run guard).
const existing = await notion.dataSources.query({ data_source_id: ds, page_size: 100 });
const existingKeys = new Set();
for (const row of existing.results) {
  const k = row.properties?.Key?.rich_text?.map((t) => t.plain_text).join("").trim();
  if (k) existingKeys.add(k);
}
console.log(`Found ${existingKeys.size} curated row(s) already in Notion.`);

// 2) Create rows for any Key missing from Notion.
let created = 0, skipped = 0;
for (const item of CURATED) {
  if (existingKeys.has(item.key)) {
    console.log(`  — ${item.key}  (already in Notion, skipping)`);
    skipped++;
    continue;
  }
  const properties = {
    Title:    { title:     [{ text: { content: item.title } }] },
    Key:      { rich_text: [{ text: { content: item.key } }] },
    Caption:  { rich_text: item.caption ? [{ text: { content: item.caption } }] : [] },
    Status:   { status:    { name: "Published" } },
    "Wall X": { number: item.wx },
    "Wall Y": { number: item.wy },
  };
  if (item.tagline) {
    properties.Tagline = { rich_text: [{ text: { content: item.tagline } }] };
  }
  await notion.pages.create({
    parent: { data_source_id: ds },
    properties,
  });
  console.log(`  ✓ ${item.key}  →  "${item.title}"  @ (${item.wx}, ${item.wy})`);
  created++;
}

console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
console.log("Edit Title / Caption / Tagline in Notion to change the on-site copy.");
