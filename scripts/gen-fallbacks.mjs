// Regenerates the data/*.js fallback constants from scripts/_notion-dump.json
// (produced by dump-notion.mjs). Block bodies are emitted as clean
// _notion-helpers calls; Notion-proxy image/media URLs are dropped to
// placeholders while stable external/CDN/local URLs are kept. Existing file
// scaffolding (imports, derived exports, comments) is preserved via brace-aware
// replacement of just the targeted `export const NAME = <literal>;`.
import { readFileSync, writeFileSync } from "node:fs";

const D = JSON.parse(readFileSync("scripts/_notion-dump.json", "utf8")).out;
const ROOT = "data/";

/* ── primitive serialization ─────────────────────────────────────────────── */
const str = (s) => JSON.stringify(String(s ?? ""));
const ident = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : str(k));
const PAD = (n) => "  ".repeat(n);
const cleanUrl = (u) =>
  typeof u === "string" && u.startsWith("/api/notion-image") ? null : u || null;

// Generic literal serializer for plain JSON-ish data (no helper calls).
function lit(v, ind = 0) {
  if (v === null || v === undefined) return "null";
  const tp = typeof v;
  if (tp === "number") return Number.isFinite(v) ? String(v) : "null";
  if (tp === "boolean") return String(v);
  if (tp === "string") return str(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const simple = v.every(
      (x) => x === null || ["number", "string", "boolean"].includes(typeof x)
    );
    if (simple) return "[" + v.map((x) => lit(x)).join(", ") + "]";
    return "[\n" + v.map((x) => PAD(ind + 1) + lit(x, ind + 1)).join(",\n") + "\n" + PAD(ind) + "]";
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return "{}";
  return (
    "{\n" +
    keys.map((k) => PAD(ind + 1) + ident(k) + ": " + lit(v[k], ind + 1)).join(",\n") +
    "\n" + PAD(ind) + "}"
  );
}

function objLit(entries, ind) {
  if (!entries.length) return "{}";
  return (
    "{\n" +
    entries.map(([k, vs]) => PAD(ind + 1) + ident(k) + ": " + vs).join(",\n") +
    "\n" + PAD(ind) + "}"
  );
}
function arrOfObjs(strs, ind) {
  if (!strs.length) return "[]";
  return "[\n" + strs.map((s) => PAD(ind + 1) + s).join(",\n") + "\n" + PAD(ind) + "]";
}

/* ── Notion blocks → _notion-helpers call strings ────────────────────────── */
const DEF_KEYS = ["bold", "italic", "strikethrough", "underline", "code"];
function annStr(a = {}) {
  const o = [];
  for (const k of DEF_KEYS) if (a[k]) o.push(`${k}: true`);
  if (a.color && a.color !== "default") o.push(`color: ${str(a.color)}`);
  return o.length ? `{ ${o.join(", ")} }` : null;
}
function tCall(rt) {
  const content = rt.plain_text ?? rt.text?.content ?? "";
  const ann = annStr(rt.annotations);
  const link = rt.text?.link?.url ?? rt.href ?? null;
  if (link) return `t(${str(content)}, ${ann || "{}"}, ${str(link)})`;
  if (ann) return `t(${str(content)}, ${ann})`;
  return `t(${str(content)})`;
}
const rtArr = (arr = []) => `[${arr.map(tCall).join(", ")}]`;
const plain = (arr = []) => arr.map((x) => x.plain_text ?? x.text?.content ?? "").join("");

function blockStr(b) {
  switch (b.type) {
    case "paragraph": return `p(${rtArr(b.paragraph.rich_text)})`;
    case "heading_1": return `h1(${rtArr(b.heading_1.rich_text)})`;
    case "heading_2": return `h2(${rtArr(b.heading_2.rich_text)})`;
    case "heading_3": return `h3(${rtArr(b.heading_3.rich_text)})`;
    case "quote": {
      const a = b.quote.attribution;
      return `q(${rtArr(b.quote.rich_text)}${a ? `, ${str(a)}` : ""})`;
    }
    case "callout": return `callout(${str(b.callout.icon?.emoji ?? "✦")}, ${rtArr(b.callout.rich_text)})`;
    case "bulleted_list_item": return `bull(${rtArr(b.bulleted_list_item.rich_text)})`;
    case "numbered_list_item": return `num(${rtArr(b.numbered_list_item.rich_text)})`;
    case "to_do": return `todo(${rtArr(b.to_do.rich_text)}, ${b.to_do.checked ? "true" : "false"})`;
    case "code": return `code(${str(b.code.language || "plain text")}, ${str(plain(b.code.rich_text))})`;
    case "divider": return `divider()`;
    case "table": {
      const rows = (b.table.children || []).map(
        (r) => "[" + r.table_row.cells.map((c) => str(plain(c))).join(", ") + "]"
      );
      return `mkTable([${rows.join(", ")}])`;
    }
    case "image": return `img(${rtArr(b.image.caption || [])})`;
    case "file":
    case "pdf": {
      const d = b[b.type];
      const url = cleanUrl(d.external?.url || d.file?.url || null);
      if (!url) return null;
      return `fileLink(${str(b.type)}, ${str(d.name || "")}, ${str(url)}, ${rtArr(d.caption || [])})`;
    }
    case "column_list": {
      const cols = (b.column_list.children || []).map((col) => {
        const kids = (col.column?.children || []).map(blockStr).filter(Boolean);
        return "[" + kids.join(", ") + "]";
      });
      return `columns([${cols.join(", ")}])`;
    }
    default:
      return null; // unsupported / unknown
  }
}
function blocksArr(bs, ind) {
  const items = (bs || []).map(blockStr).filter(Boolean);
  if (!items.length) return "[]";
  return "[\n" + items.map((s) => PAD(ind + 1) + s).join(",\n") + "\n" + PAD(ind) + "]";
}

/* ── brace-aware replacement of `export const NAME = <rhs>;` ──────────────── */
function replaceExport(src, name, newRhs) {
  const re = new RegExp(`export const ${name}\\s*=\\s*`);
  const m = re.exec(src);
  if (!m) throw new Error(`export ${name} not found`);
  const start = m.index + m[0].length;
  let i = start, depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === ";" && depth === 0) break;
  }
  return src.slice(0, start) + newRhs + src.slice(i);
}

