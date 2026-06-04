import { notion } from "@/lib/notion";

// Notion-hosted images (uploaded Files & media, and `file`-type image blocks)
// are served behind pre-signed AWS URLs that expire ~1h after they're minted.
// Baking those URLs into ISR-cached HTML means a stale page can point at a dead
// link. This proxy fixes that by keeping a STABLE url in the markup
// (/api/notion-image?b=<blockId> or ?p=<pageId>&prop=<name>&i=<idx>) and
// re-minting a fresh signed URL server-side on every CDN cache miss, then
// streaming the bytes. The image bytes (not the expiring link) are what the
// CDN caches, so once warm a cover survives regardless of signature expiry.
export const runtime = "nodejs";

// Edge-cache the bytes for a day (refresh in the background for a week) so the
// route — and Notion — are hit at most ~once/day per image. A block's image can
// be swapped in Notion, so this isn't `immutable`; updates propagate within a
// day.
const CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

// Resolve a fresh, currently-valid Notion URL from the stable ref in the query.
async function resolveFreshUrl(searchParams) {
  const blockId = searchParams.get("b");
  if (blockId) {
    const block = await notion.blocks.retrieve({ block_id: blockId });
    // image blocks, plus uploaded file/pdf blocks (download/link buttons).
    return (
      block?.image?.file?.url || block?.image?.external?.url ||
      block?.file?.file?.url || block?.file?.external?.url ||
      block?.pdf?.file?.url || block?.pdf?.external?.url ||
      null
    );
  }

  const pageId = searchParams.get("p");
  const prop = searchParams.get("prop");
  const index = Number.parseInt(searchParams.get("i") ?? "0", 10) || 0;
  if (pageId && prop) {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const file = page?.properties?.[prop]?.files?.[index];
    return file?.file?.url || file?.external?.url || null;
  }

  return null;
}

export async function GET(request) {
  // No Notion client (env unset) → 404 so the client falls back to placeholder.
  if (!notion) return new Response(null, { status: 404 });

  const { searchParams } = new URL(request.url);

  try {
    const url = await resolveFreshUrl(searchParams);
    if (!url) return new Response(null, { status: 404 });

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (err) {
    console.error("[notion-image] proxy failed:", err.message);
    // 502 (not a hard error page) → the <img> onError handler swaps in the
    // gradient/placeholder fallback instead of showing a broken icon.
    return new Response(null, { status: 502 });
  }
}
