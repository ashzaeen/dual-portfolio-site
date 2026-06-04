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