const HELPERS_IMPORT =
  'import { t, p, h1, h2, h3, q, callout, bull, num, todo, mkTable, code, divider, img, fileLink, columns } from "./_notion-helpers.js";';
function fixHelpersImport(src) {
  return src.replace(
    /import\s*\{[^}]*\}\s*from\s*["']\.\/_notion-helpers(?:\.js)?["'];?/,
    HELPERS_IMPORT
  );
}

function writeFile(name, mutate) {
  const path = ROOT + name;
  let src = readFileSync(path, "utf8");
  src = mutate(src);
  writeFileSync(path, src);
  console.log("✓ " + name);
}

/* ── transforms ──────────────────────────────────────────────────────────── */
const projMedia = (m) =>
  m.type === "youtube"
    ? { type: "youtube", videoId: m.videoId, placeholder: m.placeholder || m.alt || "VIDEO" }
    : { type: "image", placeholder: m.placeholder || m.alt || "IMAGE" };

function projectStr(pr, ind) {
  return objLit(
    [
      ["slug", lit(pr.slug, ind + 1)],
      ["title", lit(pr.title, ind + 1)],
      ["category", lit(pr.category, ind + 1)],
      ["award", lit(pr.award ?? null, ind + 1)],
      ["summary", lit(pr.summary, ind + 1)],
      ["techStack", lit(pr.techStack, ind + 1)],
      ["media", lit(pr.media.map(projMedia), ind + 1)],
      ["links", lit(pr.links, ind + 1)],
      ["body", blocksArr(pr.body, ind + 1)],
    ],
    ind
  );
}
function experienceStr(e, ind) {
  return objLit(
    [
      ["slug", lit(e.slug, ind + 1)],
      ["kind", lit(e.kind, ind + 1)],
      ["category", lit(e.category, ind + 1)],
      ["role", lit(e.role, ind + 1)],
      ["organization", lit(e.organization, ind + 1)],
      ["date", lit(e.date, ind + 1)],
      ["techStack", lit(e.techStack, ind + 1)],
      ["body", blocksArr(e.body, ind + 1)],
    ],
    ind
  );
}
function storyStr(s, ind) {
  const media = s.media.map((m) => ({
    id: m.id,
    type: m.type,
    src: cleanUrl(m.src) ?? m.src ?? "",
    alt: m.alt,
    durationMs: m.durationMs,
  }));
  return objLit(
    [
      ["id", lit(s.id, ind + 1)],
      ["locationId", lit(s.locationId, ind + 1)],
      ["title", lit(s.title, ind + 1)],
      ["date", lit(s.date, ind + 1)],
      ["coverGradient", lit(s.coverGradient || "", ind + 1)],
      ["photoUrl", lit(cleanUrl(s.photoUrl), ind + 1)],
      ["locationLabel", lit(s.locationLabel || "", ind + 1)],
      ["media", lit(media, ind + 1)],
      ["blocks", blocksArr(s.blocks, ind + 1)],
    ],
    ind
  );
}
function pieceStr(w, ind) {
  return objLit(
    [
      ["id", lit(w.id, ind + 1)],
      ["title", lit(w.title, ind + 1)],
      ["type", lit(w.type, ind + 1)],
      ["publication", lit(w.publication || "", ind + 1)],
      ["date", lit(w.date || "", ind + 1)],
      ["excerpt", lit(w.excerpt || "", ind + 1)],
      ["featured", lit(!!w.featured, ind + 1)],
      ["position", lit(w.position ?? null, ind + 1)],
      ["pos", lit(w.pos ?? null, ind + 1)],
      ["rotation", lit(w.rotation ?? 0, ind + 1)],
      ["z", lit(w.z ?? 0, ind + 1)],
      ["pages", lit(w.pages ?? 1, ind + 1)],
      ["tags", lit(w.tags || [], ind + 1)],
      ["blocks", blocksArr(w.blocks, ind + 1)],
    ],
    ind
  );
}

