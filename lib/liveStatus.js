// Pure, isomorphic helpers for the Live Status daily-batch schedule.
// The cron writes a batch of statuses for the day, each tied to a local
// go-live time + the location's IANA timezone. Both the server (fetchHeroStatus)
// and the client hook (useActiveStatus) use pickSlot() to choose whichever slot
// is currently active — so one daily generation rotates all day with no cron.

// Current wall-clock minutes-since-midnight in the given IANA timezone.
export function tzMinutes(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

// "HH:MM" → minutes since midnight.
export function toMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Pick the active slot for `now` in `tz`: the latest slot whose time has
// passed. Before the day's first slot, the LAST slot carries over (no gap).
// Returns { text, time, elapsedMin } or null.
export function pickSlot(slots, tz, date = new Date()) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const now = tzMinutes(tz, date);
  const sorted = slots
    .map((s) => ({ ...s, _m: toMin(s.time) }))
    .sort((a, b) => a._m - b._m);
  let chosen = sorted[sorted.length - 1]; // carryover when now < first slot
  for (const s of sorted) {
    if (s._m <= now) chosen = s;
  }
  const elapsedMin = now >= chosen._m ? now - chosen._m : now + 1440 - chosen._m;
  return { text: chosen.text, time: chosen.time, elapsedMin };
}

// Live clock label in the given timezone, e.g. "6:50 PM" — what the status's
// [TIME] token is replaced with so the displayed time stays current.
export function liveTimeLabel(tz, date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

// Replace the literal [TIME] token (the system prompt mandates one per status)
// with the live local clock. Case-insensitive; leaves everything else intact.
export function fillStatus(text, tz) {
  if (!text) return text ?? "";
  return text.replace(/\[\s*time\s*\]/gi, liveTimeLabel(tz));
}

// YYYY-MM-DD for "today" in the given timezone.
export function tzDate(tz, date = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const d = p.find((x) => x.type === "day")?.value;
  return `${y}-${m}-${d}`;
}
