// Notion-shaped block constructors shared by stories.js, projects.js, experiences.js.
// Matches the Notion API block-type vocabulary exactly.

export const t = (content, ann = {}, link = null) => ({
  type: "text",
  text: { content, link: link ? { url: link } : null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default",
    ...ann,
  },
});

export const p = (richText) => ({
  type: "paragraph",
  paragraph: { rich_text: richText, color: "default" },
});

export const h1 = (richText) => ({
  type: "heading_1",
  heading_1: { rich_text: richText, color: "default", is_toggleable: false },
});

export const h2 = (richText) => ({
  type: "heading_2",
  heading_2: { rich_text: richText, color: "default", is_toggleable: false },
});

export const h3 = (richText) => ({
  type: "heading_3",
  heading_3: { rich_text: richText, color: "default", is_toggleable: false },
});

export const q = (richText, attribution) => ({
  type: "quote",
  quote: { rich_text: richText, color: "default", attribution: attribution ?? null },
});

export const callout = (emoji, richText) => ({
  type: "callout",
  callout: {
    rich_text: richText,
    icon: { type: "emoji", emoji },
    color: "gray_background",
  },
});

export const bull = (richText) => ({
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: richText, color: "default", children: [] },
});

export const num = (richText) => ({
  type: "numbered_list_item",
  numbered_list_item: { rich_text: richText, color: "default", children: [] },
});

export const todo = (richText, checked = false) => ({
  type: "to_do",
  to_do: { rich_text: richText, checked, color: "default" },
});

export const mkTable = (rows) => ({
  type: "table",
  table: {
    table_width: rows[0]?.length ?? 0,
    has_column_header: true,
    has_row_header: false,
    children: rows.map((row) => ({
      type: "table_row",
      table_row: { cells: row.map((cell) => [t(cell)]) },
    })),
  },
});

export const code = (language, source) => ({
  type: "code",
  code: {
    rich_text: [t(source)],
    language,
    caption: [],
  },
});

export const divider = () => ({ type: "divider", divider: {} });

// Image PLACEHOLDER block — carries the caption (incl. any `size:NN%` token)
// but no URL, so renderers show their placeholder box instead of an expiring
// Notion-proxied image. `placeholder` is the [ LABEL ] shown on the pro side.
export const img = (caption = [], placeholder = null) => ({
  type: "image",
  image: { type: "external", external: { url: "" }, caption, placeholder },
});

// File / PDF download-button block. `kind` is "file" or "pdf". Stable external
// URLs (e.g. Google Drive) are kept; the renderers turn this into a button
// labelled by `name` (or the caption's alignment token).
export const fileLink = (kind, name, url, caption = []) => ({
  type: kind,
  [kind]: { type: "external", external: { url }, name, caption },
});

// Multi-column layout. `cols` is an array of column block-arrays:
//   columns([[blockA], [blockB]])  →  two side-by-side columns.
export const columns = (cols = []) => ({
  type: "column_list",
  column_list: {
    children: cols.map((children) => ({
      type: "column",
      column: { children },
    })),
  },
});
