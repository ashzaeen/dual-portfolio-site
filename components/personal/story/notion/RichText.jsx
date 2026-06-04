import styles from "./RichText.module.css";

const COLOR_MAP = {
  gray: "var(--ink-faint)",
  brown: "var(--ink-mid)",
  orange: "#c4803c",
  yellow: "#b8a04c",
  green: "#5a8a5c",
  blue: "#4c6c9c",
  purple: "#7c5c9c",
  pink: "#9c5c7c",
  red: "#9c4c4c",
};

export default function RichText({ richText = [] }) {
  return (
    <>
      {richText.map((rt, i) => {
        if (rt.type !== "text") return null;
        const { bold, italic, strikethrough, underline, code, color } =
          rt.annotations;
        const content = rt.text.content;
        const href = rt.text.link?.url;

        const inlineStyle =
          color && color !== "default" && COLOR_MAP[color]
            ? { color: COLOR_MAP[color] }
            : undefined;

        const classes = [
          bold && styles.bold,
          italic && styles.italic,
          strikethrough && styles.strikethrough,
          underline && styles.underline,
        ]
          .filter(Boolean)
          .join(" ");

        if (href) {
          return (
            <a
              key={i}
              href={href}
              className={`${styles.link} ${classes}`}
              style={inlineStyle}
              target="_blank"
              rel="noopener noreferrer"
            >
              {content}
            </a>
          );
        }

        if (code) {
          return (
            <code key={i} className={styles.code} style={inlineStyle}>
              {content}
            </code>
          );
        }

        if (classes || inlineStyle) {
          return (
            <span key={i} className={classes || undefined} style={inlineStyle}>
              {content}
            </span>
          );
        }

        return content;
      })}
    </>
  );
}
