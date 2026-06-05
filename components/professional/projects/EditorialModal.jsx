"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { analytics } from "@/lib/analytics";
import PinchZoomImage from "@/components/shared/PinchZoomImage";
import { useScrollLock } from "@/lib/useScrollLock";

// EditorialModal extracted from Projects.jsx so it can be mounted directly
// by the intercepting route at app/(pro)/@modal/(.)projects/[slug]. Card
// clicks navigate to /projects/<slug>; this modal renders in the @modal
// slot above the landing page. Close = router.back() with /#projects
// fallback for direct URL visits.
//
// Shared-element transitions via Framer `layoutId` rely on the card and
// the modal living under the same Motion context. Pro layout renders
// children + modal as siblings, so layoutId pairs match.

const LIST_TYPES = ["bulleted_list_item", "numbered_list_item"];

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

function getText(richText = []) {
  return richText.map((rt) => rt.plain_text ?? rt.text?.content ?? "").join("");
}

// Image captions can carry a leading `size:NN%` token (e.g. `size:50% Figure 1`)
// that controls the rendered image width. The token is stripped from the visible
// caption; whatever remains renders as a figcaption. Returns widthPercent in
// [10, 100] or null when no token is present.
const SIZE_TOKEN_RE = /^\s*size\s*:\s*(\d{1,3})%\s*/i;
function parseImageCaption(richText = []) {
  if (richText.length === 0) return { widthPercent: null, captionRichText: [] };
  const first = richText[0];
  const firstText = first.plain_text ?? first.text?.content ?? "";
  const match = firstText.match(SIZE_TOKEN_RE);
  if (!match) return { widthPercent: null, captionRichText: richText };

  const widthPercent = Math.max(10, Math.min(100, parseInt(match[1], 10)));
  const trimmed = firstText.slice(match[0].length);
  if (trimmed.length === 0) {
    return { widthPercent, captionRichText: richText.slice(1) };
  }
  const trimmedFragment = {
    ...first,
    plain_text: trimmed,
    text: first.text ? { ...first.text, content: trimmed } : first.text,
  };
  return { widthPercent, captionRichText: [trimmedFragment, ...richText.slice(1)] };
}

