import Link from "next/link";
import MediaGallery from "./MediaGallery";
import NotionBlocks from "@/components/professional/notion/NotionBlocks";
import styles from "./ProjectCaseStudy.module.css";

export default function ProjectCaseStudy({ project, isPage = false }) {
  return (
    <div className={styles.root}>
      {/* Window bar */}
      <div className={styles.windowBar}>
        <div className={styles.windowDots}>
          <span className={styles.dotR} />
          <span className={styles.dotY} />
          <span className={styles.dotG} />
        </div>
        <span className={styles.windowTitle}>{project.title.toUpperCase()}.EXE</span>
        {isPage ? (
          <Link href="/" className={styles.windowClose}>← Back to Projects</Link>
        ) : (
          <div className={styles.windowClose} style={{ opacity: 0, pointerEvents: "none" }}>✕</div>
        )}
      </div>

      {/* Scrollable body */}
      <div className={styles.body}>
        {/* Media */}
        <div className={styles.mediaWrap}>
          <MediaGallery media={project.media} />
        </div>

        {/* Meta */}
        <div className={styles.meta}>
          <div className={styles.metaTop}>
            <span className={styles.category}>{project.category}</span>
            {project.award && <span className={styles.award}>{project.award}</span>}
          </div>
          <h1 className={styles.title}>{project.title}</h1>

          {/* Tech stack */}
          <div className={styles.techStack}>
            {project.techStack.map((tech) => (
              <span key={tech} className={styles.techPill}>{tech}</span>
            ))}
          </div>

          {/* Links */}
          {project.links?.length > 0 && (
            <div className={styles.links}>
              {project.links.map((link) => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  {link.name} ↗
                </a>
              ))}
            </div>
          )}

          {/* Summary */}
          <blockquote className={styles.summary}>{project.summary}</blockquote>
        </div>

        {/* Notion body */}
        <div className={styles.notionBody}>
          <NotionBlocks blocks={project.body} />
        </div>
      </div>
    </div>
  );
}
