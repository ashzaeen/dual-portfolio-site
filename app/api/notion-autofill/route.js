// On-demand Notion auto-fill, for Vercel (no persistent watcher process).
//
// Runs ONE pass of the same enrichment pipeline the local `npm run watch:notion`
// loop uses (lib/notion-autofill.mjs): for every row with "Needs Auto-fill"
// ticked, derive metadata (geocode, GPT, OMDb/Deezer/YouTube, image dims),
// write it back, and untick the box.
//
// Fire it from a Notion **Button** (Open link) or a bookmark:
//   https://<your-site>/api/notion-autofill?key=<AUTOFILL_SECRET>
//
// Auth: `?key=` must equal AUTOFILL_SECRET, OR `Authorization: Bearer <CRON_SECRET>`
// (so a Vercel Cron could share it later). If NEITHER secret is configured the
// route runs unauthenticated — convenient for local dev, but set AUTOFILL_SECRET
// in production so the endpoint isn't open.
//
// Heads-up: a serverless call has a ~60s budget and the pipeline is slow per row
// (GPT calls, 1.1s Nominatim politeness sleeps). If you tick a large batch, just
// fire it again — processing is idempotent (filled fields are left untouched and
// the box is only unchecked once a row succeeds).

import { NextResponse } from "next/server";
import { runAutofill } from "@/lib/notion-autofill.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req) {
  const keySecret = process.env.AUTOFILL_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron / curl with a bearer token.
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  // Notion button / link / bookmark.
  const key = new URL(req.url).searchParams.get("key");
  if (keySecret && key === keySecret) return true;

  // No secret configured anywhere → open (local dev only).
  return !keySecret && !cronSecret;
}

async function handle(req) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runAutofill();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

// GET so a Notion "Open link" button / browser works; POST for webhooks.
export const GET = handle;
export const POST = handle;
