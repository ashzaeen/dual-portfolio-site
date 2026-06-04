// Live Status batch generation: location-aware weather forecast + the one GPT
// call that returns a whole day of timed statuses. Extracted from the cron route
// so it can be unit-tested without writing to Notion. Server-only (uses OpenAI).
import OpenAI from "openai";
import { toMin } from "@/lib/liveStatus";

export const DEFAULT_TZ = "America/Chicago";
const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1400;
const TEMPERATURE = 0.9;
export const MIN_SLOTS = 5;
export const MAX_SLOTS = 10;

// WMO weather code → human-readable (Open-Meteo current/hourly weather_code).
const WEATHER_CODES = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "freezing fog",
  51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
  61: "light rain", 63: "moderate rain", 65: "heavy rain",
  71: "light snow", 73: "moderate snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "moderate rain showers", 82: "violent rain showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail",
};

// Parse "32.8998° N, 97.0403° W" → signed decimal { lat, lng }, or null.
export function parseCoords(str) {
  const m = str?.match(/([\d.]+)°\s*([NS]),\s*([\d.]+)°\s*([EW])/i);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lng = parseFloat(m[3]);
  if (m[2].toUpperCase() === "S") lat = -lat;
  if (m[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}

// Open-Meteo: the location's IANA timezone + a compact hourly forecast for today
// (local time). `timezone=auto` makes both follow the coords (Dallas/NYC/Dhaka…).
// Falls back to DEFAULT_TZ with no forecast on failure.
export async function fetchForecast(coordsString) {
  const coords = parseCoords(coordsString);
  if (!coords) return { tz: DEFAULT_TZ, forecastLines: [] };
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
      `&hourly=temperature_2m,weather_code&forecast_days=1&timezone=auto&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) return { tz: DEFAULT_TZ, forecastLines: [] };
    const data = await res.json();
    const tz = data.timezone || DEFAULT_TZ;
    const times = data.hourly?.time ?? [];
    const temps = data.hourly?.temperature_2m ?? [];
    const codes = data.hourly?.weather_code ?? [];
    const forecastLines = [];
    for (let i = 0; i < times.length; i += 2) {
      const hhmm = String(times[i]).slice(11, 16); // "YYYY-MM-DDTHH:MM" → "HH:MM"
      const temp = temps[i] != null ? `${Math.round(temps[i])}°C` : "—";
      forecastLines.push(`${hhmm}  ${temp}  ${WEATHER_CODES[codes[i]] ?? "—"}`);
    }
    return { tz, forecastLines };
  } catch (err) {
    console.error("[statusBatch] Open-Meteo fetch failed:", err.message);
    return { tz: DEFAULT_TZ, forecastLines: [] };
  }
}

function buildBatchPrompt(config, tz, forecastLines) {
  const dateStr = new Date().toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return [
    `Today is ${dateStr} (local time; timezone ${tz}).`,
    ``,
    `Hourly weather forecast for today (local time):`,
    forecastLines.length ? forecastLines.join("\n") : "(forecast unavailable)",
    ``,
    `Current location: ${config.currentLocation || "unspecified"}`,
    ``,
    `Personal context — may contain day-of-week or specific-date plans. Use the entries that match TODAY's date/day; ignore the rest:`,
    config.personalInfo || "(none provided)",
    ``,
    `Write a SCHEDULE of status updates for today. Rules:`,
    `- Output between ${MIN_SLOTS} and ${MAX_SLOTS} statuses. Use MORE when the day is eventful (lots of weather change, or a busy/packed personal schedule) and FEWER on a quiet day.`,
    `- YOU choose each status's go-live time to fit the day's rhythm: weight toward daytime normally, but toward late night / early hours if the personal context implies an all-nighter or night activity.`,
    `- Each status should reflect that time slot's FORECASTED weather and whatever the personal context implies is happening then.`,
    `- Times are 24-hour "HH:MM" in local time, strictly increasing across the list.`,
    `- Each status is ONE sentence, in the exact voice of the system prompt. Never output literal placeholders like [TIME], [LOCATION], or [WEATHER] — weave the real values in or omit them.`,
    ``,
    `Return ONLY JSON: {"statuses":[{"time":"HH:MM","text":"..."}, ...]}`,
  ].join("\n");
}

function normalizeTime(t) {
  let [h, m] = String(t).split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;
  h = Math.max(0, Math.min(23, h));
  m = Math.max(0, Math.min(59, m));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// One GPT call → a validated, sorted, de-duplicated array of {time,text} slots.
export async function generateBatch(config, tz, forecastLines) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  if (!config.systemPrompt) {
    throw new Error("System prompt is empty — fill the Live Status page body in Notion");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: buildBatchPrompt(config, tz, forecastLines) },
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GPT returned invalid JSON");
  }

  const seen = new Set();
  const slots = (Array.isArray(parsed.statuses) ? parsed.statuses : [])
    .filter((s) => s && typeof s.text === "string" && /^\d{1,2}:\d{2}$/.test(s.time ?? ""))
    .map((s) => ({ time: normalizeTime(s.time), text: s.text.trim() }))
    .filter((s) => s.text && !seen.has(s.time) && seen.add(s.time))
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  if (slots.length === 0) throw new Error("GPT returned no usable statuses");
  return {
    slots: slots.slice(0, MAX_SLOTS),
    tokens: { in: completion.usage?.prompt_tokens, out: completion.usage?.completion_tokens },
  };
}
