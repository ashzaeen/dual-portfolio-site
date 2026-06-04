// Vercel Cron route: runs hourly, orchestrates the Live Status pipeline.
//
// Decision tree (matches the locked design in project_live_status_pipeline):
//   Update ticked + Status Line filled  → push Status Line, uncheck Update
//   Update ticked + Status Line empty   → call GPT, push, uncheck Update
//   Update unticked + Status Line filled (and output stale)
//                                       → push Status Line (manual sync)
//   Update unticked + Status Line empty + output >4hrs old
//                                       → call GPT, push
//   else                                → skip
//
// Auth (when CRON_SECRET is set):
//   • Vercel Cron   → `Authorization: Bearer ${CRON_SECRET}` (auto-injected daily).
//   • Manual / on-demand → `?key=${CRON_SECRET}` query param, so a plain link
//     (Notion "open link" button, bookmark, curl) can fire it immediately after
//     you edit the status in Notion — no waiting for the daily tick. Combine with
//     the row's `Update` checkbox to force an immediate GPT regen regardless of
//     the 4-hour staleness window. (A key in the URL shows up in logs/history —
//     fine for this low-stakes regen; rotate CRON_SECRET if it ever leaks.)
// Local dev:  skip CRON_SECRET entirely and hit the route directly (open access).

import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  notion,
  fetchLiveStatusConfig,
  fetchHeroStatus,
  fetchHeroConfig,
} from "@/lib/notion";

export const dynamic = "force-dynamic";

const STALE_HOURS = 4;
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 200;
const TEMPERATURE = 0.9;

// WMO weather code → human-readable. Open-Meteo's current.weather_code uses
// the WMO 4677 table; we map the codes the site is likely to encounter.
const WEATHER_CODES = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "freezing fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  61: "light rain",
  63: "moderate rain",
  65: "heavy rain",
  71: "light snow",
  73: "moderate snow",
  75: "heavy snow",
  77: "snow grains",
  80: "rain showers",
  81: "moderate rain showers",
  82: "violent rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

// Parse the Hero Config Location Coords string like "32.8998° N, 97.0403° W"
// into signed decimal lat/lng. Returns null on parse failure → weather skipped.
function parseCoords(str) {
  const m = str?.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/i);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lng = parseFloat(m[3]);
  if (m[2].toUpperCase() === "S") lat = -lat;
  if (m[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}

async function fetchWeather(coordsString) {
  const coords = parseCoords(coordsString);
  if (!coords) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const tempC = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    return {
      tempC,
      text: WEATHER_CODES[code] ?? `weather code ${code}`,
    };
  } catch (err) {
    console.error("[cron] Open-Meteo fetch failed:", err.message);
    return null;
  }
}

// Bucket the wall-clock hour into a natural-language time-of-day descriptor
// the GPT can weave in (or omit) per its voice. Dallas/Central-Time hour.
function timeOfDayLabel(hour) {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
}

function buildUserPrompt(config, weather) {
  const now = new Date();
  const dallasHour = parseInt(
    now.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }),
    10
  );
  const dallasFull = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tod = timeOfDayLabel(dallasHour);

  return [
    `Time of day: ${tod}`,
    `Exact time (use only if natural): ${dallasFull} Central Time`,
    weather ? `Weather: ${weather.tempC}°C, ${weather.text}` : "Weather: unavailable",
    `Current location: ${config.currentLocation || "unspecified"}`,
    "",
    `Personal context:`,
    config.personalInfo || "(none provided)",
    "",
    `Output ONLY the final status sentence. Do not output literal placeholders like [TIME], [LOCATION], or [WEATHER] — weave the actual values in naturally or omit them.`,
  ].join("\n");
}

async function callGPT(config) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  if (!config.systemPrompt) throw new Error("System prompt is empty — fill the Live Status page body in Notion");

  const heroConfig = await fetchHeroConfig();
  const weather = await fetchWeather(heroConfig.locationCoords);
  const userPrompt = buildUserPrompt(config, weather);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("GPT returned empty response");
  return {
    text,
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
    weatherUsed: weather,
  };
}

async function writeOutput(text) {
  const dbId = process.env.NOTION_HERO_STATUS_DB_ID;
  if (!dbId) throw new Error("NOTION_HERO_STATUS_DB_ID not set");

  const db = await notion.databases.retrieve({ database_id: dbId });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) throw new Error("Hero Live Status DB has no data source");

  const res = await notion.dataSources.query({
    data_source_id: dsId,
    filter: { property: "Status", status: { equals: "Published" } },
    page_size: 1,
  });
  const row = res.results[0];
  if (!row) throw new Error("Hero Live Status DB has no Published row to overwrite — add a placeholder Published row");

  await notion.pages.update({
    page_id: row.id,
    properties: {
      Name: { title: [{ text: { content: text } }] },
      "Generated At": { date: { start: new Date().toISOString() } },
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
  // Auth: accept the cron's bearer header OR a `?key=` query param (manual
  // trigger), both checked against CRON_SECRET. Unset secret = open (local dev).
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

    // Branch 1: Update ticked
    if (config.update) {
      if (config.statusLine) {
        await writeOutput(config.statusLine);
        await uncheckUpdate(config._pageId);
        return NextResponse.json({
          action: "manual-push-forced",
          text: config.statusLine,
        });
      }
      const gen = await callGPT(config);
      await writeOutput(gen.text);
      await uncheckUpdate(config._pageId);
      return NextResponse.json({
        action: "gpt-regen-forced",
        text: gen.text,
        tokens: { in: gen.inputTokens, out: gen.outputTokens },
        weather: gen.weatherUsed,
      });
    }

    // Branch 2: Status Line filled (manual override syncing on its own)
    if (config.statusLine && output.text !== config.statusLine) {
      await writeOutput(config.statusLine);
      return NextResponse.json({
        action: "manual-sync",
        text: config.statusLine,
      });
    }

    // Branch 3: No override, regen if cache is stale
    if (!config.statusLine && isStale(output.generatedAt)) {
      const gen = await callGPT(config);
      await writeOutput(gen.text);
      return NextResponse.json({
        action: "gpt-regen-scheduled",
        text: gen.text,
        tokens: { in: gen.inputTokens, out: gen.outputTokens },
        weather: gen.weatherUsed,
      });
    }

    // Branch 4: nothing to do
    return NextResponse.json({
      action: "skip",
      reason: "no work needed",
      output: { text: output.text, generatedAt: output.generatedAt },
    });
  } catch (err) {
    console.error("[cron/regenerate-status] error:", err);
    return NextResponse.json(
      { error: String(err.message ?? err) },
      { status: 500 }
    );
  }
}
