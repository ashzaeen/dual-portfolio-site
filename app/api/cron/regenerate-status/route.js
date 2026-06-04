// Vercel Cron route: runs once a day, generates a whole-day BATCH of statuses.
//
// One GPT call returns 6–10 statuses, each tied to a local go-live time, using
// the location's hourly weather FORECAST and the day/date-specific notes in the
// Live Status Config's `Personal Info`. The batch is stored as JSON on the Hero
// Status row's `Schedule` property; the site rotates through the slots by the
// location's timezone (see lib/liveStatus.js + lib/useActiveStatus.js), so a
// single daily generation refreshes the status all day — no per-slot cron, which
// keeps it within the Vercel Hobby one-cron-per-day limit.
//
// Timezone follows the LOCATION: Open-Meteo `timezone=auto` returns the IANA tz
// for the Hero Config coords (Dallas, New York, Dhaka, …), and slot times +
// "time of day" are all in that local zone.
//
// Decision tree:
//   Update ticked + Status Line filled  → pin Status Line (1 all-day slot), uncheck
//   Update ticked + Status Line empty    → generate batch, uncheck
//   Update unticked + Status Line filled → pin Status Line if not already pinned
//   Update unticked + Status Line empty + batch stale → generate batch
//   else                                 → skip
//
// Auth (when CRON_SECRET is set):
//   • Vercel Cron        → `Authorization: Bearer ${CRON_SECRET}` (auto-injected daily).
//   • Manual / on-demand → `?key=${CRON_SECRET}` query param, so a plain link
//     (Notion "open link" button, bookmark, curl) can fire it immediately after
//     you edit the status in Notion. Tick `Update` first to force a fresh batch
//     regardless of staleness. (A key in the URL shows in logs/history — fine for
//     this low-stakes regen; rotate CRON_SECRET if it ever leaks.)
// Local dev:  skip CRON_SECRET entirely and hit the route directly (open access).

import { NextResponse } from "next/server";
import {
  notion,
  fetchLiveStatusConfig,
  fetchHeroStatus,
  fetchHeroConfig,
} from "@/lib/notion";
import { pickSlot, tzDate } from "@/lib/liveStatus";
import { fetchForecast, generateBatch } from "@/lib/statusBatch";

export const dynamic = "force-dynamic";

const STALE_HOURS = 18; // a daily run is always stale; on-demand mid-day is not

// Notion rich_text content caps at 2000 chars per object — chunk the JSON so a
// large batch round-trips cleanly (readText concatenates on the way back).
function chunkRichText(str, size = 1900) {
  const out = [];
  for (let i = 0; i < str.length; i += size) {
    out.push({ text: { content: str.slice(i, i + size) } });
  }
  return out.length ? out : [{ text: { content: "" } }];
}

// Overwrite the Published Hero Status row: Name = currently-active slot text,
// Generated At = now, Schedule = the full batch JSON.
async function writeSchedule(slots, tz) {
  const dbId = process.env.NOTION_HERO_STATUS_DB_ID;
  if (!dbId) throw new Error("NOTION_HERO_STATUS_DB_ID not set");

  const db = await notion.databases.retrieve({ database_id: dbId });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) throw new Error("Hero Status DB has no data source");

  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: { property: "Status", status: { equals: "Published" } },
    page_size: 1,
  });
  const row = res.results[0];
  if (!row) throw new Error("Hero Status DB has no Published row to overwrite — add a placeholder Published row");

  const active = pickSlot(slots, tz);
  const json = JSON.stringify({ tz, date: tzDate(tz), slots });

  await notion.pages.update({
    page_id: row.id,
    properties: {
      Name: { title: [{ text: { content: active?.text || slots[0].text } }] },
      "Generated At": { date: { start: new Date().toISOString() } },
      Schedule: { rich_text: chunkRichText(json) },
    },
  });
}

async function uncheckUpdate(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: { Update: { checkbox: false } },
  });
}

function isStale(generatedAt) {
  if (!generatedAt) return true;
  return Date.now() - new Date(generatedAt).getTime() > STALE_HOURS * 3600 * 1000;
}

export async function GET(request) {
  // Auth: cron bearer header OR `?key=` query param, both vs CRON_SECRET.
  // Unset secret = open (local dev).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = new URL(request.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const config = await fetchLiveStatusConfig();
    if (!config) {
      return NextResponse.json({ action: "skip", reason: "no Published config row" });
    }
    const output = await fetchHeroStatus();
    const heroConfig = await fetchHeroConfig();
    const { tz, forecastLines } = await fetchForecast(heroConfig.locationCoords);

    const pinSlot = (text) => [{ time: "00:00", text }];

    // Branch 1: Update ticked — force action now, then uncheck.
    if (config.update) {
      if (config.statusLine) {
        await writeSchedule(pinSlot(config.statusLine), tz);
        await uncheckUpdate(config._pageId);
        return NextResponse.json({ action: "manual-pin-forced", text: config.statusLine });
      }
      const { slots, tokens } = await generateBatch(config, tz, forecastLines);
      await writeSchedule(slots, tz);
      await uncheckUpdate(config._pageId);
      return NextResponse.json({ action: "batch-forced", count: slots.length, tz, slots, tokens });
    }

    // Branch 2: Status Line filled — pin it for the day (unless already pinned).
    if (config.statusLine) {
      const alreadyPinned =
        Array.isArray(output.schedule) &&
        output.schedule.length === 1 &&
        output.schedule[0].text === config.statusLine;
      if (!alreadyPinned) {
        await writeSchedule(pinSlot(config.statusLine), tz);
        return NextResponse.json({ action: "manual-pin", text: config.statusLine });
      }
      return NextResponse.json({ action: "skip", reason: "already pinned to Status Line" });
    }

    // Branch 3: No override — regenerate the day's batch if stale / missing.
    if (!output.schedule || isStale(output.generatedAt)) {
      const { slots, tokens } = await generateBatch(config, tz, forecastLines);
      await writeSchedule(slots, tz);
      return NextResponse.json({ action: "batch-scheduled", count: slots.length, tz, slots, tokens });
    }

    // Branch 4: nothing to do.
    return NextResponse.json({
      action: "skip",
      reason: "batch still fresh",
      generatedAt: output.generatedAt,
      slots: output.schedule?.length ?? 0,
    });
  } catch (err) {
    console.error("[cron/regenerate-status] error:", err);
    return NextResponse.json({ error: String(err.message ?? err) }, { status: 500 });
  }
}
