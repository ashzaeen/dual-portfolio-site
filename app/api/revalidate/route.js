// On-demand cache revalidation: refreshes the live site's Notion-backed content
// immediately instead of waiting for the 1-hour ISR window. Fire it from a
// Notion "Publish content" Button (Open link) right after you edit Notion:
//   https://<your-site>/api/revalidate?key=<CRON_SECRET>
//
// Auth: `?key=${CRON_SECRET}` (Notion button / link), OR
//       `Authorization: Bearer ${CRON_SECRET}`. Unset secret = open (local dev).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function handle(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = new URL(request.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    // Revalidate everything under the root layout — both the professional ("/")
    // and personal ("/personal") landings plus all their statically-generated
    // slug pages (projects, experiences, writing, travel, gallery). The next
    // visit to each regenerates from current Notion data.
    revalidatePath("/", "layout");
    return NextResponse.json({ revalidated: true, scope: "all", at: new Date().toISOString() });
  } catch (err) {
    console.error("[api/revalidate] error:", err);
    return NextResponse.json({ error: String(err.message ?? err) }, { status: 500 });
  }
}

// GET so a Notion "Open link" button / browser works; POST for webhooks.
export const GET = handle;
export const POST = handle;
