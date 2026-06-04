import styles from "./SectionGuide.module.css";

// One-line "how to use this section" instruction, placed just below the
// section intro. Set in mono — the system's functional voice — so it reads
// clearly as a guide, distinct from the italic serif flavor copy above it,
// and in a darker ink than the subtitle so it's the most legible line in the
// header. The small gold cursor signals "this section is interactive."
export default function SectionGuide({ children, className = "" }) {
  return (
    <p className={`${styles.guide} ${className}`}>
      <svg className={styles.cursor} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          d="M1.6 1 L1.6 12.4 L4.5 9.7 L6.5 14.1 L8.4 13.3 L6.4 8.9 L10.5 8.8 Z"
          fill="currentColor"
        />
      </svg>
      <span className={styles.text}>{children}</span>
    </p>
  );
}
