// Recovery: the previous migration script removed Tech Stack values from
// all rows (pages.update by option-name did not auto-create options as
// expected, then the schema cleanup pruned the only options that existed).
//
// Sequence here:
//   1. Add all natural-case option names to the schema first (with explicit
//      add-only payload — no IDs = new options).
//   2. Update each row's Tech Stack from FALLBACK_EXPERIENCES (matched by
//      Slug). Now the options exist in the schema, so the names resolve.
//
// Run: node --env-file=.env.local scripts/restore-experiences-tech.mjs

import { Client } from "@notionhq/client";
import { FALLBACK_EXPERIENCES } from "../data/experiences.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const EXPERIENCES_DB = process.env.NOTION_EXPERIENCES_DB_ID;
if (!NOTION_TOKEN || !EXPERIENCES_DB) {
  console.error("Missing NOTION_TOKEN or NOTION_EXPERIENCES_DB_ID");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const db = await notion.databases.retrieve({ database_id: EXPERIENCES_DB });
const dataSourceId = db.data_sources?.[0]?.id;

// All natural-case names referenced across the fallback. Set, deduped.
const desiredNames = new Set();
for (const exp of FALLBACK_EXPERIENCES) {
  for (const t of exp.techStack ?? []) desiredNames.add(t);
}

// Step 1: add any missing options to the schema (keep existing ones intact).
const ds = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
const existing = ds.properties["Tech Stack"].multi_select.options;
const existingNames = new Set(existing.map((o) => o.name));
const toAdd = [...desiredNames]
  .filter((n) => !existingNames.has(n))
  .map((name) => ({ name }));

console.log(`── adding ${toAdd.length} missing option(s) to schema ──`);
for (const o of toAdd) console.log(`  + ${o.name}`);

await notion.dataSources.update({
  data_source_id: dataSourceId,
  properties: {
    "Tech Stack": {
      multi_select: { options: [...existing, ...toAdd] },
    },
  },
});

// Step 2: re-populate each row's Tech Stack from the fallback (matched by Slug).
console.log(`\n── repopulating rows ──`);
for (const exp of FALLBACK_EXPERIENCES) {
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    filter: { property: "Slug", rich_text: { equals: exp.slug } },
  });
  if (res.results.length === 0) {
    console.log(`  ⚠ no row for slug ${exp.slug} — skip`);
    continue;
  }
  const row = res.results[0];
  await notion.pages.update({
    page_id: row.id,
    properties: {
      "Tech Stack": {
        multi_select: exp.techStack.map((name) => ({ name })),
      },
    },
  });
  console.log(`  ✓ ${exp.role}: [${exp.techStack.join(", ")}]`);
}

console.log("\n✓ done");