function RichLine({ richText = [] }) {
  return (
    <>
      {richText.map((rt, i) => {
        const text = rt.plain_text ?? rt.text?.content ?? "";
        const ann = rt.annotations ?? {};
        let node = text;
        if (ann.code) {
          node = <code className="bg-obsidian text-gold px-1 py-0.5 rounded text-[0.9em] font-mono">{text}</code>;
        }
        if (ann.italic) node = <em>{node}</em>;
        if (ann.bold) node = <strong>{node}</strong>;
        if (ann.strikethrough) node = <s>{node}</s>;
        if (ann.underline) node = <u>{node}</u>;
        const href = rt.text?.link?.url ?? rt.href ?? null;
        if (href) {
          node = (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-gold underline hover:text-gold/80">
              {node}
            </a>
          );
        }
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}

// Per-depth styling for nested lists. Notion supports unlimited nesting via
// `block[type].children`; the fetcher in lib/notion.js recursively populates
// these. We render up to 3 visible depth tiers (0/1/2) with progressively
// smaller bullets and lighter text. Anything deeper falls back to tier 2.
const BULLET_GLYPHS = ["◈", "◇", "·"];
const BULLET_STYLES = [
  "text-gold text-[10px] mt-1.5 block shrink-0 font-mono",
  "text-gold/70 text-[9px] mt-1.5 block shrink-0 font-mono",
  "text-gold/50 text-[14px] mt-0 block shrink-0 font-mono leading-none",
];
const LIST_TEXT_STYLES = [
  "text-text-dim font-sans text-[15px] leading-relaxed",
  "text-text-dim font-sans text-[14px] leading-relaxed",
  "text-text-dim/80 font-sans text-[13px] leading-relaxed",
];

const tier = (depth) => Math.min(depth, 2);

const NotionBlockRenderer = ({ block, depth = 0, openLightbox }) => {
  if (block._group === "bulleted_list_item") {
    const d = tier(depth);
    const containerCls = depth === 0
      ? "space-y-3 mb-8 pl-2"
      : "space-y-2 mt-3 pl-3";
    return (
      <ul className={containerCls}>
        {block.items.map((item, i) => {
          const children = item.bulleted_list_item.children ?? [];
          return (
            <li key={i} className={`flex gap-4 items-start ${LIST_TEXT_STYLES[d]}`}>
              <span className={BULLET_STYLES[d]}>{BULLET_GLYPHS[d]}</span>
              <div className="flex-1 min-w-0">
                <RichLine richText={item.bulleted_list_item.rich_text} />
                {children.length > 0 && <RenderBlocks blocks={children} depth={depth + 1} openLightbox={openLightbox} />}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  if (block._group === "numbered_list_item") {
    const d = tier(depth);
    const containerCls = depth === 0
      ? "space-y-4 mb-8 pl-2"
      : "space-y-2 mt-3 pl-3";
    return (
      <ol className={containerCls}>
        {block.items.map((item, i) => {
          const children = item.numbered_list_item.children ?? [];
          const marker = depth === 0
            ? `[${String(i + 1).padStart(2, "0")}]`
            : `${i + 1}.`;
          const markerCls = depth === 0
            ? "text-gold font-mono text-[10px] mt-1 shrink-0 bg-[rgba(196,160,80,0.1)] border border-gold-dim px-1.5 py-0.5 rounded group-hover:bg-gold group-hover:text-obsidian transition-colors"
            : "text-gold/70 font-mono text-[11px] mt-0.5 shrink-0";
          return (
            <li key={i} className={`flex gap-4 items-start ${LIST_TEXT_STYLES[d]} group`}>
              <span className={markerCls}>{marker}</span>
              <div className="flex-1 min-w-0">
                <RichLine richText={item.numbered_list_item.rich_text} />
                {children.length > 0 && <RenderBlocks blocks={children} depth={depth + 1} openLightbox={openLightbox} />}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  switch (block.type) {
    case "heading_1": return <h1 className="text-3xl md:text-4xl font-serif font-semibold text-text mb-6 mt-12 pb-4 border-b border-gold-dim/50 italic"><RichLine richText={block.heading_1.rich_text} /></h1>;
    case "heading_2": return <h2 className="text-[13px] font-mono text-gold mb-5 mt-12 tracking-[0.2em] uppercase"><RichLine richText={block.heading_2.rich_text} /></h2>;
    case "heading_3": return (
      <div className="flex items-center gap-3 mb-4 mt-8">
        <span className="text-gold text-[10px]">◈</span>
        <h3 className="text-xl md:text-2xl font-serif text-text italic leading-none pt-1"><RichLine richText={block.heading_3.rich_text} /></h3>
      </div>
    );
    case "paragraph": return <p className="text-text-dim font-sans text-[15px] leading-relaxed mb-6"><RichLine richText={block.paragraph.rich_text} /></p>;
    case "quote": {
      const author = block.quote.attribution ?? null;
      return (
        <blockquote className="relative p-6 md:p-8 my-10 overflow-hidden rounded-r-lg border-l-2 border-gold bg-[rgba(196,160,80,0.03)]">
          <span className="absolute -top-6 -left-4 text-9xl font-serif text-gold opacity-10 leading-none select-none">&ldquo;</span>
          <p className="relative z-10 italic text-text font-serif text-xl md:text-2xl leading-relaxed">&ldquo;<RichLine richText={block.quote.rich_text} />&rdquo;</p>
          {author && <footer className="relative z-10 text-gold font-mono text-[10px] uppercase tracking-widest mt-4">— {author}</footer>}
        </blockquote>
      );
    }
    case "callout": {
      const icon = block.callout.icon?.emoji ?? "✦";
      return (
        <div className="relative overflow-hidden bg-surface/50 backdrop-blur border-t-2 border-gold border-x border-b border-gold-dim/30 p-5 md:p-6 rounded shadow-lg my-8 flex gap-4 items-start group">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[rgba(196,160,80,0.05)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          <span className="text-gold mt-0.5 text-lg relative z-10 filter drop-shadow-[0_0_8px_rgba(196,160,80,0.5)]">{icon}</span>
          <div className="font-sans text-[14px] text-text-dim leading-relaxed relative z-10"><RichLine richText={block.callout.rich_text} /></div>
        </div>
      );
    }
    case "code": {
      const source = getText(block.code.rich_text);
      return (
        <div className="rounded-lg relative group my-8 overflow-hidden border border-gold-dim shadow-2xl">
          <div className="bg-surface border-b border-gold-dim px-4 py-2 flex justify-between items-center relative z-10">
            <div className="flex gap-2 items-center">
              <div className="flex gap-1.5 mr-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
              </div>
              <span className="text-text-dim font-mono text-[10px] tracking-widest uppercase">{block.code.language}</span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(source)}
              className="text-gold-muted hover:text-gold font-mono text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              COPY
            </button>
          </div>
          <pre className="p-5 overflow-x-auto bg-[#0a0908] relative">
            <div className="absolute inset-0 bg-cad-grid opacity-10 pointer-events-none"></div>
            <code className="text-[12px] leading-relaxed text-[#c4a050] font-mono relative z-10">{source}</code>
          </pre>
        </div>
      );
    }
    case "to_do": return (
      <div className="flex items-start gap-4 mb-3 group cursor-default">
        <div className={`mt-1 w-4 h-4 rounded-sm flex-shrink-0 flex items-center justify-center transition-colors ${block.to_do.checked ? "bg-gold border-gold text-obsidian" : "bg-transparent border border-gold-dim text-transparent group-hover:border-gold/50"}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <span className={`font-sans text-[15px] transition-colors ${block.to_do.checked ? "text-text-dim/40 line-through" : "text-text-dim group-hover:text-text"}`}><RichLine richText={block.to_do.rich_text} /></span>
      </div>
    );
    case "table": {
      const rows = block.table.children ?? [];
      const hasHeader = block.table.has_column_header;
      const bodyRows = rows.slice(hasHeader ? 1 : 0);
      return (
        <div className="overflow-x-auto my-10 border border-gold-dim rounded-lg bg-surface shadow-lg">
          <table className="w-full text-left border-collapse">
            {hasHeader && rows[0] && (
              <thead>
                <tr className="bg-obsidian border-b border-gold-dim">
                  {rows[0].table_row.cells.map((cell, i) => (
                    <th key={i} className="p-4 font-mono text-[10px] text-gold uppercase tracking-widest whitespace-nowrap">
                      <RichLine richText={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, i) => (
                <tr key={i} className="border-b border-gold-dim/20 last:border-b-0 hover:bg-[rgba(196,160,80,0.05)] transition-colors">
                  {row.table_row.cells.map((cell, j) => (
                    <td key={j} className={`p-4 font-sans text-[14px] ${j === 0 ? "text-text font-medium" : "text-text-dim"}`}>
                      <RichLine richText={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "divider": return (
      <div className="flex items-center justify-center gap-4 my-14 opacity-60">
        <div className="h-px bg-gradient-to-r from-transparent to-gold-dim w-full"></div>
        <span className="text-gold font-mono text-[10px]">◈</span>
        <div className="h-px bg-gradient-to-l from-transparent to-gold-dim w-full"></div>
      </div>
    );
    case "bookmark": {
      // Notion bookmark blocks render as styled CTA buttons matching the
      // project.links style at the top of the modal. Caption (if set) is the
      // button label; falls back to the URL.
      const url = block.bookmark.url;
      const caption = getText(block.bookmark.caption ?? []) || url;
      return (
        <div className="my-6">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 border border-gold-dim rounded-full text-gold font-mono text-[10px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-all"
          >
            {caption} <span className="font-sans">↗</span>
          </a>
        </div>
      );
    }
    case "image": {
      const url = block.image?.file?.url ?? block.image?.external?.url;
      if (!url) return null;
      const { widthPercent, captionRichText } = parseImageCaption(block.image.caption ?? []);
      const altText = getText(captionRichText) || "Project writeup image";
      return (
        <figure
          className="my-8 mx-auto"
          style={{ maxWidth: widthPercent ? `${widthPercent}%` : "100%" }}
        >
          <div
            className="overflow-hidden border border-gold-dim rounded-lg bg-surface shadow-lg cursor-zoom-in group"
            onClick={() => openLightbox && openLightbox(url)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={altText} className="w-full h-auto block" />
          </div>
          {captionRichText.length > 0 && (
            <figcaption className="mt-3 text-center font-mono text-[10px] tracking-widest uppercase text-text-dim italic">
              <RichLine richText={captionRichText} />
            </figcaption>
          )}
        </figure>
      );
    }
    case "column_list": {
      const columns = block.column_list?.children ?? [];
      if (columns.length === 0) return null;
      const colsClass = columns.length === 2 ? "md:grid-cols-2"
                      : columns.length === 3 ? "md:grid-cols-3"
                      : `md:grid-cols-${columns.length}`;
      return (
        <div className={`my-8 grid grid-cols-1 ${colsClass} gap-6`}>
          {columns.map((col, i) => (
            <div key={i} className="min-w-0">
              <RenderBlocks
                blocks={col.column?.children ?? []}
                depth={depth}
                openLightbox={openLightbox}
              />
            </div>
          ))}
        </div>
      );
    }
    case "file":
    case "pdf": {
      const data = block[block.type];
      const url = data?.file?.url ?? data?.external?.url;
      if (!url) return null;
      const filename =
        data?.name ||
        getText(data?.caption ?? []) ||
        url.split("/").pop().split("?")[0] ||
        "DOWNLOAD";
      return (
        <div className="my-6">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2 border border-gold-dim rounded-full text-gold font-mono text-[10px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-all"
          >
            <span className="font-sans">↓</span> {filename} <span className="font-sans">↗</span>
          </a>
        </div>
      );
    }
    default: return null;
  }
};

// Renders an array of Notion blocks at a given nesting depth. Used both at
// the top level (modal body) and recursively from inside list items to
// render their children. Calling groupBlocks() inside collapses consecutive
// bulleted/numbered list items into a single <ul>/<ol>.
function RenderBlocks({ blocks, depth = 0, openLightbox }) {
  return groupBlocks(blocks).map((block, index) => (
    <NotionBlockRenderer key={index} block={block} depth={depth} openLightbox={openLightbox} />
  ));
}

export default function EditorialModal({ project, onClose }) {
  const router = useRouter();
  const [mediaIndex, setMediaIndex] = useState(0);
  // Unified lightbox state: holds the URL of the image being zoomed, or null.
  // Used by both the top-of-modal media gallery AND inline body images, so the
  // zoom UX is identical regardless of where the user clicked.
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const openLightbox = (src) => setLightboxSrc(src);
  const closeLightbox = () => setLightboxSrc(null);

  // project_media_viewed — fires on each media change (dots, prev/next),
  // skipping the initial auto-shown slide.
  const mediaMounted = useRef(false);
  useEffect(() => {
    if (!mediaMounted.current) { mediaMounted.current = true; return; }
    const m = project.media?.[mediaIndex];
    if (m) analytics.projectMediaViewed(project.slug, m.type);
  }, [mediaIndex, project.media, project.slug]);

  // If a wrapper (e.g. SlugLandingChoreography) provides onClose, defer to it
  // so close = local unmount, not a route change. Otherwise fall back to
  // smart same-origin back / external replace.
  const handleClose = onClose ?? (() => {
    const ref = typeof document !== "undefined" ? document.referrer : "";
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    if (sameOrigin) {
      router.back();
    } else {
      router.replace("/#projects", { scroll: false });
    }
  });

  const currentMedia = project.media[mediaIndex];
  const isVideo = currentMedia.type === "youtube";

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (lightboxSrc) closeLightbox();
        else handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxSrc]);

  useScrollLock();

  const handleNextMedia = (e) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev + 1) % project.media.length);
  };

  const handlePrevMedia = (e) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev === 0 ? project.media.length - 1 : prev - 1));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-center items-start bg-obsidian/90 backdrop-blur-sm px-2 md:px-6 pt-20 pb-6"
      onClick={handleClose}
    >
      <motion.div
        layoutId={`container-${project.slug}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[calc(100svh-104px)] bg-surface border border-gold-dim rounded-lg shadow-2xl flex flex-col relative overflow-hidden"
      >
        <div
          className="flex-shrink-0 z-40 bg-surface/95 border-b border-gold-dim px-6 flex items-center justify-between"
          style={{ paddingTop: "8px", paddingBottom: "8px" }}
        >
          <div className="font-mono text-[10px] text-text-dim uppercase tracking-widest flex items-center gap-2">
            <span className="text-gold">◈</span> {project.title}.exe
          </div>
          <button onClick={handleClose} className="p-2 -mr-2 font-mono text-[10px] text-text-dim uppercase tracking-widest hover:text-gold transition-colors flex items-center gap-2 outline-none group">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">←</span> [ CLOSE ]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth overscroll-contain">
          <div className="w-full bg-obsidian flex flex-col border-b border-gold-dim relative group/gallery">
            <motion.div layoutId={`image-${project.slug}`} className={`w-full aspect-video relative flex flex-col justify-center items-center group ${!isVideo && currentMedia.src ? "cursor-zoom-in" : ""}`} onClick={() => { if (!isVideo && currentMedia.src) openLightbox(currentMedia.src); }}>
              {isVideo ? (
                <iframe className="absolute inset-0 w-full h-full z-20" src={`https://www.youtube.com/embed/${currentMedia.videoId}?rel=0`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
              ) : currentMedia.src ? (
                <Fragment>
                  <img src={currentMedia.src} alt={currentMedia.alt || currentMedia.placeholder || "Project media"} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute bottom-3 right-4 font-mono text-[9px] text-text-dim uppercase tracking-widest bg-surface border border-gold-dim px-2 py-1 rounded shadow z-20">CLICK TO EXPAND</div>
                </Fragment>
              ) : (
                <Fragment>
                  <div className="absolute inset-0 bg-cad-grid opacity-30"></div>
                  <div className="text-gold font-mono text-xs border border-gold-dim px-4 py-2 bg-surface shadow-lg z-10 transition-transform group-hover:scale-105">[ {currentMedia.placeholder ?? currentMedia.alt ?? "PREVIEW"} ]</div>
                  <div className="absolute bottom-3 right-4 font-mono text-[9px] text-text-dim uppercase tracking-widest bg-surface border border-gold-dim px-2 py-1 rounded shadow z-10">CLICK TO EXPAND</div>
                </Fragment>
              )}
              {project.media.length > 1 && (
                <Fragment>
                  <button onClick={handlePrevMedia} className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-surface/80 border border-gold-dim text-gold opacity-0 group-hover/gallery:opacity-100 flex items-center justify-center hover:bg-gold hover:text-obsidian transition-all shadow-lg backdrop-blur-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                  <button onClick={handleNextMedia} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-surface/80 border border-gold-dim text-gold opacity-0 group-hover/gallery:opacity-100 flex items-center justify-center hover:bg-gold hover:text-obsidian transition-all shadow-lg backdrop-blur-sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </Fragment>
              )}
            </motion.div>

            {project.media.length > 1 && (
              <div className="flex justify-center items-center gap-5 py-4 bg-surface/30 border-t border-gold-dim/50">
                {project.media.map((_, idx) => (
                  <button key={idx} onClick={(e) => { e.stopPropagation(); setMediaIndex(idx); }} aria-label={`View media ${idx + 1}`} className={`rounded-full transition-all duration-300 relative cursor-pointer ${idx === mediaIndex ? "w-2.5 h-2.5 bg-gold shadow-[0_0_10px_rgba(196,160,80,0.8)]" : "w-2 h-2 bg-text-dim/40 hover:bg-gold/60 hover:scale-125"}`}><span className="absolute inset-[-8px]"></span></button>
                ))}
              </div>
            )}
          </div>

          <div className="py-10 px-8 md:px-14 w-full">
            <motion.div layoutId={`header-${project.slug}`} className="mb-8 text-center">
              <div className="text-gold font-mono text-[10px] tracking-[0.2em] mb-3 uppercase">{project.category}</div>
              <h1 className="text-4xl font-serif text-text mb-4">{project.title}</h1>
            </motion.div>

            {project.links && project.links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mb-10 pb-10 border-b border-gold-dim/30">
                {project.links.map((link) => (
                  <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => analytics.projectLinkClicked(project.slug, link.name)} className="flex items-center gap-2 px-5 py-2 border border-gold-dim rounded-full text-gold font-mono text-[9px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-all">{link.name} <span className="font-sans">↗</span></a>
                ))}
              </div>
            )}

            <div className="mb-10 flex flex-wrap gap-2 justify-center">
              {project.techStack.map((tech) => (
                <span key={tech} className="px-3 py-1.5 bg-obsidian border border-gold-dim text-text-dim text-[10px] rounded uppercase font-mono">{tech}</span>
              ))}
            </div>

            <div className="content-blocks pb-12">
              <p className="text-text font-sans font-medium text-[16px] leading-relaxed mb-10 border-l-2 border-gold pl-5">{project.summary}</p>
              <RenderBlocks blocks={project.body ?? []} openLightbox={openLightbox} />
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {lightboxSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="fixed inset-0 z-[100] bg-obsidian/95 backdrop-blur-md flex items-center justify-center pt-20 pb-6 px-2 md:px-4">
            {/* Top padding (pt-20) keeps the image in the same band as the modal,
                clear of the fixed navbar (z-100) which paints over this z-50
                subtree. Height matches the modal (100vh − navbar/gutters); width
                expands toward the full screen. */}
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} onClick={(e) => e.stopPropagation()} className="relative bg-surface border-2 border-gold shadow-[0_0_50px_rgba(196,160,80,0.2)] inline-flex items-center justify-center overflow-hidden">
              <PinchZoomImage src={lightboxSrc} alt="" maxW="96vw" maxH="calc(100vh - 112px)" />
              <button
                onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                aria-label="Close image"
                className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-obsidian/80 border border-gold-dim text-gold text-xs flex items-center justify-center hover:bg-gold hover:text-obsidian transition-colors backdrop-blur-sm"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
