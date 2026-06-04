"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import NotionBlocks from "@/components/professional/notion/NotionBlocks";
import styles from "./ExperienceCard.module.css";

export default function ExperienceCard({ experience, isActive, onToggle, registerRef }) {
  const cardRef = useRef(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (registerRef) registerRef(experience.slug, cardRef.current);
  }, []);

  function handleMouseMove(e) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  // Scroll into view after animation completes (avoids the fragile setTimeout)
  function handleExpandComplete() {
    if (!isActive || !cardRef.current) return;
    const y = cardRef.current.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <motion.div
      layout
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`${styles.card} ${isActive ? styles.active : ""}`}
    >
      {/* Card header — click to toggle */}
      <motion.div
        layout="position"
        className={styles.header}
        onClick={() => onToggle(experience.slug)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(experience.slug); }}
        aria-expanded={isActive}
      >
        <div className={styles.dateCol}>
          <div className={styles.date}>{experience.date}</div>
          <div className={styles.category}>{experience.category}</div>
        </div>

        <div className={styles.mainCol}>
          <h2 className={`${styles.role} ${isActive ? styles.roleActive : ""}`}>{experience.role}</h2>
          <div className={styles.org}>{experience.organization}</div>
          <div className={styles.techStack}>
            {experience.techStack.map((tech) => (
              <span key={tech} className={`${styles.techPill} ${isActive ? styles.techPillActive : ""}`}>
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.chevron} aria-hidden="true">
          {isActive ? "−" : "+"}
        </div>
      </motion.div>

      {/* Expanded body */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.45, ease: [0.04, 0.62, 0.23, 0.98] }}
            onAnimationComplete={handleExpandComplete}
            className={styles.expandedBody}
          >
            <div
              className={styles.bodyInner}
              onClick={(e) => {
                // Prevent clicks on links/pre inside body from toggling the card
                if (e.target.closest("a") || e.target.closest("pre")) e.stopPropagation();
              }}
            >
              <div className={styles.divider} />
              <NotionBlocks blocks={experience.body} />

              {/* Detail view link */}
              <div className={styles.detailLinkRow}>
                <Link
                  href={`/experiences/${experience.slug}`}
                  scroll={false}
                  className={styles.detailLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗ Open in detail view
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data-flow animated border (reduced motion: skip) */}
      {!prefersReduced && (
        <div className={`${styles.dataFlowBorder} ${isActive ? styles.dataFlowBorderActive : ""}`} aria-hidden="true" />
      )}
    </motion.div>
  );
}
