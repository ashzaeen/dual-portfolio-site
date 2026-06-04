// TechStack fallback. Mirrors the two-DB Notion shape:
//   Categories DB: Name (Title), Side (Select: right|left), Order (Number),
//                  Status. Order determines top→bottom positioning within
//                  Side in architecture mode; List view shows categories in
//                  global Order ascending.
//   Skills DB:     Name (Title), Category (Relation), Order, Status.
//
// Order in this fallback (1..6) matches what the bootstrap will seed into
// Notion. Right side cats get Orders 1-3 (top→bottom), left side cats get
// 4-6 (top→bottom), giving the original hexagonal layout when angles are
// derived from Side + index-within-side.

export const FALLBACK_TECHSTACK = [
  {
    name: "AI & Research",
    side: "right",
    skills: ["Agentic AI", "VLA Models", "PyTorch", "Jupyter"]
  },
  {
    name: "Cloud & DevOps",
    side: "right",
    skills: ["AWS EC2", "AWS S3", "AWS Lambda", "CloudFormation", "GitHub Actions", "CI/CD"]
  },
  {
    name: "Tools",
    side: "right",
    skills: ["Git", "VS Code", "UNIX Shell", "Android Studio", "Figma"]
  },
  {
    name: "Web Frameworks",
    side: "left",
    skills: ["Express.js", "React.js", "Node.js", "Tailwind", "Bootstrap", "Jetpack Compose"]
  },
  {
    name: "Languages",
    side: "left",
    skills: ["Python", "Java", "C/C++", "JavaScript", "TypeScript", "Kotlin"]
  },
  {
    name: "Databases",
    side: "left",
    skills: ["MongoDB", "PostgreSQL", "MySQL", "Firebase"]
  }
];
