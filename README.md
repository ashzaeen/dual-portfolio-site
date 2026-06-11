<div align="center">

# Ashzaeen · Two Sides of One Person

**A single site with two souls** — a refined *Obsidian Gold* résumé for the professional world, and an *Aged Parchment* scrapbook for everything that doesn't fit on one.

Built with Next.js 14, dressed by hand, and quietly powered by Notion.

`Next.js 14` · `React 18` · `Notion CMS` · `Framer Motion` · `D3` · `PostHog`

</div>

---

## The idea

Most portfolios pick a lane: polished-and-corporate, or personal-and-playful. This one refuses to choose. It's **two complete experiences** sharing one codebase, stitched together by a single gold thread (`#c4a050`):

| | **Professional** | **Personal** |
|---|---|---|
| **Route** | `/` | `/personal` |
| **Theme** | Obsidian Gold (dark, refined) | Aged Parchment (warm, tactile) |
| **Voice** | "Here's what I've built." | "Here's who I actually am." |
| **Feel** | An editorial case-study deck | A desk full of records, postcards, and film stubs |

The whole thing is content-driven from Notion, but **degrades gracefully**: pull the plug on Notion and every section still renders from hand-written fallback data in `/data`. Nothing ever 404s.

---

## Highlights

### Professional — *Obsidian Gold*
- **Hero** with a live "right now" status line.
- **Projects & Experiences** as deep case studies, opened via App-Router **intercepting routes** (click → modal over the page; refresh → full page; both shareable).
- **Credentials** (education, certifications, coursework, curiosity) and a **Tech Stack** grid.

### Personal — *Aged Parchment*
- **Hero** — a stack of develop-in polaroids that open a draggable photo carousel.
- **Travel · _Stories from Economy Class_** — a hand-drawn **D3 world map** with pinned postcards and a "field journal" of stories.
- **Writing · _The Desk_** — an interactive desk you can poke: flick the lamp, drain the tea, lift the polaroids; pick up any scattered paper to read the full piece.
- **Music · _The Crate_** — a working **Technics-style turntable**. Drag a record onto the deck (or click), drop the needle, and it plays via the YouTube IFrame API — with liner notes and a live **Last.fm** "now playing / most played" panel.
- **Series · _The Screening Room_** — a cinema projector screen with ticket-stub navigation, spoiler-safe hot takes, and square show posters.
- **Gallery · _The Wall_** — a corkboard that opens into a fully **pannable, zoomable immersive wall**: click photos for their stories, play with the compass, the dual clock, a pinball machine, and tic-tac-toe… and hunt for the hidden easter egg. 🥚

> Yes, there are easter eggs. No, this README won't spoil them.

---

## Tech stack

| Area | Tools |
|---|---|
| **Framework** | Next.js 14 (App Router, RSC), React 18 |
| **Styling** | CSS Modules + design tokens, a touch of Tailwind |
| **Motion** | Framer Motion |
| **Maps / data-viz** | D3 + topojson-client |
| **CMS** | Notion API (`@notionhq/client` v5, data-source model) |
| **AI / enrichment** | OpenAI (slugs, palettes, photo classification, live status) |
| **Analytics** | PostHog (reverse-proxied through `/ingest`) |
| **Drag & drop** | dnd-kit (wall editor) |
| **PDF / canvas** | pdfjs-dist, sharp, @napi-rs/canvas (graduation-article render) |

---

## Architecture

Every section follows the same resilient pattern:

```
Notion DB  ──fetch──▶  lib/notion.js  ──▶  Section component
   │                        │
   │  (missing / down)      ▼
   └──────────────▶  /data/*.js  (hand-written fallback)
```

A few pieces worth knowing:

- **`lib/notion.js`** — one cache-wrapped fetcher per section, each falling back to `/data`. Pages use ISR (`revalidate = 3600` in prod, `0` in dev).
- **Image proxy** (`app/api/notion-image`) — Notion's uploaded-file URLs are signed and expire in ~1 hour. The proxy re-mints them on demand so cached pages never show broken images.
- **Section copy** — eyebrow / title / intro / instruction for each personal section live in a Notion "Sections" DB, so the words are editable without a deploy.
- **Auto-fill pipeline** (`lib/notion-autofill.mjs`) — when you tick **Needs Auto-fill** on a row, it geocodes (Nominatim), derives slugs & palettes (OpenAI), and pulls metadata (OMDb / Deezer / YouTube / image dimensions), then writes it back. Runs as a local loop *or* an on-demand Vercel route (see below).
- **Live status** (`app/api/cron/regenerate-status`) — an hourly Vercel Cron that composes the "right now" line with GPT + Open-Meteo weather.
- **Analytics** (`lib/analytics.js`) — PostHog with signature events, reverse-proxied via `next.config.mjs` rewrites so ad-blockers don't eat it.

---

## Project structure

