// ─────────────────────────────────────────────────────────────
// Pinboard placement — drops a Notion-driven photo onto the wall
// without overlapping curated photos, decorations, or reserved zones.
//
// Design goals:
//   1. DETERMINISTIC. Same photo (by id) always lands in the same
//      spot across reloads — no layout shift, no surprises.
//   2. SPREAD. Candidates are generated on a jittered hex-style grid
//      so consecutive Notion entries don't pile up in one corner.
//   3. GRACEFUL. If we can't place a photo without overlap after
//      trying every candidate, return a best-effort fallback rather
//      than crashing.
//
// Usage:
//   const existing = buildExistingBoxes(curatedItems, INTERACTIVE_BOXES);
//   for (const photo of notionPhotos) {
//     const placement = placeItem(photo, existing);
//     placed.push({ ...photo, ...placement });
//     existing.push(itemBoundingBox({ ...photo, ...placement }));
//   }
// ─────────────────────────────────────────────────────────────

import { WALL_W, WALL_H } from "@/data/pinboard";

// mulberry32 — small fast 32-bit PRNG. Seeded so output is repeatable.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple deterministic string→uint32 hash (djb2 xor variant).
function stringHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return h >>> 0;
}

// AABB overlap test with optional inflation (gives the placement a
// little extra breathing room beyond bare touching).
function bboxOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w + pad <= b.x ||
    a.x >= b.x + b.w + pad ||
    a.y + a.h + pad <= b.y ||
    a.y >= b.y + b.h + pad
  );
}

// Compute a wall-item's rendered bounding box. Mirrors the dW/dH math
// in Items.jsx (WallItem) so placement reasons about the same pixels
// the user actually sees.
export function itemBoundingBox(item) {
  // Paper items (boarding pass / receipt) don't have w/h/dH — give them
  // reasonable fixed footprints so they participate in collision checks.
  if (item.type === "boarding-pass") return { x: item.wx, y: item.wy, w: 268, h: 200 };
  if (item.type === "receipt")       return { x: item.wx, y: item.wy, w: 128, h: 90  };
  const dH = item.dH ? Math.round(item.dH * 1.12) : 240;
  const dW = item.w && item.h && item.dH
    ? Math.round(item.dH * 1.12 * (item.w / item.h))
    : Math.round(dH * 0.85);
  return { x: item.wx, y: item.wy, w: dW, h: dH };
}

// Generator: yields candidate positions in deterministic-but-shuffled order.
// First sweep is a jittered hex-style grid so candidates spread across the
// wall instead of marching strictly left→right. Fallback sweep adds pure
// random tries in case the grid is fully occupied.
function* candidatePositions(itemBbox, wallW, wallH, seed) {
  const rng = mulberry32(seed);
  // Cell padding controls how spread-out candidate positions are. Set to
  // mimic the curated corkboard density (photos hugging close, occasional
  // light overlap implied by rotation). Smaller value → tighter packing.
  const PAD = 24;
  const cellW = itemBbox.w + PAD;
  const cellH = itemBbox.h + PAD;
  const cols = Math.max(1, Math.floor((wallW - PAD * 2) / cellW));
  const rows = Math.max(1, Math.floor((wallH - PAD * 2) / cellH));

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  // Fisher-Yates shuffle, seeded.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  for (const { r, c } of cells) {
    // Hex-style offset: odd rows shift half a cell so adjacent rows don't
    // stack their items at identical x coordinates.
    const baseX = PAD + c * cellW + (r % 2) * (cellW / 2);
    const baseY = PAD + r * cellH;
    const jitterX = (rng() - 0.5) * 50;
    const jitterY = (rng() - 0.5) * 50;
    const x = Math.max(0, Math.min(wallW - itemBbox.w, baseX + jitterX));
    const y = Math.max(0, Math.min(wallH - itemBbox.h, baseY + jitterY));
    yield { x: Math.round(x), y: Math.round(y) };
  }

  // Random fallback (in case the grid is fully blocked by overlap padding).
  for (let i = 0; i < 200; i++) {
    yield {
      x: Math.round(rng() * Math.max(0, wallW - itemBbox.w)),
      y: Math.round(rng() * Math.max(0, wallH - itemBbox.h)),
    };
  }
}

// Pick a deterministic tilt in [-8, +8] degrees so dynamic photos feel as
// hand-pinned as the curated ones.
export function seededRotationFromId(id) {
  return seededRotation(stringHash(String(id ?? "anon")));
}
function seededRotation(seed) {
  const rng = mulberry32(seed ^ 0xABC123);
  // Skew toward smaller angles (the cube of [-1,1] is concentrated near 0)
  const raw = rng() * 2 - 1;
  return Math.round(raw * raw * raw * 8);
}

// Main entry point. Returns { wx, wy, wr } to merge onto the item record.
export function placeItem(item, existing, options = {}) {
  const {
    wallW = WALL_W,
    wallH = WALL_H,
    // Overlap-check padding — minimum distance between two placed items.
    // Tuned to match curated corkboard density (≈10–14px gap typical).
    padding = 12,
  } = options;
  const bbox = itemBoundingBox(item);
  const seed = stringHash(String(item.id ?? "anon"));

  for (const pos of candidatePositions(bbox, wallW, wallH, seed)) {
    const cand = { x: pos.x, y: pos.y, w: bbox.w, h: bbox.h };
    let conflict = false;
    for (const e of existing) {
      if (bboxOverlap(cand, e, padding)) { conflict = true; break; }
    }
    if (!conflict) {
      return { wx: pos.x, wy: pos.y, wr: seededRotation(seed) };
    }
  }

  // Could not find a clear spot — return a deterministic fallback so the
  // photo still renders (just possibly overlapped). Better than dropping it.
  const rng = mulberry32(seed);
  return {
    wx: Math.round(rng() * Math.max(0, wallW - bbox.w)),
    wy: Math.round(rng() * Math.max(0, wallH - bbox.h)),
    wr: seededRotation(seed),
  };
}

// Convenience: build the initial "existing" bounding box list from the
// curated items + the interactive decorations.
export function buildExistingBoxes(items, interactiveBoxes = []) {
  return [
    ...items.map(itemBoundingBox),
    ...interactiveBoxes,
  ];
}
