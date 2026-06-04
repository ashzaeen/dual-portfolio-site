import NotionBlocks from "@/components/professional/notion/NotionBlocks";
import styles from "./ExperienceDetail.module.css";

export default function ExperienceDetail({ experience, isPage = false }) {
  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.category}>{experience.category}</span>
        <h1 className={styles.role}>{experience.role}</h1>
        <div className={styles.org}>{experience.organization}</div>
        <div className={styles.date}>{experience.date}</div>

        <div className={styles.techStack}>
          {experience.techStack.map((tech) => (
            <span key={tech} className={styles.techPill}>{tech}</span>
          ))}
        </div>
      </div>

      {/* Notion body */}
      <div className={styles.body}>
        <NotionBlocks blocks={experience.body} />
      </div>
    </div>
  );
}
