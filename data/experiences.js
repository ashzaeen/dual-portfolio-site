import { t, p, h1, h2, h3, q, callout, bull, num, todo, mkTable, code, divider, img, fileLink, columns } from "./_notion-helpers.js";

export const FALLBACK_EXPERIENCES = [
  {
    slug: "sac-representative",
    kind: "extracurricular",
    category: "Leadership",
    role: "Undergraduate Representative",
    organization: "CSE Student Advisory Council",
    date: "Jan 2025 — Present",
    techStack: ["Policy Advocacy", "Strategic Planning"],
    body: [
      bull([t("Advise the CSE department on student needs, curriculum feedback, and student-faculty engagement initiatives.")])
    ]
  },
  {
    slug: "rvl-research-assistant",
    kind: "work",
    category: "Research",
    role: "Research Assistant",
    organization: "Robotic Vision Laboratory",
    date: "Jan 2026 — Present",
    techStack: ["VLA Models", "Python", "PyTorch"],
    body: [
      bull([t("Conduct research on "), t("Vision-Language-Action (VLA) models.", { bold: true })]),
      bull([t("Constructed a linguistic stress-test dataset, implemented perturbation experiments and analyzed performance degradation curves.")]),
      bull([t("Presented a Poster at a Computing Research Association conference.")])
    ]
  },
  {
    slug: "scai-event-officer",
    kind: "extracurricular",
    category: "Leadership",
    role: "Event Planning Officer",
    organization: "Students in Computing & AI (SCAI)",
    date: "Aug 2025 — May 2026",
    techStack: ["Community Building", "Public Speaking"],
    body: [
      bull([t("Led end-to-end planning of high-impact events, coordinating logistics, outreach, and speaker engagement.")])
    ]
  },
  {
    slug: "oit-student-developer",
    kind: "work",
    category: "Professional",
    role: "Student Developer",
    organization: "UTA Office of Information Technology",
    date: "Aug 2025 — Present",
    techStack: ["HTML", "CSS", "JavaScript", "WordPress"],
    body: [
      bull([t("Build and maintain departmental, faculty, and university websites using Sitecore, Cascade, CampusPress, and front-end technologies (HTML, CSS, JavaScript)")]),
      bull([t("Support Web Hosting Services (WHS) while ensuring full compliance with WCAG 2.1 accessibility standards")]),
      bull([t("Work on content updates, accessibility fixes, and site migrations to improve UX")]),
      p([])
    ]
  },
  {
    slug: "ur2phd-researcher",
    kind: "work",
    category: "Research",
    role: "Undergraduate Researcher",
    organization: "CRA UR2PhD Program",
    date: "Sep 2025 — Dec 2025",
    techStack: ["Signal Processing", "Data Analysis", "Methodology"],
    body: [
      bull([t("Conducted research on Reliable Long-Range Drone Detection with mmWave Sensing")]),
      bull([t("Collected radar data, applied advanced signal processing (FrFT) and authored 2 Technical Review Papers")]),
      bull([t("Advanced research skills through the CRA Undergrad Research Training course: maintaining research logs, performing literature reviews, learning data visualization, co-developing a proposal, and delivering presentations with mentors and peers")])
    ]
  }
];

export const EXPERIENCES_BY_SLUG = Object.fromEntries(
  FALLBACK_EXPERIENCES.map((exp) => [exp.slug, exp])
);

export const WORK_EXPERIENCES = FALLBACK_EXPERIENCES.filter((e) => e.kind === "work");
export const EXTRACURRICULARS = FALLBACK_EXPERIENCES.filter((e) => e.kind === "extracurricular");
