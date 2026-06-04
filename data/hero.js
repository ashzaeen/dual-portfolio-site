// Hero atom fallbacks for the Professional side.
//
// Each export mirrors a future Notion DB (see reference_notion_cms memory):
//   FALLBACK_HERO_CONFIG  → "Hero Config" single-row DB
//   FALLBACK_HERO_CHIPS   → "Hero Role Chips" DB
//   FALLBACK_HERO_STATS   → "Hero Stats" DB
//   FALLBACK_HERO_TICKER  → "Hero Ticker Logs" DB
//
// Live Status (the cycling "human note" sentence) is shared between the
// Pro and Personal heroes — its array + timing helpers stay in data/status.js.

export const FALLBACK_HERO_CONFIG = {
  name: "Ashzaeen Fatmi Khan",
  email: "afk6801@mavs.uta.edu",
  resumeUrl: "https://drive.google.com/file/d/1EIzVP6niZ4TPFFtkkcMmezY0fyy1R-yU/view?usp=sharing",
  locationLabel: "Dallas Fort Worth, TX",
  locationCoords: "32.8998° N, 97.0403° W"
};

export const FALLBACK_HERO_CHIPS = ["Junior @ UTA", "Developer", "Researcher"];

export const FALLBACK_HERO_STATS = [
  {
    label: "ACADEMICS",
    line1: "CS Major + Math Minor",
    line2: "@UT Arlington"
  },
  {
    label: "RESEARCH FOCUS",
    line1: "VLA AI Research",
    line2: "@Robotic Vision Lab"
  },
  {
    label: "LATEST ACHIEVEMENT",
    line1: "Presented Research Poster",
    line2: "@CRA Conference"
  }
];

export const FALLBACK_HERO_TICKER = ["> INITIALIZING_SYSTEM_CORE... [OK]", "> LOADING_MERN_STACK... [OK]", "> OPTIMIZING_ARM_ASSEMBLY_REGISTERS... [OK]", "> CHECKING_RYZEN_9_8945HS_THERMALS... [STABLE]", "> VERIFYING_RVL_RESEARCH_CREDENTIALS... [AUTHENTICATED]", "> FETCHING_UTA_ACADEMIC_RECORDS... [SUCCESS]"];
