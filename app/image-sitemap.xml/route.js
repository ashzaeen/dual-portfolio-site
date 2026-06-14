import { fetchProjects, fetchGalleryItems } from "@/lib/notion";

export const revalidate = 3600;

const BASE = "https://www.ashzaeen.com";

function abs(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${BASE}${url}` : url;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [projects, gallery] = await Promise.allSettled([
    fetchProjects(),
    fetchGalleryItems(),
  ]).then((r) => r.map((x) => (x.status === "fulfilled" ? x.value : [])));

  const entries = [];

  // Project cover images → their canonical case-study page
  for (const p of projects ?? []) {
    if (!p.slug || !p.coverMedia?.src) continue;
    const imgUrl = abs(p.coverMedia.src);
    if (!imgUrl) continue;
    entries.push({
      loc: `${BASE}/projects/${p.slug}`,
      images: [{ loc: imgUrl, title: esc(p.title), caption: esc(p.summary) }],
    });
  }

  // Gallery photos → their shareable gallery page
  for (const item of gallery ?? []) {
    if (!item.slug || !item.src) continue;
    const imgUrl = abs(item.src);
    if (!imgUrl) continue;
    entries.push({
      loc: `${BASE}/personal/gallery/${item.slug}`,
      images: [{ loc: imgUrl, title: esc(item.label ?? "") }],
    });
  }

  const rows = entries.map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
${e.images
  .map(
    (img) =>
      `    <image:image>\n      <image:loc>${img.loc}</image:loc>${
        img.title ? `\n      <image:title>${img.title}</image:title>` : ""
      }${
        img.caption ? `\n      <image:caption>${img.caption}</image:caption>` : ""
      }\n    </image:image>`
  )
  .join("\n")}
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
