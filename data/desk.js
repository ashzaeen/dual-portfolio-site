/* Fallback "desk decor" data — used when NOTION_DESK_DB_ID is missing or
   the Notion call fails. Shape must match what fetchDesk() in /lib/notion.js
   produces.

   Notion "Desk" DB schema (live source of truth):
     Name        Title       — descriptive label (e.g. "Polaroid — Dhaka")
     Type        Select      — polaroid | pinned-note | index-card | hidden-notes
     Status      Status      — site gate ("Published" only renders)
     Order       Number      — polaroid: 1=left, 2=right
                              hidden-notes: 1=left page, 2=right page
                              index-card: stack order
     Image URL   URL         — polaroid only (relative /public path or full URL)
     Caption     Rich text   — polaroid: under-image caption
                              pinned-note: byline
                              hidden-notes: optional page heading (handwritten, larger)
     Alt         Rich text   — polaroid: a11y description
     Text        Rich text   — pinned-note: quote body
                              index-card: lines
                              hidden-notes: page body lines
                              (use Shift+Enter inside the field for newlines)

   Polaroids are square-cropped via object-fit:cover with object-position:center top.
   Hidden-notes left page renders in handwritten italic; right page in serif italic.
*/

export const FALLBACK_DESK = {
  polaroids: [
    {
      id: "polaroid-1",
      src: "/polaroids/fa68183d-c458-43e0-aa24-3aae3a29845d.jpg",
      caption: "2008",
      alt: "A nostalgic, gently faded photo of my dad holding me in his arms"
    },
    {
      id: "polaroid-2",
      src: "/polaroids/b75f2735-9712-44db-89c8-63f8e92442f9.jpg",
      caption: "2009",
      alt: "A sunlit close up portrait of me, probably the cutest I’ve ever been"
    }
  ],
  pinnedNote: {
    lines: ["“Count your blessings,", "Not your flaws”"],
    byline: "pinned 11/21"
  },
  indexCard: {
    lines: ["- sensors lie politely", "- tea in flask", "- write slow path first", "- stars always align"]
  },
  hiddenNotes: {
    left: {
      heading: "To-do —",
      lines: ["· apply to internships", "· finish DSA practice", "· call Ammu", "· buy tea"]
    },
    right: {
      heading: "Notes —",
      lines: ["Congrats on discovering this!", "“good design feels easy”", "— remember to put this somewhere"]
    }
  }
};
