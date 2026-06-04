// Live Status — single object (text + Notion-timestamp).
//
// The cron route in app/api/cron/regenerate-status overwrites the
// underlying Notion row in the Hero Live Status DB; the site reads via
// fetchHeroStatus() in lib/notion.js and gets `{ text, generatedAt }`.
// Both Pro and Personal Heroes render the same `text`; the Pro side also
// displays a relative "Updated Xs ago" derived from `generatedAt`.
//
// This fallback renders before the cron writes its first sentence, when
// NOTION_HERO_STATUS_DB_ID is unset, or if the Notion call fails.

// `schedule`/`tz` stay null in the fallback — when Notion is unreachable there's
// no daily batch to rotate, so the heroes just render `text`. When Notion is up,
// fetchHeroStatus returns the live batch and the client hook rotates it.
export const FALLBACK_HERO_STATUS = {
  text: "It's Sunday evening at 6:50 PM and a cozy 29.4°C in Arlington; Ashzaeen is likely experimenting with AI models while pretending that's not just stress-testing his patience.",
  generatedAt: null,
  schedule: null,
  tz: null
};
