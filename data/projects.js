import { t, p, h1, h2, h3, q, callout, bull, num, todo, mkTable, code, divider, img, fileLink, columns } from "./_notion-helpers.js";

export const FALLBACK_PROJECTS = [
  {
    slug: "visionscout",
    title: "VisionScout",
    category: "Hardware / AI",
    award: "🏆 HackUTD: Best Hardware",
    summary: "A bridge between what you see and want. AI glasses auto-generate listings with condition reports, and an AI gives you Spotify-level recommendations for homes and cars that fit your vibe.",
    techStack: ["React", "Python", "Flask", "TypeScript", "Custom SDK"],
    media: [
      {
        type: "youtube",
        videoId: "9z8L_u_UNNw",
        placeholder: "VisionScout_YT_Demo"
      },
      {
        type: "image",
        placeholder: "VisionScout_Landing_Page"
      },
      {
        type: "image",
        placeholder: "VisionScout_Listing_Page"
      },
      {
        type: "image",
        placeholder: "VisionScout_AI_Chatbot"
      },
      {
        type: "image",
        placeholder: "VisionScout_Light_Mode"
      },
      {
        type: "image",
        placeholder: "VisionScout_Smart_Glasses"
      }
    ],
    links: [],
    body: [
      q([t("See Smarter. Decide Faster.", { bold: true })]),
      h1([t("Inspiration")]),
      p([t("Every car or property listing you see online is written by someone trying to describe what they saw — and every buyer is left trying to imagine what’s real.")]),
      p([t("We thought: "), t("Why are listings still manually written in 2025?", { bold: true })]),
      p([t("What if your glasses could do the listing for you — detecting condition, estimating confidence, and automatically generating a full summary? And what if you could then talk to an AI assistant that understood your preferences and taste — giving you Spotify-level recommendations for homes or cars that fit your vibe, budget, and lifestyle?")]),
      p([t("That’s how VisionScout was born: a bridge between what your eyes see and what your heart wants — where visual data meets personalized discovery.")]),
      h1([t("What it does")]),
      p([t("VisionScout is a unified AI system that turns short videos from smart glasses into rich, structured listings and also provides personalized AI recommendations that perfectly match your preferences.")]),
      h2([t("Property Mode", { bold: true })]),
      bull([t("Detects:", { bold: true }), t(" Wall damage, appliances, flooring, and room dimensions.")]),
      bull([t("Action:", { bold: true }), t(" Generates a condition confidence score and automatically builds a structured listing.")]),
      h2([t("Car Mode", { bold: true })]),
      bull([t("Detects:", { bold: true }), t(" Dents, scratches, tire wear, windshield damage, and the vehicle's make and model.")]),
      bull([t("Action:", { bold: true }), t(" Applies lighting and angle normalization to keep results consistent.")]),
      h2([t("User Experience", { bold: true })]),
      p([t("Once visual data is in the system:")]),
      bull([t("Users can search, toggle, and sort between Car and Property listings.")]),
      bull([t("They can describe their dream car or home "), t("(e.g., “a 2-bedroom apartment with bright lighting in Frisco” or “a red SUV under 30k”)", { italic: true }), t(" — and VisionScout’s agentic AI matches real listings using a weighted similarity algorithm.")]),
      bull([t("Each result comes with an AI-derived condition score, benchmarked against comparable market data (Zillow + Cars.com).")]),
      p([t("The Result:", { bold: true }), t(" A personalized, intelligent experience that automates trust.")]),
      h1([t("Tech Stack & Architecture")]),
      p([t("Our build combined full-stack web development, AI reasoning, and data automation — all working together seamlessly.")]),
      bull([t("Frontend:", { bold: true }), t(" Built with React.js, TypeScript, and Tailwind CSS. The interface is fully responsive across mobile and desktop. The sleek chat UI and listings grid were designed for clarity, interactivity, and quick data visualization.")]),
      bull([t("Backend:", { bold: true }), t(" Designed and implemented RESTful APIs in Python, using Flask to bridge the AI agent backend with the frontend in real time. The server handles request parsing, AI query dispatching, and structured data delivery.")]),
      bull([t("AI & Data Layer:", { bold: true }), t(" The agent was built using LangGraph, integrating Gemini 2.5 Pro for natural-language reasoning and intent understanding. Real-estate listings were fetched dynamically using the Zillow API, while car data was scraped with Selenium and BeautifulSoup4 from Cars.com. A custom merge-score algorithm ranked results by trust, value, and relevance.")]),
      bull([t("Hardware:", { bold: true }), t(" We programmed the smart glasses using Python and Flask for detecting defects in cars and walls, as well as vehicle make, integrating Gemini 2.5 Pro for automated debugging.")]),
      p([t("Together, these components form a cohesive agentic system connecting intelligent reasoning with live, data-driven discovery.")]),
      h1([t("Challenges we ran into")]),
      p([t("This project tested everything — from teamwork to hardware to data engineering.")]),
      h2([t("First Hackathon for Most of Us:", { bold: true }), t(" ")]),
      p([t("Three of our team members were completely new to hackathons. Navigating the 24-hour sprint, juggling roles, merging code, and learning to prioritize under pressure was a huge challenge — but also our biggest teacher.")]),
      h2([t("Hardware Hurdles:", { bold: true })]),
      bull([t("The smart glasses provided were brand new and came with sensor and antenna issues. We had to manually recalibrate the antennas to keep all sensors functional.")]),
      bull([t("The SDK itself was partially broken. Several bugs required us to modify the libraries directly, and documentation was sparse since the hardware was so new.")]),
      bull([t("The default online API for the glasses was extremely slow, so we trained our own AI detection model locally to ensure smooth inference.")]),
      h2([t("Backend & Data Struggles:", { bold: true })]),
      bull([t("We didn’t receive certain sponsor API keys, making data integration tricky. We improvised by pulling data from the Zillow API and scraping Cars.com to populate our recommendation system.")]),
      bull([t("The entire pipeline had to be built from scratch — from cleaning the data to syncing it with our detection outputs.")]),
      p([t("Despite these hurdles, we successfully delivered a fully functional end-to-end system.")]),
      h1([t("Accomplishments we’re proud of")]),
      bull([t("Building a real, working demo that goes from vision → AI detection → automated listing → AI recommendations.")]),
      bull([t("Designing a clean, production-ready frontend with toggles, filters, and a conversational AI.")]),
      bull([t("Training our own computer vision model to bypass SDK/API limitations.")]),
      bull([t("Creating an AI condition scoring system that generalizes across both vehicles and properties.")]),
      bull([t("Developing a recommendation engine that feels personal, natural, and explainable.")]),
      h1([t("What we learned")]),
      bull([t("How to coordinate a project from zero under extreme time constraints.")]),
      bull([t("The power of data normalization for consistent AI scoring.")]),
      bull([t("How to blend agentic AI, computer vision, and user-centric design to solve real-world problems.")]),
      bull([t("That hardware, software, and communication all need to work in sync — just like a team.")]),
      h1([t("What’s next for VisionScout")]),
      bull([t("Partner APIs", { bold: true }), t(" for auto dealers (Toyota, Carvana) and real-estate firms (CBRE, Zillow).")]),
      bull([t("Native mobile app", { bold: true }), t(" for real-time scanning and listing uploads.")]),
      bull([t("Smarter AI models", { bold: true }), t(" trained on user preferences for even better personalization.")]),
      bull([t("Expansion", { bold: true }), t(" into insurance inspections, rental evaluations, and condition auditing.")]),
      bull([t("Long-term:", { bold: true }), t(" Making VisionScout the standard AI layer that understands the condition, value, and potential of everything you see.")]),
      h1([t("VisionScout – Automating Trust in Vision"), t(" ", { bold: true })]),
      q([t("Because what your eyes see — and what your heart wants — should work together.", { bold: true })]),
      p([])
    ]
  },
  {
    slug: "portfolio-site",
    title: "Portfolio Site",
    category: "Web App",
    award: null,
    summary: "A site with two souls. An Obsidian Gold professional résumé that seamlessly flips into a nostalgic, interactive scrapbook full of travel maps, polaroids, and vinyl records.",
    techStack: ["React", "Next.js", "Tailwind", "Framer", "Cloudflare"],
    media: [
      {
        type: "image",
        placeholder: "PersonalSite_Personal_Landing_Page"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Professional_Landing_Page"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Travel"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Travel 2"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Writing"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Writing 2"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Music"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Series"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Gallery"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Gallery 2"
      },
      {
        type: "image",
        placeholder: "PersonalSite_TechStack"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Projects"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Experiences"
      },
      {
        type: "image",
        placeholder: "PersonalSite_Credentials"
      }
    ],
    links: [],
    body: [
      h1([t("Inspiration")]),
      p([t("Most portfolios force you to pick a lane: are you polished-and-corporate, or playful-and-personal? I completely refused to choose, but I also knew I had to respect my audience.")]),
      p([t("The core design philosophy was built around a harsh truth: "), t("recruiters and hiring managers are in a rush.", { bold: true }), t(" They don't have time to play a web based video game just to find out if I know Python or React. The professional side had to be blazing fast, dead simple to navigate, and immediately scannable. All the content needed to be right there, zero friction.")]),
      p([t("But for the personal side, I threw the rules out the window. I leaned heavily into tactile, skeuomorphic, and nostalgic aesthetics—using physical metaphors like travel maps, vintage desk, vinyl records, and corkboards. I wanted every button and interaction to be meticulously crafted. I actually baked in subtle, indirect nudges throughout the professional side to tempt visitors to toggle over to the personal side. Once they get there, it’s a sandbox.")]),
      h1([t("What It Does")]),
      p([t("That’s how this site was born: "), t("two complete experiences", { bold: true }), t(" sharing one codebase, stitched together by a single gold thread ("), t("#c4a050", { code: true }), t(").")]),
      h2([t("Professional Mode")]),
      p([t("Designed for speed and clarity. No fluff, just facts.")]),
      bull([t("Hero Section:", { bold: true }), t(" Features a live \"right now\" status line to show exactly what I'm up to. This is architected by firing a Vercel Cron job every hour, which takes my current schedule and location from Notion, fuses it with live local weather (Open-Meteo) and the time, and feeds it to the OpenAI API. The generated line is then "), t("written back", { italic: true }), t(" into Notion as a cache so visitors read it instantly without ever triggering a fresh API call on page load.")]),
      bull([t("Tech Stack:", { bold: true }), t("  Built with the rushed recruiter in mind, this section offers three distinct toggles. A physics-based "), t("Graph view", { bold: true }), t(" and a structured "), t("Architecture view", { bold: true }), t("—both rendered with D3.js as a live force-simulation of interactive, draggable nodes (charge, link, and centering forces holding the layout together)—alongside a simple "), t("List view", { bold: true }), t(" so a hiring manager can verify my MERN, Python, or Java experience in exactly three seconds.")]),
      bull([t("Projects & Experiences: ", { bold: true }), t(" Devpost inspired case studies with deep dives into the architecture, challenges, and code behind what I've built. They open via App-Router "), t("intercepting routes", { bold: true }), t(" for seamless modal overlays that share URLs perfectly (click → modal; refresh → full page; both shareable). The case-study bodies are authored entirely in Notion and rendered through a custom block engine that handles headings, tables, quotes, copy-able code blocks, lightbox images, and file/link buttons.")]),
      bull([t("Credentials:", { bold: true }), t(" A holistic look at my learning - covering my university education, official certifications, extra coursework, and even the self taught skills from YouTube.")]),
      h2([t("Personal Mode")]),
      p([t("A playground of physical metaphors. Every interaction and button was very thoughtfully designed with the parchment theme in mind. ")]),
      bull([t("The Hero:", { bold: true }), t(" A stack of develop-in polaroids that open into a draggable, swipe-able photo carousel.")]),
      bull([t("Stories from Economy Class (Travel):", { bold: true }), t(" A hand-drawn "), t("D3 + topojson", { bold: true }), t(" world map populated with pinned postcards. It slowly "), t("auto-pans and zooms between regions", { bold: true }), t(" on its own (hover or tap to pause and lock a pin), with markers plotted from real lat/long coordinates that the content pipeline geocodes automatically. Each story opens through an intercepting route as a stacked, shareable modal, and a \"field journal\" book collects every stop.")]),
      bull([t("The Desk (Writing):", { bold: true }), t(" An interactive desk where you can flick the lamp, drain a cup of tea, lift polaroids, and pick up scattered papers to read my full written pieces. The polaroids overlap, are rotated, and live in a 3D-transformed scene, so I drive hover detection with real "), t("pointer geometry", { bold: true }), t(" ("), t("elementsFromPoint", { code: true }), t(") instead of naïve hit-boxes—whatever pixel is actually under your cursor is what lifts. Picking up a paper opens a reader that renders the piece from Notion blocks, drop cap and image lightbox included.")]),
      bull([t("The Crate (Music):", { bold: true }), t(" A fully working, Technics-style turntable. You physically drag a record onto the deck, drop the needle, and play music via the YouTube IFrame API. The trick that makes it feel real: the moment you pick a record, the track is "), t("silently buffered in the background", { bold: true }), t(" (muted, then parked paused), so hitting play is "), t("instant", { italic: true }), t("—no loading lag. It features a 33⅓/45 speed switch with a swinging tonearm, liner notes pulled from Notion, and a live Last.fm panel showing what I'm currently listening to.")]),
      bull([t("The Screening Room (Series):", { bold: true }), t(" A cinema projector with velvet-curtain transitions between titles, ticket-stub navigation, and a spoiler-safe blur toggle for hot takes. The genuinely fun part is automated: drop a show's name in Notion and the pipeline pulls episode/runtime metadata from "), t("OMDb", { bold: true }), t(", then asks "), t("GPT-4o-mini vision", { bold: true }), t(" to look at the poster and derive a matching background + accent color palette for that show's card.")]),
      bull([t("The Wall (Gallery):", { bold: true }), t(" A corkboard that opens into a fully "), t("pannable, zoomable", { bold: true }), t(" immersive canvas, with one unified gesture system handling mouse, touch, trackpad, and pinch (plus momentum). A radar "), t("minimap", { bold: true }), t(" keeps you oriented while you explore self-contained toys—a compass, a dual clock, a "), t("physics-driven pinball machine", { bold: true }), t(", and tic-tac-toe—and hunt for hidden easter eggs (complete with confetti). New photos are dropped onto the board by an "), t("auto-placement algorithm", { bold: true }), t(" that packs them in without overlapping the currently curated photos, and a hidden in-browser editor (built on "), t("dnd-kit", { code: true }), t(") lets me reposition everything by hand. ")]),
      h1([t("Tech Stack, Architecture & Constraints", { bold: true })]),
      bull([t("Frontend:", { bold: true }), t(" Built with Next.js 14 (App Router, RSC), React 18, and Tailwind CSS, brought to life with Framer Motion. Data visualizations use D3 + "), t("topojson-client", { code: true }), t(".")]),
      bull([t("CMS & Resilient Data Layer:", { bold: true }), t(" The site is powered by the Notion API ("), t("@notionhq/client", { code: true }), t(" v5). Crucially, every section falls back to hand-written data in a local "), t("/data", { code: true }), t(" folder if Notion is unreachable—nothing ever 404s. On top of that, even the section copy (eyebrows, titles, intros, instructions) is editable from a Notion database, so the wording changes without a deploy.")]),
      bull([t("Zero-Latency Pre-Rendering:", { bold: true }), t(" Every page—including dozens of individual story, project, and gallery pages—is "), t("statically pre-rendered at build time", { bold: true }), t(" so visitors never wait on a server round-trip. The catch is that this would normally hammer Notion's rate limit during the build, so I added a build-only request-dedup layer that fetches each database exactly once and shares it across every page. ISR keeps it all fresh afterward.")]),
      bull([t("The Data & Delivery Layer:", { bold: true }), t(" To keep costs down while ensuring lightning-fast global delivery, I paired "), t("Backblaze", { bold: true }), t(" with "), t("Cloudflare", { bold: true }), t("—Cloudflare's edge network serves assets on-demand with near-zero latency.")]),
      bull([t("Calculated AI & API Usage:", { bold: true }), t(" LLMs and external APIs are expensive, so the site only calls them when absolutely necessary—OpenAI for auto-generating slugs, color palettes, photo classifications, and the live hourly status line.")]),
      bull([t("Analytics:", { bold: true }), t(" PostHog, reverse-proxied through "), t("/ingest", { code: true }), t(" so ad-blockers don't drop the events.")]),
      h1([t("Challenges I ran into")]),
      p([t("This build was an exercise in balancing opposing forces and testing the limits of front-end interactivity.")]),
      bull([t("The Dual-UX Problem:", { bold: true }), t(" Building a site that is simultaneously a rigid, highly accessible professional document "), t("and", { italic: true }), t(" a chaotic, draggable, interactive sandbox was an architectural nightmare. State between the two \"souls\" had to be perfectly isolated.")]),
      bull([t("The Notion Image Expiration Problem:", { bold: true }), t(" Notion's uploaded-file URLs expire in roughly an hour. To fix it, I built a custom image proxy ("), t("app/api/notion-image", { code: true }), t(") that keeps a stable URL in the markup and re-mints the signed link on demand, so cached pages never show broken images (or broken download buttons).")]),
      bull([t("The Instant-Playback Problem:", { bold: true }), t(" YouTube's player has a real buffer delay, which kills the illusion of a physical record player. Solving it meant pre-buffering each track silently the instant it's selected, then resuming from that buffer on play.")]),
      bull([t("Content Automation:", { bold: true }), t(" Manually updating data is exhausting. I wrote an auto-fill pipeline ("), t("lib/notion-autofill.mjs", { code: true }), t(") that geocodes locations via Nominatim, pulls metadata from OMDb/YouTube/Deezer, and enriches data with OpenAI before writing it all back to Notion—runnable as a local watcher or fired on-demand from a Notion button in production.")]),
      bull([t("Optimizing the Sandbox:", { bold: true }), t(" Figuring out how to guide users to interact with everything on the personal side—without plastering \"CLICK HERE\" everywhere—took a lot of meticulous UX iteration.")]),
      bull([t("Building a Resilient Fallback:", { bold: true }), t(" Ensuring every single component could gracefully switch from the live Notion API to the local "), t("/data", { code: true }), t(" folder without breaking the UI took serious architectural planning.")]),
      h1([t("Accomplishments I'm proud of", { bold: true })]),
      bull([t("Building a completely bespoke, interactive UI from scratch—the map, the desk, the turntable, the cinema, and the corkboard are all hand crafted, not templates.")]),
      bull([t("Downloading, curating and writing massive amounts of content to fill the entire site while still ensuring it feels honest and personal. Many thing may or may not be vibe-written.")]),
      bull([t("An intelligent Vercel Cron job ("), t("app/api/cron/regenerate-status", { code: true }), t(") that uses GPT and Open-Meteo weather to dynamically write my \"right now\" status line every hour and cache it back into Notion.")]),
      bull([t("Letting AI design "), t("for", { italic: true }), t(" me—GPT-4o-mini reads each show's poster and TV/film metadata to generate its color palette, so a new addition styles itself.")]),
      bull([t("A complex drag-and-drop immersive wall ("), t("dnd-kit", { code: true }), t(" + a custom auto-placement algorithm) that feels natural and fun to play with.")]),
      bull([t("Pre-rendering the entire site for zero visitor latency while keeping the Notion-powered build comfortably under the API's rate limit.")]),
      bull([t("Crafting a UI that seamlessly transitions between an editorial corporate deck and a nostalgic, skeuomorphic desk environment.")]),
      h1([t("What I learned", { bold: true })]),
      bull([t("How to become AI-Native:", { bold: true }), t(" I used Claude Code throughout the entire build to accelerate development, while constantly bouncing ideas off Gemini to deeply understand concepts and brainstorm architecture.")]),
      bull([t("Full-cycle Solo Engineering:", { bold: true }), t(" I learned to architect, design, build, test, deploy, and analyze an end-to-end project from scratch—wearing every hat: designer, writer, coder, tester, and analyst.")]),
      bull([t("How to master Next.js 14 App Router features—specifically intercepting routes and React Server Components—for complex shared-URL UI states.")]),
      bull([t("The profound importance of edge networks and CDNs in modern web performance.")]),
      bull([t("The power of D3 + "), t("topojson-client", { code: true }), t(" for building custom, hand-drawn data visualizations.")]),
      bull([t("How to blend a headless CMS (Notion) with AI automation to create a site that practically manages itself.")]),
      bull([t("How to design UI interactions that are discoverable through natural curiosity rather than explicit instructions.")]),
      bull([t("That you don't have to compromise personality for professionalism—you just have to organize them properly.")]),
      h1([t("What's next", { bold: true })]),
      bull([t("Expanding the personal side to include 2 more sections: a finance section which tracks my Robinhood investments live and a guestbook where users could leave comments.")]),
      bull([t("Adding more interactive desk objects and tactile elements to the Aged Parchment theme.")]),
      bull([t("Continuing to hide incredibly obscure easter eggs across the site. (And no, I'm still not spoiling where the current ones are.)")])
    ]
  }
];

export const PROJECTS_BY_SLUG = Object.fromEntries(
  FALLBACK_PROJECTS.map((proj) => [proj.slug, proj])
);
