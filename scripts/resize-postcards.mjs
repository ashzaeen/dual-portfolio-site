// Resize every file in /Postcards into /Postcards/optimized/ at a size +
// quality tuned for the actual on-screen postcard footprint (~200px wide
// on the carousel rail, ~520px at the location-card and modal). Source
// originals are untouched — this writes side-by-side so you can re-upload
// the optimized copies to B2 with the same filenames.
//
//   Long edge → 1280px (max). Roughly 3× the largest display footprint
//                    so retina displays stay crisp; downscaling stops
//                    being aggressive enough to introduce sampling noise.
//   JPEG → quality 85, mozjpeg encoder. Visually lossless at this size.
//   PNG  → re-encoded with palette/zlib compression; quality unchanged.
//
// Run:
//   node scripts/resize-postcards.mjs
//
// Idempotent: re-running overwrites the /optimized output. Safe.

import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "Postcards");
const OUT = path.resolve(SRC, "optimized");
const LONG_EDGE = 1280;
const JPEG_QUALITY = 85;

await fs.mkdir(OUT, { recursive: true });

const files = (await fs.readdir(SRC)).filter((f) =>
  /\.(jpg|jpeg|png|webp)$/i.test(f)
);

let totalSrc = 0;
let totalOut = 0;

for (const f of files) {
  const srcPath = path.join(SRC, f);
  const outPath = path.join(OUT, f);
  const srcStat = await fs.stat(srcPath);
  totalSrc += srcStat.size;

  const ext = path.extname(f).toLowerCase();
  let pipeline = sharp(srcPath, { failOn: "none" }).rotate().resize({
    width: LONG_EDGE,
    height: LONG_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (ext === ".png") {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  let info = await pipeline.toFile(outPath);

  // Edge case: already-well-compressed sources (typically small PNGs)
  // can come out larger after re-encoding. Fall back to a verbatim copy
  // so the optimized folder is always ≤ the source.
  let fellBack = false;
  if (info.size > srcStat.size) {
    await fs.copyFile(srcPath, outPath);
    info = { ...info, size: srcStat.size };
    fellBack = true;
  }
  totalOut += info.size;

  const pct = ((1 - info.size / srcStat.size) * 100).toFixed(0);
  const fmt = (n) => `${(n / 1024).toFixed(0)} KB`;
  const tag = fellBack ? " (kept original)" : "";
  console.log(
    `  ✓ ${f.padEnd(28)} ${fmt(srcStat.size).padStart(8)} → ${fmt(info.size).padStart(8)}  (-${pct}%, ${info.width}×${info.height})${tag}`
  );
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const totalPct = ((1 - totalOut / totalSrc) * 100).toFixed(0);
console.log(
  `\nTotal: ${mb(totalSrc)} → ${mb(totalOut)}  (-${totalPct}%, ${files.length} files)`
);
console.log(`Output: ${OUT}`);
console.log("\nNext step: re-upload the files in Postcards/optimized/ to B2,");
console.log("overwriting the originals at cdn.ashzaeen.com/postcards/.");
