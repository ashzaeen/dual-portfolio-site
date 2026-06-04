export const dynamic = "force-dynamic";

async function fetchItunesArt(title, artist) {
  try {
    const q = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${q}&entity=musicTrack&limit=1&media=music`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const art = data.results?.[0]?.artworkUrl100;
    return art ? art.replace("100x100bb", "300x300bb") : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const apiKey = process.env.LASTFM_API_KEY;
  const username = process.env.LASTFM_USERNAME;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7day";
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10) || 5, 10);

  if (!apiKey || !username) {
    return Response.json({ tracks: [] });
  }

  try {
    const url =
      `https://ws.audioscrobbler.com/2.0/?method=user.getTopTracks` +
      `&user=${username}&api_key=${apiKey}&period=${period}&limit=${limit}&format=json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Last.fm ${res.status}`);
    const data = await res.json();

    const raw = data.toptracks?.track ?? [];

    const tracks = await Promise.all(
      raw.map(async (t) => {
        const images = t.image ?? [];
        const rawImage =
          images.find((i) => i.size === "extralarge")?.["#text"] ||
          images.find((i) => i.size === "large")?.["#text"] ||
          null;

        const lfmImage =
          rawImage && !rawImage.includes("2a96cbd8b46e442fc41c2b86b821562f")
            ? rawImage
            : null;

        const image =
          lfmImage ||
          (await fetchItunesArt(t.name, t.artist?.name ?? ""));

        return {
          name: t.name,
          artist: t.artist?.name ?? "",
          playcount: parseInt(t.playcount ?? "0", 10),
          image,
          url: t.url ?? null,
        };
      })
    );

    return Response.json({ tracks });
  } catch (e) {
    console.error("[lastfm/top]", e.message);
    return Response.json({ tracks: [] });
  }
}
