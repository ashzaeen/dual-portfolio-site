// Footer fallbacks. Mirrors the 3-DB Notion shape:
//   Footer Pro:        single-row config for the professional-side footer
//   Footer Personal:   single-row config for the personal-side footer
//   Footer Socials:    multi-row, shared by both sides
//
// Pro and Personal each carry their own copy of shared-but-scalar fields
// (Avatar Letter, Footer Name, Bottom Tagline). User maintains in two
// places if they want them perfectly identical. Trade-off documented in
// project_pro_cms_rollout.md.

export const FALLBACK_FOOTER_PRO = {
  avatarLetter: "A",
  footerName: "Ashzaeen Fatmi Khan",
  quote: "Currently accepting offers for sleep, but will settle for a great engineering role.",
  bottomTagline: "Powered by Tea & Insomnia",
  sideLabel: "PROFESSIONAL",
  stampTitle: "[ High School Website ]",
  stampSubtitle: "Maple Leaf International School",
  stampCaption: "Class of 2023",
  stampUrl: "https://ashzaeen.super.site/"
};

export const FALLBACK_FOOTER_PERSONAL = {
  avatarLetter: "A",
  footerName: "Ashzaeen Fatmi Khan",
  quote: "What Am I Without My Nostalgia?",
  bottomTagline: "Powered by Tea & Insomnia",
  sideLabel: "Personal",
  stampTitle: "High School Website",
  stampSubtitle: "Maple Leaf International School",
  stampCaption: "Class of 2023",
  stampUrl: "https://ashzaeen.super.site/"
};

// `icon` is a kebab key looked up in each component's local icon map
// (pro uses inline SVGs, personal uses react-icons). Unknown keys render
// a generic globe fallback.
export const FALLBACK_FOOTER_SOCIALS = [
  {
    name: "DEVPOST",
    url: "https://devpost.com/ashzaeen?ref_content=user-portfolio&ref_feature=portfolio&ref_medium=global-nav",
    icon: "devpost"
  },
  {
    name: "GITHUB",
    url: "https://github.com/Ashzaeen",
    icon: "github"
  },
  {
    name: "LINKEDIN",
    url: "https://www.linkedin.com/in/ashzaeen",
    icon: "linkedin"
  },
  {
    name: "INSTAGRAM",
    url: "https://instagram.com/ash_1221w?igshid=OGQ5ZDc2ODk2ZA==",
    icon: "instagram"
  },
  {
    name: "VSCO",
    url: "https://vsco.co/ashzaeen/gallery",
    icon: "vsco"
  }
];