```
app/
  (pro)/              Professional side → "/"  (+ intercepting @modal routes)
  personal/           Personal side → "/personal"  (+ @modal routes)
  api/                notion-image · notion-autofill · lastfm · cron/regenerate-status
  layout.jsx          Fonts + global providers
components/
  professional/       Hero, Projects, Experiences, Credentials, TechStack…
  personal/           Hero, Travel, Writing, Music, Series, Pinboard (The Wall)…
  shared/             Navbar, SectionHeader, SectionGuide, ViewMore, NotionImage…
data/                 Fallback content for every section (site runs without Notion)
lib/                  notion.js · notion-autofill.mjs · analytics.js · dwell.js…
scripts/              bootstrap-*  ·  check-*  ·  inspect-*  ·  watch-notion
styles/               tokens.css (both themes) · globals.css
```

---

## Getting started

**Prerequisites:** Node 18+ (20+ recommended) and npm.

```bash
git clone <repo> && cd "Personal Site"
npm install
cp .env.local.example .env.local   # then fill in what you have
npm run dev                        # http://localhost:3000
```

The site runs **immediately with zero configuration** — without a `NOTION_TOKEN` it simply serves the `/data` fallbacks. Add Notion credentials when you want live content.

---

## Environment variables

There are ~37 keys; `.env.local.example` documents each one inline. The essentials:

| Variable | Purpose |
|---|---|
| `NOTION_TOKEN` | Notion internal-integration token (enables all live content) |
| `NOTION_*_DB_ID` | One per database (roles, music, series, writing, sections, …) |
| `OPENAI_API_KEY` | Auto-fill enrichment + live status |
| `OMDB_API_KEY` / `YOUTUBE_API_KEY` | Series & music metadata (optional) |
| `LASTFM_API_KEY` / `LASTFM_USERNAME` | "Now playing / most played" panel |
| `AUTOFILL_SECRET` | Guards the on-demand auto-fill route in production |
| `CRON_SECRET` | Authorizes the live-status Vercel Cron |
| `NEXT_PUBLIC_POSTHOG_KEY` | Enables analytics |

> Every `NOTION_*_DB_ID` is optional — leave one blank and that section falls back to `/data`.

---

## Content & CMS workflow

1. **Seed the databases** — `scripts/bootstrap-*.mjs` create the rows for each section from the fallback data:
   ```bash
   node --env-file=.env.local scripts/bootstrap-sections.mjs
   ```
2. **Edit in Notion** — change any cell; the site picks it up on its next revalidation (instantly in dev, within the hour in prod).
3. **Enrich new rows** — tick **Needs Auto-fill** on a row, then either run the local watcher or click the production button:
   ```bash
   npm run watch:notion        # local polling loop
   ```
   For production (on-demand, no laptop required), see **[NOTION_AUTOFILL_PROD.md](./NOTION_AUTOFILL_PROD.md)** — a Notion button that hits `/api/notion-autofill`.
4. **Inspect / debug** — `scripts/check-notion-*.mjs` and `scripts/inspect-*-schema.mjs` print what each DB looks like.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run watch:notion` | Local auto-fill watcher loop |
| `node --env-file=.env.local scripts/bootstrap-*.mjs` | Seed a Notion DB from fallback data |
| `node --env-file=.env.local scripts/check-notion-*.mjs` | Verify a DB's schema & rows |

---

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Add the environment variables from `.env.local.example` (don't forget `AUTOFILL_SECRET` and `CRON_SECRET`).
3. Deploy. `vercel.json` registers the hourly live-status cron automatically.
4. Optional: add a **Notion button** for on-demand auto-fill per **NOTION_AUTOFILL_PROD.md**.

ISR keeps pages fast and fresh — content edits in Notion appear within the revalidation window without a rebuild.

---

## Design system

Two palettes, one thread. Defined in `styles/tokens.css` and switched with `data-theme="pro" | "personal"`:

- **Gold** `#c4a050` — the constant accent across both sides.
- **Professional** — near-black surfaces (`#0f0e0c`), warm off-white ink, a system-sans body.
- **Personal** — parchment (`#e8dfc8`), deep-brown ink, and a literary serif voice.

**Type:** Cormorant Garamond (display serif) · Lora (body) · JetBrains Mono (labels) · Caveat & Kalam (the handwritten notes on the desk and wall).

---

## Credits

Designed, written, and built by **Ashzaeen Fatmi Khan**. Every section was built from scratch — the map, the desk, the turntable, the cinema, the corkboard are all bespoke, not templates.

## License

This repository uses a split licensing strategy to keep the underlying architecture open source while protecting my personal brand, designs, and content.

**1. The Codebase (MIT License)**
The underlying source code, scripts, and structural components of this website are open-source and licensed under the **MIT License**. You are free to use, modify, and distribute the code for your own projects. Please see the `LICENSE` file in the root directory for the full text.

**2. Personal Content and Assets (CC BY-NC-ND 4.0)**
All personal content, including but not limited to text, photographs, videos, logos, illustrations, and specific UI/UX design elements, are copyrighted and licensed under the **Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License**. 

Under this license, you may not:
* Use these assets for commercial purposes.
* Remix, transform, or build upon this material.
* Redistribute the personal content without explicit attribution.

If you are using this repository as a template for your own portfolio, please remove all of my personal information, photographs, and unique design assets, and replace them with your own. 

[![CC BY-NC-ND 4.0](https://licensebuttons.net/l/by-nc-nd/4.0/88x31.png)](http://creativecommons.org/licenses/by-nc-nd/4.0/)