/* ── section copy merge (personal keys ← personal fetch, pro keys ← pro) ──── */
function sectionCopy() {
  const out = {};
  const sc = D.sectionCopy, pc = D.proSectionCopy, ph = D.personalHero;
  for (const k of ["travel", "writing", "music", "series", "gallery"]) out[k] = sc[k];
  out["personal-hero"] = { eyebrow: ph.eyebrow, title: "", intro: ph.intro };
  for (const k of ["projects", "experiences", "experiences-extra", "credentials", "techstack"]) {
    out[k] = { eyebrow: pc[k].eyebrow, title: pc[k].title, intro: pc[k].intro };
  }
  return out;
}

/* ── write everything ────────────────────────────────────────────────────── */
writeFile("roles.js", (s) => replaceExport(s, "FALLBACK_ROLES", lit(D.roles, 0)));

writeFile("status.js", (s) =>
  replaceExport(
    s,
    "FALLBACK_HERO_STATUS",
    lit({ text: D.heroStatus.text, generatedAt: null, schedule: null, tz: null }, 0)
  )
);

writeFile("hero.js", (s) => {
  s = replaceExport(s, "FALLBACK_HERO_CONFIG", lit(D.heroConfig, 0));
  s = replaceExport(s, "FALLBACK_HERO_CHIPS", lit(D.heroChips, 0));
  s = replaceExport(s, "FALLBACK_HERO_STATS", lit(D.heroStats, 0));
  s = replaceExport(s, "FALLBACK_HERO_TICKER", lit(D.heroTicker, 0));
  return s;
});

writeFile("sections.js", (s) => replaceExport(s, "FALLBACK_SECTION_COPY", lit(sectionCopy(), 0)));

writeFile("footer.js", (s) => {
  s = replaceExport(s, "FALLBACK_FOOTER_PRO", lit(D.proFooter.config, 0));
  s = replaceExport(s, "FALLBACK_FOOTER_PERSONAL", lit(D.personalFooter.config, 0));
  s = replaceExport(s, "FALLBACK_FOOTER_SOCIALS", lit(D.proFooter.socials, 0));
  return s;
});

writeFile("credentials.js", (s) => {
  const cr = D.credentials;
  const coursework = cr.coursework.map((c) => {
    const o = { name: c.name, provider: c.provider, category: c.category, link: c.link ?? null };
    if (c.linkLabel) o.linkLabel = c.linkLabel;
    o.insight = c.insight || "";
    return o;
  });
  s = replaceExport(s, "FALLBACK_EDUCATION", lit(cr.education, 0));
  s = replaceExport(s, "FALLBACK_CERTIFICATIONS", lit(cr.certifications, 0));
  s = replaceExport(s, "FALLBACK_COURSEWORK", lit(coursework, 0));
  s = replaceExport(s, "FALLBACK_CURIOSITY", lit(cr.curiosity, 0));
  return s;
});

