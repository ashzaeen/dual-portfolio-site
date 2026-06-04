/* Fallback series data — used when NOTION_TOKEN or NOTION_SERIES_DB_ID
   is missing, or when the Notion API call fails. Shape must match what
   `mapShowRow` in /lib/notion.js produces.

   Notion "Series" DB schema (live source of truth):
     Name           Title
     Slug           Rich text  — auto-derived from Name (lowercase ASCII)
     Type           Select     — "Movie" | "Series" (defaults to Series). Movies
                                  show "Movie" in place of season/episode counts;
                                  OMDb auto-fill looks them up as films.
     Status         Status     — site gate ("Published" only renders)
     Order          Number     — render order, ascending
     Seasons        Number     — (Series only)
     Episodes       Number     — (Series only)
     Runtime        Rich text  — e.g. "47 min avg"
     Years          Rich text  — e.g. "2008–2013" or "2022–"
     Genres         Multi-select
     Verdict        Rich text  — e.g. "Rewatch Yearly"
     Show Status    Select     — COMPLETED | ONGOING | ABANDONED
     Hot Take       Rich text  — spoiler-blurred copy, up to ~2000 chars
     BG Color       Rich text  — hex like "#1a2810"
     Accent Color   Rich text  — hex like "#7ac050"
     Button Label   Rich text  — optional CTA label
     Button URL     URL        — optional CTA link
     Poster URL     URL        — original OMDb poster (auto-filled, rectangular ~2:3)
     Poster Square URL URL     — IMDb-CDN square crop of poster (auto-filled)
     Poster Media   Files & media — square poster shown on the cinema screen; first
                                  file wins. Empty → monogram-slide fallback.
     Needs Auto-fill Checkbox  — triggers OMDb + vision auto-fill
*/

export const FALLBACK_SHOWS = [
  {
    id: "game-of-thrones",
    title: "Game of Thrones",
    type: "Series",
    seasons: 8,
    episodes: 74,
    runtime: "57 min avg",
    years: "2011–2019",
    genres: ["Action", "Adventure", "Drama"],
    verdict: "All 7 Seasons Are Awesome",
    status: "COMPLETED",
    hot: "Firstly, there’s no Season 8. Secondly, no other show has ever made me care this much about fictional political borders. This show has no actual main characters, and absolutely no heroes. Just deeply grey people doing whatever it takes to survive their own decisions.",
    bg: "#180c0a",
    accentColor: "#c06840",
    buttonLabel: "Whole Show Summed Up In One Song",
    buttonUrl: "https://www.youtube.com/watch?v=NXZEW7s_sqg",
    poster: null
  },
  {
    id: "the-prestige",
    title: "The Prestige",
    type: "Movie",
    seasons: 0,
    episodes: 0,
    runtime: "2h 10m",
    years: "Oct 2006",
    genres: ["Sci Fi", "Drama", "Mystery"],
    verdict: "Nolan's Best Puzzle",
    status: "COMPLETED",
    hot: "Nolan explains the trick in the first five minutes, and you still fall for it. It doesn't rely on CGI — just really good writing and two guys completely destroying their lives to outdo each other. Every single rewatch reveals another layer of foreshadowing that makes you feel ridiculous for missing it.",
    bg: "#080d15",
    accentColor: "#7888d0",
    buttonLabel: null,
    buttonUrl: null,
    poster: null
  },
  {
    id: "big-bang-theory",
    title: "Big Bang Theory",
    type: "Series",
    seasons: 12,
    episodes: 280,
    runtime: "22 min avg",
    years: "2007–2019",
    genres: ["Comedy", "Romance"],
    verdict: "Pure Comfort Watch",
    status: "COMPLETED",
    hot: "I know people keep saying Friends is better, but honestly, this one just feels easy and cozy. After an 8 hour shift, I don't want prestige drama. I just want to watch nerds eat Chinese takeout on a couch. PS: This may or may not have contributed to me pursuing engineering.",
    bg: "#0c1a1f",
    accentColor: "#50b8c8",
    buttonLabel: "This Table Read Made Me Cry",
    buttonUrl: "https://www.youtube.com/watch?v=BfUEwWqOVow",
    poster: null
  },
  {
    id: "shark-tank",
    title: "Shark Tank",
    type: "Series",
    seasons: 17,
    episodes: 0,
    runtime: "15 min avg",
    years: "2009–",
    genres: ["Family", "Game-Show", "Reality-TV"],
    verdict: "Dinner Table Staple",
    status: "COMPLETED",
    hot: "The ultimate turn-your-brain-off show. You get to laugh at someone pitching the worst invention you've ever heard, and then immediately question your own life choices when a 15 yo casually breaks down their million dollar revenue stream. I genuinely learn more about equity here than from lectures.",
    bg: "#0f1520",
    accentColor: "#6a88b8",
    buttonLabel: null,
    buttonUrl: null,
    poster: null
  },
  {
    id: "yeh-jawaani-hain-deewani",
    title: "Yeh Jawaani Hain Deewani",
    type: "Movie",
    seasons: 0,
    episodes: 0,
    runtime: "2h 40m",
    years: "May 2013",
    genres: ["Romance", "Drama", "Feel Good"],
    verdict: "The Blueprint",
    status: "COMPLETED",
    hot: "I am fully aware this movie is why I spent winter break sleeping on random couches across six states. It romanticizes the chaotic, no-itinerary trip perfectly. Flawless blend of romance, comedy, friendship & melodrama with banger songs.",
    bg: "#1a1008",
    accentColor: "#c4a050",
    buttonLabel: "Solo Trip Anthem",
    buttonUrl: "https://www.youtube.com/watch?v=fdubeMFwuGs",
    poster: null
  },
  {
    id: "utshob",
    title: "Utshob",
    type: "Movie",
    seasons: 0,
    episodes: 0,
    runtime: "1h 53m",
    years: "Jun 2025",
    genres: ["Comedy", "Drama", "Feel Good"],
    verdict: "Hits Too Close",
    status: "COMPLETED",
    hot: "The storytelling couldn’t have been more beautiful — could’ve watched an hour longer. Underneath various layers the film has, the message is simple: it’s never too late to reconnect with your people. Sometimes you just have to maybe make a call.",
    bg: "#1a2810",
    accentColor: "#7ac050",
    buttonLabel: "The Soundtrack Grows On You",
    buttonUrl: "https://www.youtube.com/watch?v=g--Z6tk-GZA",
    poster: null
  }
];
