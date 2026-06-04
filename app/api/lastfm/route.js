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
    return art ? art.replace("100x100bb", "600x600bb") : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const username = process.env.LASTFM_USERNAME;

  if (!apiKey || !username) {
    return Response.json({ track: null });
  }

  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${username}&api_key=${apiKey}&limit=1&format=json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Last.fm ${res.status}`);
    const data = await res.json();

    const track = data.recenttracks?.track?.[0];
    if (!track) return Response.json({ track: null });

    const nowPlaying = track["@attr"]?.nowplaying === "true";
    const images = track.image ?? [];
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
      (await fetchItunesArt(track.name, track.artist?.["#text"] ?? ""));

    return Response.json({
      track: {
        name: track.name,
        artist: track.artist?.["#text"] ?? "",
        album: track.album?.["#text"] ?? "",
        image,
        nowPlaying,
        playedAt: nowPlaying ? null : (track.date?.uts ? parseInt(track.date.uts) * 1000 : null),
        url: track.url ?? null,
      },
    });
  } catch (e) {
    console.error("[lastfm]", e.message);
    return Response.json({ track: null });
  }
}
