export const metadata = {
  title: "Ashzaeen Fatmi Khan - Postcards & Polaroids",
  description:
    "Somewhere between a project and a polaroid. Between a research paper and a postcard. This is the side of me that doesn't fit on a resume.",
};

// Parallel route layout — renders the personal page alongside the @modal slot.
// When a /personal/travel/[slug] route is intercepted, {modal} receives
// the StoryModal; otherwise it renders null from @modal/default.jsx.
export default function PersonalLayout({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
