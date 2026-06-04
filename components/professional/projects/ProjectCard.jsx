"use client";

import { useRef } from "react";
import Link from "next/link";
import styles from "./ProjectCard.module.css";

export default function ProjectCard({ project }) {
  const cardRef = useRef(null);

  function handleMouseMove(e) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  const firstMedia = project.media[0];

  return (
    <Link href={`/projects/${project.slug}`} scroll={false} className={styles.card} ref={cardRef} onMouseMove={handleMouseMove}>
      {/* Media preview */}
      <div className={styles.mediaPreview}>
        <span className={styles.mediaLabel}>
          [ {firstMedia?.type === "youtube" ? "VIDEO_EMBED" : (firstMedia?.placeholder ?? "PREVIEW")} ]
        </span>
      </div>

      {/* Card body */}
      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.category}>{project.category}</span>
          {project.award && <span className={styles.award}>{project.award}</span>}
        </div>
        <h2 className={styles.title}>{project.title}</h2>
        <p className={styles.summary}>{project.summary}</p>
        <div className={styles.techStack}>
          {project.techStack.map((tech) => (
            <span key={tech} className={styles.techPill}>{tech}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
