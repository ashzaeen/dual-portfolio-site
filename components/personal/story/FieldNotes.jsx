"use client";

import NotionBlocks from "./notion/NotionBlocks";
import styles from "./FieldNotes.module.css";

export default function FieldNotes({ story, onPauseChange, scrollRef }) {
  function handleMouseEnter() {
    onPauseChange?.(true);
  }
  function handleMouseLeave() {
    onPauseChange?.(false);
  }

  if (!story) return null;

  return (
    <div
      ref={scrollRef}
      className={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.header}>
        <div className={styles.eyebrow}>
          {(story.locationLabel || story.locationId).replace(/-/g, " ")} ·{" "}
          {story.date}
        </div>
        <h1 className={styles.title}>{story.title}</h1>
        <div className={styles.divider} />
      </div>

      <div className={styles.content}>
        <NotionBlocks blocks={story.blocks} />
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLabel}>✦ END OF STORY</span>
      </div>
    </div>
  );
}
