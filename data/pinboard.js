// ─────────────────────────────────────────────────────────────
// Pinboard data — wall items, static positions, mobile rows.
// Authored alongside the immersive wall design (`Pinboard (3).html`).
// Paths point at /public/pinboard-photos/...; rename in lockstep
// if you change file names there.
// ─────────────────────────────────────────────────────────────

export const WALL_W = 3700;
export const WALL_H = 2600;

// Slugify: strip diacritics, lowercase, collapse non-alphanumerics to "-".
function slugify(str) {
  return String(str || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Derive a stable, shareable slug from a gallery item's TITLE (label),
// e.g. "Cox Bazar · The Beach" → "cox-bazar-the-beach". Falls back to the
// image filename, then the item id, if a title yields nothing. SHARED by the
// client (PinboardSection pushes this on open) and the server (lib/notion
// resolves it), so both must use this one helper or deep links won't match.
export function gallerySlug(item) {
  const fromTitle = slugify(item?.label);
  if (fromTitle) return fromTitle;
  try {
    const path = String(item?.src || "").split(/[?#]/)[0];
    const base = decodeURIComponent(path.substring(path.lastIndexOf("/") + 1));
    const fromFile = slugify(base.replace(/\.[a-z0-9]+$/i, ""));
    if (fromFile) return fromFile;
  } catch {
    /* fall through to id */
  }
  return item?.id || "";
}

// `dH` is the rendered display HEIGHT in px on the immersive wall;
// width is derived from w/h aspect. The static board scales `dH` by
// ~0.8 (or ~0.65 on small screens) to fit inside the section frame.
export const ITEMS = [
  {
    id: "yjhd",
    type: "poster",
    src: "/pinboard-photos/posters/yjhd-poster.png",
    w: 1024, h: 1536, dH: 460, mount: "tape",
    label: "YJHD · Winter '24",
    poem: "“Yeh Jawaani Hai Deewani” — this youth is wild, and it won't be young again.",
    story: "Freshman winter break. I sublet my dorm, pocketed the rent, packed one backpack, and booked the cheapest flights I could find. Ohio, Pennsylvania, New York City, Tampa, Vegas, Utah — sleeping on family couches and acquaintances' guest rooms. No itinerary. Just youth and a very light bag.",
    wx: 300, wy: 175, wr: 3,
  },
  {
    id: "znmd",
    type: "poster",
    src: "/pinboard-photos/posters/znmd-poster.png",
    w: 1024, h: 1536, dH: 460, mount: "tape",
    label: "ZNMD · Summer '25",
    poem: "“Zindagi Na Milegi Dobara” — life won't come this way again.",
    story: "After high school, we all scattered — different universities, different countries. Sophomore summer, we came back. Pabna, Rajshahi, Panchagarh, Cox Bazar — the boys trip every boys group dreams about. Exactly like the movie.",
    wx: 560, wy: 155, wr: -4,
  },
  {
    id: "bd_group",
    type: "photo",
    src: "/pinboard-photos/bd-friends-whole-group.png",
    w: 1040, h: 781, dH: 285, mount: "pin", pinColor: "#c4a050",
    label: "The Squad",
    story: "The whole gang on the stairs. Dhanmondi, winter coats, far too much collective confidence. The last time most of us were in the same city before flying back to our separate universities. This photo always makes me want to go home.",
    wx: 1680, wy: 215, wr: 4,
  },
  {
    id: "sylhet",
    type: "photo",
    src: "/pinboard-photos/cousins-sylhet.jpg",
    w: 2651, h: 3999, dH: 375, mount: "pin", pinColor: "#6b9b65",
    label: "Ratargul",
    story: "A wooden boat, a canopy of roots, and nowhere else to be. Ratargul Swamp Forest, Sylhet. The water was impossibly still. We barely spoke for an hour.",
    wx: 2150, wy: 200, wr: -3,
  },
  {
    id: "boys_suit",
    type: "photo",
    src: "/pinboard-photos/us-friends-boys-suit.png",
    w: 1079, h: 1432, dH: 375, mount: "pin", pinColor: "#c4a050",
    label: "Suited Up",
    story: "Some nights in Arlington, you put on a suit just because you can. The dock, the dark water, everyone looking like they belong in a movie. The kind of evening that starts with no plan and ends with a photo you'll keep forever.",
    wx: 1290, wy: 200, wr: -5,
  },
  {
    id: "cox_beach",
    type: "photo",
    src: "/pinboard-photos/bd-friends-cox.jpg",
    w: 3977, h: 3024, dH: 285, mount: "pin", pinColor: "#5b7fa3",
    label: "Cox Bazar · The Beach",
    story: "The Bay of Bengal at night, all of us in the frame. We were studying abroad on separate continents — but for one summer, we came back and lived it exactly like ZNMD.",
    wx: 760, wy: 720, wr: -7,
  },
  {
    id: "cox_table",
    type: "photo",
    src: "/pinboard-photos/bd-friends-cox-2.jpg",
    w: 4032, h: 3024, dH: 285, mount: "pin", pinColor: "#5b7fa3",
    label: "Cox Bazar · The Table",
    story: "Pabna, Rajshahi, Panchagarh, Cox Bazar — one summer, all of us together again. We came home from different continents for this. The late-night table, the food, the laughing until someone cried.",
    wx: 290, wy: 730, wr: 6,
  },
  {
    id: "cousins",
    type: "photo",
    src: "/pinboard-photos/cousins.jpg",
    w: 3648, h: 2736, dH: 285, mount: "pin", pinColor: "#a85f42",
    label: "Eid '25",
    story: "Every Eid feels different. This one felt like exactly what it should be — everyone in one room, dressed up, a little too loud, genuinely happy.",
    wx: 1620, wy: 720, wr: 3,
  },
  {
    id: "colorado",
    type: "photo",
    src: "/pinboard-photos/us-colorado.png",
    w: 1080, h: 952, dH: 320, mount: "pin", pinColor: "#6b9b65",
    label: "White Sands, NM",
    story: "14 hours driving from Dallas. We took turns at the wheel, argued about the playlist, stopped at White Sands on the way back. Someone looked down at the right moment. Seven shadows on white sand.",
    wx: 290, wy: 1170, wr: -4,
  },
  {
    id: "boshonto",
    type: "photo",
    src: "/pinboard-photos/us-friends-whole-group.jpg",
    w: 2177, h: 3052, dH: 375, mount: "pin", pinColor: "#c4a050",
    label: "Boshontoboron",
    story: "বসন্তবরণ in Arlington — the Bengali spring festival, 8,000 miles from Dhaka. Salwar kameez, string lights, and everyone a little homesick and a little bit home at the same time.",
    wx: 730, wy: 1140, wr: 5,
  },
  {
    id: "nobo",
    type: "photo",
    src: "/pinboard-photos/us-friends.jpg",
    w: 4896, h: 3672, dH: 285, mount: "pin", pinColor: "#c4a050",
    label: "Noboborsho",
    story: "নববর্ষ — Bengali New Year, celebrated properly. The people who make every timezone feel like home.",
    wx: 1180, wy: 1150, wr: -6,
  },
  {
    id: "family",
    type: "photo",
    sub: "aged",
    src: "/pinboard-photos/family.png",
    w: 864, h: 1050, dH: 355, mount: "tape", pinColor: "#a85f42",
    label: "Home",
    story: "The one that lives on my debit card. Cox Bazar beach, sometime in the early 2000s. Dad, Mom, me in the blue shirt, my brother in the striped one. I carry this photo everywhere — literally.",
    wx: 1680, wy: 1130, wr: 7,
  },
  { id: "frontier", type: "boarding-pass", mount: "tape", wx: 2150, wy: 760, wr: -12 },
  { id: "subway",   type: "receipt",       mount: "pin",  wx: 200, wy: 880, wr: 15  },
];

// Positions + sizes of the non-photo interactive elements. Single source of
// truth used by (a) the placement algorithm to avoid overlap when adding
// Notion-driven photos, and (b) the minimap to render distinct dots for
// these "things you can interact with" so users see them on the radar.
//
// Coordinates correspond to the rendered top-left of each decoration on
// the wall. Widths/heights are approximate visible footprints (slightly
// generous so placement gives them a bit of breathing room).
export const INTERACTIVE_BOXES = [
  { id: "compass",    x: 970,  y: 180,  w: 100, h: 100, kind: "interactive" },
  { id: "clock",      x: 180,  y: 460,  w: 100, h: 112, kind: "interactive" },
  { id: "pinball",    x: 1000, y: 290,  w: 220, h: 360, kind: "interactive" },
  { id: "tictactoe",  x: 1330, y: 740,  w: 240, h: 340, kind: "interactive" },
  { id: "easter_egg", x: 3440, y: 2350, w: 30,  h: 30,  kind: "egg" },
];

// Static-board (section preview) positions inside the 1600px-wide frame.
export const SPOS = {
  yjhd:      { x: 22,   y: 85,   rot: -3 },
  znmd:      { x: 362,  y: 65,   rot: 4  },
  sylhet:    { x: 720,  y: 76,   rot: -2 },
  boys_suit: { x: 1005, y: 68,   rot: -5 },
  cox_beach: { x: 22,   y: 590,  rot: -7 },
  cox_table: { x: 445,  y: 604,  rot: 5  },
  cousins:   { x: 875,  y: 593,  rot: 3  },
  bd_group:  { x: 22,   y: 923,  rot: 4  },
  boshonto:  { x: 460,  y: 916,  rot: 5  },
  nobo:      { x: 775,  y: 928,  rot: -6 },
  colorado:  { x: 22,   y: 1248, rot: -4 },
  family:    { x: 436,  y: 1255, rot: 7  },
  frontier:  { x: 780,  y: 1238, rot: -8 },
  subway:    { x: 1068, y: 1250, rot: 15 },
};

// Mobile flex-rows fallback (≤ 1100px in the static section preview only).
// Immersive wall stays draggable on touch — this is just for the inline preview.
export const FLEX_ROWS = [
  ["yjhd", "znmd"],
  ["boys_suit", "sylhet", "bd_group"],
  ["cox_beach", "cox_table", "cousins"],
  ["frontier", "subway"],
  ["colorado", "boshonto", "nobo", "family"],
];

export const PHOTOS_FOR_COMPASS = ITEMS.filter(
  (i) => i.type === "photo" || i.type === "poster"
);

export const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
