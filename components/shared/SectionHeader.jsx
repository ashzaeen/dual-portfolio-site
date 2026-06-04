import ScrollReveal from "./ScrollReveal";
import styles from "./SectionHeader.module.css";

export default function SectionHeader({ label, title, subtitle, action, guide }) {
  return (
    <ScrollReveal className={styles.wrap}>
      <div className={styles.eyebrow}>{label}</div>
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <div className={styles.rule} />
      {guide}
      {action}
    </ScrollReveal>
  );
}
