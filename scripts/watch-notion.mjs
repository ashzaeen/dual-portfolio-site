// Local watcher loop. Repeatedly runs the shared auto-fill pass from
// lib/notion-autofill.mjs (geocoding, GPT, OMDb/Deezer/YouTube, image dims →
// writes derived metadata back to Notion when a row's "Needs Auto-fill" is
// ticked, then unchecks it).
//
// On Vercel the SAME runAutofill() is exposed on-demand at
// app/api/notion-autofill — fire it from a Notion button instead of a loop.
//
// Run: npm run watch:notion   (node --env-file=.env.local scripts/watch-notion.mjs)
// Stop: Ctrl+C

import { runAutofill, logConfig, POLL_INTERVAL_MS } from "../lib/notion-autofill.mjs";

if (
  !process.env.NOTION_TOKEN ||
  !process.env.OPENAI_API_KEY ||
  !process.env.NOTION_LOCATIONS_DB_ID ||
  !process.env.NOTION_REGIONS_DB_ID
) {
  console.error("Missing env: NOTION_TOKEN, OPENAI_API_KEY, NOTION_LOCATIONS_DB_ID, NOTION_REGIONS_DB_ID");
  process.exit(1);
}

logConfig();
console.log(`watch-notion: polling every ${POLL_INTERVAL_MS / 1000}s. Ctrl+C to stop.`);
console.log(`tick a row's "Needs Auto-fill" checkbox in any DB to trigger.`);

await runAutofill(); // immediate first pass
setInterval(runAutofill, POLL_INTERVAL_MS);
