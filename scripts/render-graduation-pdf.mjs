// Pre-renders data/Graduation Article.pdf into stacked page images under
// public/writing/graduation-article/ so the writing modal can show the PDF
// as styled pages (plain <img>s on the cream background) with NO runtime PDF
// library. Re-run this whenever the source PDF changes:
//
//   node scripts/render-graduation-pdf.mjs
//
// Dev-only deps: pdfjs-dist (rasterize) + @napi-rs/canvas (Node canvas) +
// sharp (already a dep, used to encode optimized WebP).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCanvas,
  DOMMatrix,
  Path2D,
  ImageData,
} from "@napi-rs/canvas";
import sharp from "sharp";

// pdfjs expects these as globals in a DOM-less environment.
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.Path2D ??= Path2D;
globalThis.ImageData ??= ImageData;

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const root = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const SRC = path.join(root, "data", "Graduation Article.pdf");
const OUT_DIR = path.join(root, "public", "writing", "graduation-article");
const SCALE = 2; // rasterize at 2x for a crisp source, then downscale below
const MAX_WIDTH = 1400; // plenty for the ~840px modal column on retina
const WEBP_QUALITY = 76;

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source PDF not found: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const data = new Uint8Array(fs.readFileSync(SRC));
  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: path.join(
      root,
      "node_modules",
      "pdfjs-dist",
      "standard_fonts/"
    ),
    // Embedded-font-only articles render fine without system fonts.
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const pageCount = doc.numPages;
  let firstAspect = null;

  for (let n = 1; n <= pageCount; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const context = canvas.getContext("2d");
    // White paper backdrop so any transparent PDF areas aren't black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const png = canvas.toBuffer("image/png");
    const outPath = path.join(OUT_DIR, `page-${n}.webp`);
    await sharp(png)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);

    if (n === 1) firstAspect = viewport.width / viewport.height;
    const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
    console.log(`  page ${n}/${pageCount} → page-${n}.webp (${kb} KB)`);
    page.cleanup();
  }

  console.log("\nDone.");
  console.log(`pageCount: ${pageCount}`);
  console.log(`aspect (w/h): ${firstAspect.toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
