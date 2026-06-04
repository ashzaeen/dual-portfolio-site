/* Fallback section copy — used when NOTION_TOKEN or NOTION_SECTIONS_DB_ID is
   missing, or when the Notion call fails. Each key matches the (lowercased)
   Name/title of a row in the "Section Copy" DB.

   Notion "Sections" DB schema (live source of truth):
     Name                Title       — section key. Personal: travel | writing | music |
                                  series | gallery | personal-hero. Professional:
                                  projects | experiences | experiences-extra |
                                  credentials | techstack.
                                  (personal-hero uses Introduction as the bio line;
                                   pro rows use Eyebrow/Title/Introduction only.)
     Eyebrow             Rich text   — small uppercase label (the ✦ is added by the UI)
     Title               Rich text   — the section's display name
     Introduction        Rich text   — italic flavor line under the title
     Instruction         Rich text   — the mono "how to use this section" guide line (desktop)
     Mobile Instruction  Rich text   — phone-specific guide line; falls back to Instruction
     Status              Status      — only "Published" rows are read (Draft is ignored)

   Optional (not in the DB yet): "Mobile Introduction" — a shorter phone intro;
   falls back to Introduction when absent.

   `eyebrow` here is the plain word (no ✦) — the star is decoration drawn by the
   component, so the CMS value stays clean. */

export const FALLBACK_SECTION_COPY = {
  travel: {
    eyebrow: "Travel",
    title: "Stories from Economy Class",
    intro: "Practical traveler. Economy flights, nice shots, fun stories and honest observations.",
    introMobile: "Practical traveler. Economy flights, nice shots, fun stories and honest observations.",
    instruction: "Click a pin to see the postcard, then hit “View Stories” to swipe through the trip.",
    instructionMobile: "Tap a pin to see the postcard, then click “View Stories” to swipe through the trip. Hit “Pause” to stop autocycling."
  },
  writing: {
    eyebrow: "Writing",
    title: "The Desk",
    intro: "Technical, journalistic, and personal — scattered exactly the way I left them.",
    introMobile: "Technical, journalistic, and personal — scattered exactly the way I left them.",
    instruction: "Click a paper to read it. You can also play with the lamp, tea, and polaroids.",
    instructionMobile: "Tap a paper to read it. You can also play with the lamp and polaroids."
  },
  music: {
    eyebrow: "Music",
    title: "The Crate",
    intro: "Songs I keep coming back to.",
    introMobile: "Songs I keep coming back to.",
    instruction: "Click or drag a record onto the player and hit play.",
    instructionMobile: "Tap a record to load it onto the player, then hit play."
  },
  series: {
    eyebrow: "Series",
    title: "The Screening Room",
    intro: "What I've watched, with honest verdicts.",
    introMobile: "What I've watched, with honest verdicts.",
    instruction: "Click any ticket to load the show.",
    instructionMobile: "Tap any ticket to load the show."
  },
  gallery: {
    eyebrow: "Gallery",
    title: "The Wall",
    intro: "Everything I carry with me.",
    introMobile: "Everything I carry with me.",
    instruction: "Click a photo for the story behind it, or open Immersive View to explore the wall.",
    instructionMobile: "Tap a photo for the story behind it, or open Immersive View to explore the wall."
  },
  "personal-hero": {
    eyebrow: "Personal",
    title: "",
    intro: "Somewhere between a research paper and a postcard. Between a project and a polaroid. This is the side of me that doesn't fit on a resume."
  },
  projects: {
    eyebrow: "The Schematics",
    title: "Projects",
    intro: "Click any card to open the full project writeup. Press Escape or click the X to go back."
  },
  experiences: {
    eyebrow: "The GitHub Commits",
    title: "Experiences",
    intro: "Click any card to expand it and read more. Click it again, or anywhere outside, to collapse it."
  },
  "experiences-extra": {
    eyebrow: "Beyond the Terminal",
    title: "Extracurriculars",
    intro: ""
  },
  credentials: {
    eyebrow: "The Knowledge Base",
    title: "Credentials",
    intro: "Press / to search across this section. Hover over any item in the Curiosity panel to see what I learned from it."
  },
  techstack: {
    eyebrow: "The Knowledge Graph",
    title: "Tech Stack",
    intro: "Drag nodes to rearrange, click to explore. In a rush? Just toggle over to the List view."
  }
};
