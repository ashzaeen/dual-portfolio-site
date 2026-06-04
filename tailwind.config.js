/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Personal side (CSS variable)
        bg: "var(--bg)",
        ink: "var(--ink)",
        // Pro side (hardcoded, matches Gemini snippets exactly)
        obsidian: "#0f0e0c",
        surface: "#1a1814",
        gold: "#c4a050",
        "gold-dim": "rgba(196,160,80,0.15)",
        // Legible muted gold for eyebrow labels / secondary text (HASH, ROLE
        // categories, education eyebrows, footer caption). gold-dim at 0.15 is
        // intentionally faded for borders; this is its text-readable sibling.
        "gold-muted": "rgba(196,160,80,0.65)",
        text: "#ede8df",
        "text-dim": "rgba(237,232,223,0.5)",
      },
      fontFamily: {
        serif: "var(--font-serif)",
        body: "var(--font-body)",
        hand: "var(--font-hand)",
        mono: "var(--font-mono)",
      },
    },
  },
  plugins: [],
};
