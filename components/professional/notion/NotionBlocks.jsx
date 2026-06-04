"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RichText from "@/components/personal/story/notion/RichText";
import NotionImage from "@/components/shared/NotionImage";
import PinchZoomImage from "@/components/shared/PinchZoomImage";
import styles from "./NotionBlocks.module.css";

// Lets the (possibly nested) ImageBlock open the shared lightbox without
// threading a callback through every renderer.
const LightboxContext = createContext(null);

const LIST_TYPES = ["bulleted_list_item", "numbered_list_item", "to_do"];
// File/link blocks that render together as a row of action buttons.
const BUTTON_TYPES = ["bookmark", "file", "pdf"];

const getText = (rt = []) => rt.map((t) => t.plain_text ?? t.text?.content ?? "").join("");

// A button caption may start with an alignment token — `left:`, `center:`, or
// `right:` — which sets the ROW's justification; the rest is the button label.
const ALIGN_TOKEN_RE = /^\s*(left|center|centre|right)\s*:\s*/i;
function parseButtonCaption(richText, fallbackLabel) {
  const text = getText(richText).trim();
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
  const fallback = data?.name || url?.split("/").pop()?.split("?")[0] || "Download";
  const { align, label } = parseButtonCaption(data?.caption, fallback);
  return { url, label, align, kind: "file" };
}

function ButtonRow({ items }) {
  const infos = items.map(buttonInfo).filter((b) => b.url);
  if (infos.length === 0) return null;
  const align = infos.find((b) => b.align)?.align ?? "left";
  const alignClass =
    align === "center" ? styles.alignCenter : align === "right" ? styles.alignRight : styles.alignLeft;
  return (
    <div className={`${styles.buttonRow} ${alignClass}`}>
      {infos.map((b, i) => (
        <a key={i} href={b.url} className={styles.actionBtn} target="_blank" rel="noopener noreferrer">
          <span className={styles.actionIcon} aria-hidden="true">{b.kind === "file" ? "↓" : "↗"}</span>
          <span className={styles.actionLabel}>{b.label}</span>
        </a>
      ))}
    </div>
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
                    className={ri === 0 && has_column_header ? styles.th : styles.td}
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

function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false);
  const source = block.code.rich_text.map((t) => t.text?.content ?? "").join("");
  const language = block.code.language ?? "";

  function handleCopy() {
    navigator.clipboard.writeText(source).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <div className={styles.codeHeaderLeft}>
          <div className={styles.trafficDots}>
            <span className={styles.dotRed} />
            <span className={styles.dotYellow} />
            <span className={styles.dotGreen} />
          </div>
          <span className={styles.codeLang}>{language}</span>
        </div>
        <button className={styles.copyBtn} onClick={handleCopy} type="button">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <pre className={styles.codePre}>
        <code className={styles.codeContent}>{source}</code>
      </pre>
    </div>
  );
}

function DividerBlock() {
  return (
    <div className={styles.divider}>
      <div className={styles.dividerLine} />
      <span className={styles.dividerGlyph}>◈</span>
      <div className={`${styles.dividerLine} ${styles.dividerLineRight}`} />
    </div>
  );
}

function ImageBlock({ block }) {
  const openLightbox = useContext(LightboxContext);
  const placeholder = block.image?.placeholder;
  const url = block.image?.file?.url ?? block.image?.external?.url;

  const placeholderEl = (
    <div className={styles.imagePlaceholder}>
      [ {placeholder ?? "IMAGE_PLACEHOLDER"} ]
    </div>
  );

  if (!url) return placeholderEl;

  return (
    <button
      type="button"
      className={styles.imageBtn}
      onClick={() => openLightbox?.(url)}
      aria-label="Open image full size"
    >
      <NotionImage
        src={url}
        alt={block.image?.caption?.[0]?.plain_text ?? ""}
        className={styles.image}
        fallback={placeholderEl}
      />
    </button>
  );
}

// Full-size image overlay for experience case studies — themed to match the
// pro side (obsidian backdrop, gold frame) and the project-writeup lightbox.
// Pinch-to-zoom on touch; tall portraits are contained, never cropped.
function ImageLightbox({ src, onClose }) {
  // Close on Esc, but in the capture phase + stopImmediatePropagation so it
  // closes ONLY the lightbox, not the CaseStudyModal's own Esc handler beneath.
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          data-theme="pro"
          className="fixed inset-0 z-[1000] bg-obsidian/95 backdrop-blur-md flex items-center justify-center pt-20 pb-6 px-2 md:px-4"
        >
          {/* Height stays within the navbar/gutter band; width expands wide. */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-surface border-2 border-gold shadow-[0_0_50px_rgba(196,160,80,0.2)] inline-flex items-center justify-center overflow-hidden"
          >
            <PinchZoomImage src={src} alt="" maxW="96vw" maxH="calc(100vh - 112px)" />
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close image"
              className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-obsidian/80 border border-gold-dim text-gold text-xs flex items-center justify-center hover:bg-gold hover:text-obsidian transition-colors backdrop-blur-sm"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
    const attribution = block.quote.attribution;
    return (
      <blockquote className={styles.quote}>
        <span className={styles.quoteGlyph}>&ldquo;</span>
        <p className={styles.quoteText}>
          &ldquo;<RichText richText={block.quote.rich_text} />&rdquo;
        </p>
        {attribution && (
          <footer className={styles.quoteAttribution}>— {attribution}</footer>
        )}
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
        <span className={styles.calloutText}>
          <RichText richText={rich_text} />
        </span>
      </div>
    );
  }

  if (type === "table") {
    return <TableBlock block={block} />;
  }

  if (type === "code") {
    return <CodeBlock block={block} />;
  }

  if (type === "divider") {
    return <DividerBlock />;
  }

  if (type === "image") {
    return <ImageBlock block={block} />;
  }

  return null;
}

export default function NotionBlocks({ blocks = [] }) {
  const grouped = groupBlocks(blocks);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  return (
    <LightboxContext.Provider value={setLightboxSrc}>
    <div className={styles.blocks}>
      {grouped.map((item, i) => {
        if (item._group === "buttons") {
          return <ButtonRow key={i} items={item.items} />;
        }

        if (item._group === "bulleted_list_item") {
          return (
            <ul key={i} className={styles.ul}>
              {item.items.map((b, j) => (
                <li key={j} className={styles.li}>
                  <span className={styles.bullet}>◈</span>
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
                  <span className={styles.olNum}>[{String(j + 1).padStart(2, "0")}]</span>
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
                  <span className={b.to_do.checked ? styles.todoChecked : styles.todoText}>
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
    <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </LightboxContext.Provider>
  );
}
