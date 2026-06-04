"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NotionImage from "@/components/shared/NotionImage";
import PinchZoomImage from "@/components/shared/PinchZoomImage";
import styles from "./WritingBlocks.module.css";

const LIST_TYPES = ["bulleted_list_item", "numbered_list_item"];
// File/link blocks that render together as a row of action buttons.
const BUTTON_TYPES = ["bookmark", "file", "pdf"];

// A button caption may start with an alignment token — `left:`, `center:`, or
// `right:` — which sets the ROW's justification; the rest of the caption is the
// button label. No token → left, label falls back to filename / URL.
const ALIGN_TOKEN_RE = /^\s*(left|center|centre|right)\s*:\s*/i;
function parseButtonCaption(richText, fallbackLabel) {
  const text = (richText && richText.map((t) => t.plain_text ?? t.text?.content ?? "").join("").trim()) || "";
  const m = text.match(ALIGN_TOKEN_RE);
  if (m) {
    const a = m[1].toLowerCase();
    const label = text.slice(m[0].length).trim();
    return { align: a === "centre" ? "center" : a, label: label || fallbackLabel };
  }
  return { align: null, label: text || fallbackLabel };
}

function buttonInfo(block) {
  if (block.type === "bookmark") {
    const url = block.bookmark?.url;
    const { align, label } = parseButtonCaption(block.bookmark?.caption, url);
    return { url, label, align, kind: "link" };
  }
  const data = block[block.type]; // file | pdf
  const url = data?.file?.url ?? data?.external?.url;
  const fallback =
    data?.name || url?.split("/").pop()?.split("?")[0] || "Download";
  const { align, label } = parseButtonCaption(data?.caption, fallback);
  return { url, label, align, kind: "file" };
}

// Lets a deeply-nested ImageBlock open the article-wide lightbox without
// drilling a callback through every block renderer.
const LightboxContext = createContext(null);

// Notion text colors, mapped to the warm desk/ink palette. Foreground
// colors recolor the text; `*_background` colors apply a soft highlight.
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
const BG_COLOR_MAP = {
  gray: "rgba(120,110,90,0.16)",
  brown: "rgba(120,80,40,0.16)",
  orange: "rgba(196,128,60,0.18)",
  yellow: "rgba(184,160,76,0.20)",
  green: "rgba(90,138,92,0.18)",
  blue: "rgba(76,108,156,0.18)",
  purple: "rgba(124,92,156,0.18)",
  pink: "rgba(156,92,124,0.18)",
  red: "rgba(156,76,76,0.18)",
};
function colorStyle(color) {
  if (!color || color === "default") return undefined;
  if (color.endsWith("_background")) {
    const bg = BG_COLOR_MAP[color.replace("_background", "")];
    return bg
      ? { background: bg, padding: "0.02em 0.28em", borderRadius: 2 }
      : undefined;
  }
  return COLOR_MAP[color] ? { color: COLOR_MAP[color] } : undefined;
}

function getText(richText = []) {
  return richText.map((rt) => rt.plain_text ?? rt.text?.content ?? "").join("");
}

// Image captions can carry leading sizing tokens that the visible caption
// strips: `size:NN%` sets the DESKTOP width and `mobile-size:NN%` sets the
// MOBILE width. Both may appear (in any order). If only `size:` is given,
// mobile defaults to full width — so a figure deliberately shrunk on desktop
// isn't rendered tiny on a phone. Whatever text remains after the tokens
// renders as the figcaption. Percents clamp to [10, 100].
const SIZE_TOKEN_RE = /^\s*(mobile-size|size)\s*:\s*(\d{1,3})%\s*/i;
function parseImageCaption(richText = []) {
  if (richText.length === 0)
    return { widthPercent: null, mobileWidthPercent: null, captionRichText: [] };
  const first = richText[0];
  let firstText = first.plain_text ?? first.text?.content ?? "";
  let widthPercent = null;
  let mobileWidthPercent = null;
  let match;
  while ((match = firstText.match(SIZE_TOKEN_RE))) {
    const pct = Math.max(10, Math.min(100, parseInt(match[2], 10)));
    if (match[1].toLowerCase() === "mobile-size") mobileWidthPercent = pct;
    else widthPercent = pct;
    firstText = firstText.slice(match[0].length);
  }
  if (widthPercent === null && mobileWidthPercent === null)
    return { widthPercent: null, mobileWidthPercent: null, captionRichText: richText };
  if (firstText.length === 0)
    return { widthPercent, mobileWidthPercent, captionRichText: richText.slice(1) };
  const trimmedFragment = {
    ...first,
    plain_text: firstText,
    text: first.text ? { ...first.text, content: firstText } : first.text,
  };
  return {
    widthPercent,
    mobileWidthPercent,
    captionRichText: [trimmedFragment, ...richText.slice(1)],
  };
}