writeFile("techstack.js", (s) =>
  replaceExport(
    s,
    "FALLBACK_TECHSTACK",
    lit(D.techstack.map((c) => ({ name: c.name, side: c.side, skills: c.skills })), 0)
  )
);

writeFile("songs.js", (s) =>
  replaceExport(
    s,
    "FALLBACK_SONGS",
    lit(
      D.songs.map((m) => ({
        id: m.id, ytId: m.ytId ?? null, title: m.title, artist: m.artist, album: m.album,
        year: m.year ?? null, genre: m.genre ?? null, note: m.note || "",
        accent: m.accent ?? null, cover: cleanUrl(m.cover),
        snippetStart: m.snippetStart ?? 0, snippetEnd: m.snippetEnd ?? null,
      })),
      0
    )
  )
);

writeFile("shows.js", (s) =>
  replaceExport(
    s,
    "FALLBACK_SHOWS",
    lit(D.shows.map((sh) => ({ ...sh, poster: cleanUrl(sh.poster) })), 0)
  )
);

writeFile("desk.js", (s) => {
  const dk = D.desk;
  const desk = {
    polaroids: dk.polaroids.map((pl, i) => ({
      id: `polaroid-${i + 1}`,
      src: cleanUrl((pl.src || "").trim()) ?? "",
      caption: pl.caption || "",
      alt: pl.alt || "",
    })),
    pinnedNote: dk.pinnedNote,
    indexCard: dk.indexCard,
    hiddenNotes: dk.hiddenNotes,
  };
  return replaceExport(s, "FALLBACK_DESK", lit(desk, 0));
});

writeFile("locations.js", (s) =>
  replaceExport(
    s,
    "LOCATIONS",
    lit(
      D.travel.locations.map((l) => ({
        id: l.id, city: l.city, country: l.country, year: l.year, note: l.note || "",
        coords: l.coords, region: l.region, ratio: l.ratio, photo: l.photo || "",
        photoUrl: cleanUrl(l.photoUrl), regionGroup: l.regionGroup,
        regionOrder: l.regionOrder, regionFlag: l.regionFlag, carousel: !!l.carousel,
      })),
      0
    )
  )
);

writeFile("stories.js", (s) => {
  s = fixHelpersImport(s);
  const storyEntries = Object.values(D.travel.storiesBySlug).map((st) => [st.id, storyStr(st, 1)]);
  s = replaceExport(s, "STORIES", objLit(storyEntries, 0));
  s = replaceExport(s, "LOCATION_STORIES", lit(D.travel.locationStories, 0));
  return s;
});

writeFile("projects.js", (s) => {
  s = fixHelpersImport(s);
  return replaceExport(s, "FALLBACK_PROJECTS", arrOfObjs(D.projects.map((p) => projectStr(p, 1)), 0));
});

writeFile("experiences.js", (s) => {
  s = fixHelpersImport(s);
  return replaceExport(
    s,
    "FALLBACK_EXPERIENCES",
    arrOfObjs(D.experiences.map((e) => experienceStr(e, 1)), 0)
  );
});

// pieces.js: this file defines its OWN local block helpers (rt/p/h2/img/...)
// with different signatures. Swap that whole block for the shared
// _notion-helpers import, then regenerate FALLBACK_PIECES. The night-changes
// `pdf` field is dropped — withPdfArticles re-attaches it at runtime.
writeFile("pieces.js", (s) => {
  const importBlock =
    HELPERS_IMPORT + "\n\n/* ── Pieces ─────────────────────────────────────────────── */\n";
  s = s.replace(
    /\/\* ── Notion-block mock helpers[\s\S]*?export const FALLBACK_PIECES/,
    importBlock + "export const FALLBACK_PIECES"
  );
  const pieces = D.writing.map((w) => {
    const { pdf, _lastEdited, _order, ...rest } = w;
    return rest;
  });
  return replaceExport(s, "FALLBACK_PIECES", arrOfObjs(pieces.map((w) => pieceStr(w, 1)), 0));
});

console.log("\nDone.");
