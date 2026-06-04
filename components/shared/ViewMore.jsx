import Link from "next/link";
import styles from "./ViewMore.module.css";

export default function ViewMore({ href = "#", children = "View All →", onClick }) {
  // Pull a trailing arrow out of the label so it can animate on its own.
  const label =
    typeof children === "string" ? children.replace(/\s*→\s*$/, "") : children;

  const inner = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.arrow} aria-hidden="true">→</span>
    </>
  );

  return (
    <div className={styles.row}>
      {onClick ? (
        <button type="button" className={styles.btn} onClick={onClick}>
          {inner}
        </button>
      ) : (
        <Link href={href} className={styles.btn}>
          {inner}
        </Link>
      )}
    </div>
  );
}