function RichText({ rich_text = [] }) {
  return (
    <>
      {rich_text.map((rt, i) => {
        if (rt.type !== "text") return null;
        const { bold, italic, underline, strikethrough, code, color } =
          rt.annotations || {};
        const content = rt.text.content;
        const href = rt.text.link?.url;
        const inlineStyle = colorStyle(color);

        const classes = [
          bold && styles.bold,
          italic && styles.italic,
          underline && styles.underline,
          strikethrough && styles.strikethrough,
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
    } else if (BUTTON_TYPES.includes(b.type)) {
      // Run of consecutive file/link blocks → one button row.
      const items = [b];
      while (i + 1 < blocks.length && BUTTON_TYPES.includes(blocks[i + 1].type)) {
        i++;
        items.push(blocks[i]);
      }
      groups.push({ _group: "buttons", items });
    } else {
      groups.push(b);
    }
    i++;
  }
  return groups;
}

function ImageBlock({ block }) {
  const openLightbox = useContext(LightboxContext);
  const url =
    block.image?.type === "external"
      ? block.image.external?.url
      : block.image?.file?.url;
  const { widthPercent, mobileWidthPercent, captionRichText } = parseImageCaption(
    block.image?.caption ?? []
  );
  // Drive the width through CSS vars so a media query can swap desktop vs
  // mobile without inline !important. Mobile defaults to full width unless a
  // `mobile-size:` token narrows it.
  const hasSize = widthPercent != null || mobileWidthPercent != null;
  const figureStyle = hasSize
    ? {
        "--img-w": widthPercent != null ? `${widthPercent}%` : "100%",
        "--img-w-mobile": mobileWidthPercent != null ? `${mobileWidthPercent}%` : "100%",
      }
    : undefined;
  return (
    <figure
      className={`${styles.figure}${hasSize ? " " + styles.figureSized : ""}`}
      style={figureStyle}
    >
      {url ? (
        <button
          type="button"
          className={styles.imageBtn}
          onClick={() => openLightbox?.(url)}
          aria-label="Open image full size"
        >
          <NotionImage
            src={url}
            alt={getText(captionRichText)}
            className={styles.image}
            fallback={
              <div className={styles.imagePlaceholder} aria-hidden="true">
                <span>image</span>
              </div>
            }
          />
        </button>
      ) : (
        <div className={styles.imagePlaceholder} aria-hidden="true">
          <span>image</span>
        </div>
      )}
      {captionRichText.length > 0 && (
        <figcaption className={styles.figcaption}>
          <RichText rich_text={captionRichText} />
        </figcaption>
      )}
    </figure>
  );
}

// Full-size image overlay, themed for the personal/desk side: warm dark
// backdrop blur + a cream-and-gold frame. Mounts above the writing modal.
function ImageLightbox({ src, onClose, themed = true }) {
  // Intercept Esc in the capture phase and stop it dead so it closes only the
  // lightbox — not the WritingReader's own window-level Esc handler beneath.
  useEffect(() => {
    if (!src) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [src, onClose]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className={styles.lightbox}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          data-theme="personal"
        >
          <motion.div
            className={`${styles.lightboxFrame}${themed ? " " + styles.lightboxFrameParchment : ""}`}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <PinchZoomImage
              src={src}
              alt=""
              maxW="min(1100px, 94vw)"
              maxH={themed ? "calc(92vh - 36px)" : "92vh"}
              imgClassName={styles.lightboxImg}
            />
            {themed && (
              <>
                <span className={`${styles.corner} ${styles.cornerTL}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerTR}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBL}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBR}`} aria-hidden="true" />
              </>
            )}
            <button
              className={styles.lightboxClose}
              onClick={onClose}
              aria-label="Close image"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ColumnListBlock({ block, cat, depth }) {
  const columns = block.column_list?.children || [];
  return (
    <div className={styles.columnList}>
      {columns.map((col, i) => (
        <div key={i} className={styles.column}>
          <RenderBlocks
            blocks={col.column?.children || []}
            cat={cat}
            depth={depth}
          />
        </div>
      ))}
    </div>
  );
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
                const isHead = ri === 0 && has_column_header;
                const Tag = isHead ? "th" : "td";
                return (
                  <Tag key={ci} className={isHead ? styles.th : styles.td}>
                    <RichText rich_text={cell} />
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

function CodeBlock({ block }) {
  const source = getText(block.code.rich_text);
  const lang = block.code.language || "text";
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang}</span>
        <button type="button" className={styles.codeCopy} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.codePre}>
        <code className={styles.codeText}>{source}</code>
      </pre>
    </div>
  );
}

// Bulleted/numbered list. Nested children (Notion Tab-indent) are populated by
// the recursive fetcher in lib/notion.js and rendered via RenderBlocks one
// depth deeper, producing real nested <ul>/<ol>.
function ListGroup({ group, cat, depth }) {
  const isBullet = group._group === "bulleted_list_item";
  const Tag = isBullet ? "ul" : "ol";
  const cls = `${isBullet ? styles.ul : styles.ol}${
    depth > 0 ? ` ${styles.nestedList}` : ""
  }`;
  return (
    <Tag className={cls}>
      {group.items.map((b, j) => {
        const data = b[group._group];
        const children = data.children ?? [];
        return (
          <li
            key={j}
            className={`${styles.li}${isBullet ? "" : ` ${styles.olLi}`}`}
          >
            <RichText rich_text={data.rich_text} />
            {children.length > 0 && (
              <RenderBlocks blocks={children} cat={cat} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </Tag>
  );
}

// A run of file/link blocks → buttons sharing one row. Row justification comes
// from the first button that declares an alignment token (else left).
function ButtonRow({ items, cat }) {
  const infos = items.map(buttonInfo).filter((b) => b.url);
  if (infos.length === 0) return null;
  const align = infos.find((b) => b.align)?.align ?? "left";
  const alignClass =
    align === "center" ? styles.alignCenter : align === "right" ? styles.alignRight : styles.alignLeft;
  return (
    <div className={`${styles.buttonRow} ${alignClass}`}>
      {infos.map((b, i) => (
        <a
          key={i}
          href={b.url}
          className={styles.actionBtn}
          target="_blank"
          rel="noopener noreferrer"
          style={cat ? { "--btn-accent": cat.accent, "--btn-deep": cat.deep } : undefined}
        >
          <span className={styles.actionIcon} aria-hidden="true">
            {b.kind === "file" ? "↓" : "↗"}
          </span>
          <span className={styles.actionLabel}>{b.label}</span>
        </a>
      ))}
    </div>
  );
}

function Block({ block, cat, dropCapNext, depth = 0 }) {
  const { type } = block;

  if (type === "paragraph") {
    const rt = block.paragraph.rich_text;
    if (!rt.length) return <div className={styles.spacer} />;

    if (dropCapNext) {
      const firstText = rt[0];
      const firstContent = firstText?.text?.content || "";
      const head = firstContent.charAt(0);
      const rest = firstContent.slice(1);
      const remaining = rt.slice(1);
      return (
        <p className={styles.paragraph}>
          <span className={styles.dropCap} style={{ color: cat?.deep }}>
            {head}
          </span>
          <RichText
            rich_text={[
              {
                ...firstText,
                text: { ...firstText.text, content: rest },
              },
              ...remaining,
            ]}
          />
        </p>
      );
    }
    return (
      <p className={styles.paragraph}>
        <RichText rich_text={rt} />
      </p>
    );
  }

  if (type === "heading_1" || type === "heading_2") {
    const key = type === "heading_1" ? "heading_1" : "heading_2";
    return (
      <h2 className={styles.h2} style={{ color: cat?.deep }}>
        <RichText rich_text={block[key].rich_text} />
      </h2>
    );
  }

  if (type === "heading_3") {
    return (
      <h3 className={styles.h3}>
        <span className={styles.h3Dash} style={{ background: cat?.accent }} />
        <RichText rich_text={block.heading_3.rich_text} />
      </h3>
    );
  }

  if (type === "quote") {
    return (
      <blockquote
        className={styles.quote}
        style={{ borderLeftColor: cat?.accent }}
      >
        <RichText rich_text={block.quote.rich_text} />
      </blockquote>
    );
  }

  if (type === "callout") {
    const { rich_text, icon } = block.callout;
    return (
      <div
        className={styles.callout}
        style={{
          borderColor: cat ? `${cat.accent}55` : undefined,
          background: cat?.tint,
        }}
      >
        {icon?.type === "emoji" && (
          <span className={styles.calloutIcon}>{icon.emoji}</span>
        )}
        <span className={styles.calloutText}>
          <RichText rich_text={rich_text} />
        </span>
      </div>
    );
  }

  if (type === "to_do") {
    const { rich_text, checked } = block.to_do;
    return (
      <div className={styles.todo}>
        <span
          className={`${styles.todoBox}${checked ? ` ${styles.todoBoxChecked}` : ""}`}
          aria-hidden="true"
        >
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span
          className={`${styles.todoText}${checked ? ` ${styles.todoTextChecked}` : ""}`}
        >
          <RichText rich_text={rich_text} />
        </span>
      </div>
    );
  }

  if (type === "code") return <CodeBlock block={block} />;

  if (type === "divider") {
    return (
      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerLine} />
        <span className={styles.dividerMark}>✦</span>
        <span className={styles.dividerLine} />
      </div>
    );
  }

  if (type === "image") return <ImageBlock block={block} />;
  if (type === "column_list")
    return <ColumnListBlock block={block} cat={cat} depth={depth} />;
  if (type === "table") return <TableBlock block={block} />;

  return null;
}

function RenderBlocks({ blocks = [], cat, depth = 0, dropCap = false }) {
  const grouped = groupBlocks(blocks);
  let dropCapApplied = !dropCap;

  return (
    <>
      {grouped.map((item, i) => {
        if (item._group === "buttons") {
          return <ButtonRow key={i} items={item.items} cat={cat} />;
        }
        if (item._group) {
          return <ListGroup key={i} group={item} cat={cat} depth={depth} />;
        }

        const isFirstParagraph =
          !dropCapApplied &&
          item.type === "paragraph" &&
          item.paragraph?.rich_text?.length > 0;
        if (isFirstParagraph) dropCapApplied = true;

        return (
          <Block
            key={i}
            block={item}
            cat={cat}
            dropCapNext={isFirstParagraph}
            depth={depth}
          />
        );
      })}
    </>
  );
}

export default function WritingBlocks({ blocks = [], cat, type, dropCap = true }) {
  const [lightboxSrc, setLightboxSrc] = useState(null);
  // The aged-parchment mat + album corners are a personal/desk flourish.
  // Journalism and Technical pieces get a plain framed image instead.
  const themed = type !== "Journalism" && type !== "Technical";
  return (
    <LightboxContext.Provider value={setLightboxSrc}>
      <div className={styles.blocks}>
        <RenderBlocks blocks={blocks} cat={cat} dropCap={dropCap} />
      </div>
      <ImageLightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
        themed={themed}
      />
    </LightboxContext.Provider>
  );
}
