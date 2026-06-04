import RichText from "./RichText";
import styles from "./NotionBlocks.module.css";

const LIST_TYPES = ["bulleted_list_item", "numbered_list_item", "to_do"];

function groupBlocks(blocks) {
  const groups = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (LIST_TYPES.includes(b.type)) {
      const type = b.type;
      const items = [b];
      while (i + 1 < blocks.length && blocks[i + 1].type === type) {
        i++;
        items.push(blocks[i]);
      }
      groups.push({ _group: type, items });
    } else {
      groups.push(b);
    }
    i++;
  }
  return groups;
}

function TableBlock({ block }) {
  const { has_column_header, children = [] } = block.table;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <tbody>
          {children.map((row, ri) => (
            <tr key={ri}>
              {row.table_row.cells.map((cell, ci) => {
                const Tag = ri === 0 && has_column_header ? "th" : "td";
                return (
                  <Tag
                    key={ci}
                    className={
                      ri === 0 && has_column_header
                        ? styles.th
                        : styles.td
                    }
                  >
                    <RichText richText={cell} />
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NotionBlock({ block }) {
  const { type } = block;

  if (type === "paragraph") {
    const rt = block.paragraph.rich_text;
    if (!rt.length) return <div className={styles.spacer} />;
    return (
      <p className={styles.paragraph}>
        <RichText richText={rt} />
      </p>
    );
  }

  if (type === "heading_1") {
    return (
      <h2 className={styles.h1}>
        <RichText richText={block.heading_1.rich_text} />
      </h2>
    );
  }
  if (type === "heading_2") {
    return (
      <h3 className={styles.h2}>
        <RichText richText={block.heading_2.rich_text} />
      </h3>
    );
  }
  if (type === "heading_3") {
    return (
      <h4 className={styles.h3}>
        <RichText richText={block.heading_3.rich_text} />
      </h4>
    );
  }

  if (type === "quote") {
    return (
      <blockquote className={styles.quote}>
        <RichText richText={block.quote.rich_text} />
      </blockquote>
    );
  }

  if (type === "callout") {
    const { rich_text, icon } = block.callout;
    return (
      <div className={styles.callout}>
        {icon?.type === "emoji" && (
          <span className={styles.calloutIcon}>{icon.emoji}</span>
        )}
        <span>
          <RichText richText={rich_text} />
        </span>
      </div>
    );
  }

  if (type === "table") {
    return <TableBlock block={block} />;
  }

  return null;
}

export default function NotionBlocks({ blocks = [] }) {
  const grouped = groupBlocks(blocks);

  return (
    <div className={styles.blocks}>
      {grouped.map((item, i) => {
        if (item._group === "bulleted_list_item") {
          return (
            <ul key={i} className={styles.ul}>
              {item.items.map((b, j) => (
                <li key={j} className={styles.li}>
                  <RichText richText={b.bulleted_list_item.rich_text} />
                </li>
              ))}
            </ul>
          );
        }

        if (item._group === "numbered_list_item") {
          return (
            <ol key={i} className={styles.ol}>
              {item.items.map((b, j) => (
                <li key={j} className={`${styles.li} ${styles.olLi}`}>
                  <RichText richText={b.numbered_list_item.rich_text} />
                </li>
              ))}
            </ol>
          );
        }

        if (item._group === "to_do") {
          return (
            <div key={i} className={styles.todoGroup}>
              {item.items.map((b, j) => (
                <div key={j} className={styles.todo}>
                  <span
                    className={`${styles.checkbox} ${b.to_do.checked ? styles.checked : ""}`}
                    aria-hidden="true"
                  >
                    {b.to_do.checked ? "✓" : ""}
                  </span>
                  <span
                    className={
                      b.to_do.checked ? styles.todoChecked : styles.todoText
                    }
                  >
                    <RichText richText={b.to_do.rich_text} />
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return <NotionBlock key={i} block={item} />;
      })}
    </div>
  );
}
