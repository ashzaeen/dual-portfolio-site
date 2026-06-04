// READ-ONLY dry run of the Live Status batch pipeline: pulls the live config +
// forecast, makes ONE GPT call, and prints/validates the resulting schedule.
// Does NOT write anything back to Notion.
import { fetchLiveStatusConfig, fetchHeroConfig } from "@/lib/notion";
import { fetchForecast, generateBatch } from "@/lib/statusBatch";
import { pickSlot, tzDate, toMin } from "@/lib/liveStatus";

const config = await fetchLiveStatusConfig();
if (!config) { console.log("No Published Live Status config row — aborting."); process.exit(1); }
const heroConfig = await fetchHeroConfig();
console.log("location coords:", heroConfig.locationCoords);

const { tz, forecastLines } = await fetchForecast(heroConfig.locationCoords);
console.log("resolved tz:", tz, "| forecast points:", forecastLines.length);
console.log("forecast sample:", forecastLines.slice(0, 4).join("  |  ") || "(none)");
console.log("systemPrompt set:", !!config.systemPrompt, "| personalInfo chars:", (config.personalInfo || "").length);

console.log("\n— calling GPT for the day's batch —");
const { slots, tokens } = await generateBatch(config, tz, forecastLines);
console.log(`got ${slots.length} slots | tokens in/out:`, tokens.in, "/", tokens.out, "\n");
for (const s of slots) console.log(`  ${s.time}  ${s.text}`);

// Validations
let ok = true;
const fail = (m) => { ok = false; console.log("✗ " + m); };
if (slots.length < 1 || slots.length > 10) fail(`slot count ${slots.length} out of [1,10]`);
for (let i = 1; i < slots.length; i++)
  if (toMin(slots[i].time) <= toMin(slots[i - 1].time)) fail(`times not strictly increasing at ${slots[i].time}`);
if (slots.some((s) => /\[(TIME|LOCATION|WEATHER)\]/i.test(s.text))) fail("a status contains a literal placeholder");

const json = JSON.stringify({ tz, date: tzDate(tz), slots });
console.log(`\nschedule JSON: ${json.length} chars (Notion chunk limit 1900/obj → ${Math.ceil(json.length / 1900)} chunk(s))`);
const active = pickSlot(slots, tz);
console.log("active slot right now:", active?.time, "→", active?.text?.slice(0, 60) + "…");
console.log("round-trips:", JSON.parse(json).slots.length === slots.length);

console.log(ok ? "\n✅ batch valid" : "\n❌ validation failed");
process.exit(ok ? 0 : 1);
