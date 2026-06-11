"use client";

import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FALLBACK_EXPERIENCES } from "@/data/experiences";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import SectionFrame from "./SectionFrame";
import { TelemetryGrid, TelemetryItem } from "./Telemetry";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";

// In-line card expansion preserved from Experiences - Final.html:
// click a card → it expands in-place (no modal, no route nav). Cards have
// shimmer-sheen, hover-glow, data-flow-border, scroll-driven mobile
// highlight, and DecryptText scramble-on-reveal for paragraph/callout/
// list content. The /experiences/[slug] intercepting route still exists
// for direct URL visits (renders ExperienceDetail), but isn't exercised
// by card click in this flow.
//
// Block renderer reads Notion API block shapes
// (`block.paragraph.rich_text` etc). Lists are grouped via groupBlocks()
// into <ul>/<ol> wrappers. RichLine renders annotated rich text
// (bold/italic/code/links). DecryptText only animates plain-text
// extraction — annotations are stripped within decrypted blocks
// (paragraph/callout/list items). h3 + quote + table use RichLine
// directly to preserve formatting.

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

const DecryptText = ({ text, isVisible }) => {
  const [displayText, setDisplayText] = useState("");
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
  useEffect(() => {
    if (!isVisible) { setDisplayText(""); return; }
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(text.split("").map((letter, index) => {
        if (index < iteration) return text[index];
        if (letter === " ") return " ";
        return letters[Math.floor(Math.random() * 26)];
      }).join(""));
      if (iteration >= text.length) clearInterval(interval);
      iteration += 3;
    }, 10);
    return () => clearInterval(interval);
  }, [text, isVisible]);
  return <span>{displayText}</span>;
};

const NotionBlockRenderer = ({ block, isActive }) => {
  // Grouped lists (bulleted/numbered) — synthesized by groupBlocks
  if (block._group === "bulleted_list_item" || block._group === "numbered_list_item") {
    const isNumbered = block._group === "numbered_list_item";
    const Tag = isNumbered ? "ol" : "ul";
    return (
      <Tag className="space-y-4 mb-8">
        {block.items.map((item, i) => {
          const text = getText(item[block._group].rich_text);
          return (
            <li key={i} className="flex gap-4 items-start text-text-dim font-sans text-base leading-relaxed">
              <span className="text-gold text-[10px] mt-1.5 block font-mono">
                {isNumbered ? `[${String(i + 1).padStart(2, "0")}]` : "✦"}
              </span>
              <span><DecryptText text={text} isVisible={isActive} /></span>
            </li>
          );
        })}
      </Tag>
    );
  }

  switch (block.type) {
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      // Local renderer historically only styled h3 — preserve that look for
      // any heading level the user types in Notion (so h1/h2 don't render
      // unstyled).
      return <h3 className="text-xl md:text-2xl font-serif text-gold mb-4 mt-10 italic"><RichLine richText={block[block.type].rich_text} /></h3>;
    }
    case "paragraph": {
      const text = getText(block.paragraph.rich_text);
      return (
        <p className="text-text-dim font-sans text-base leading-relaxed mb-6">
          <DecryptText text={text} isVisible={isActive} />
        </p>
      );
    }
    case "quote": {
      const author = block.quote.attribution ?? null;
      return (
        <blockquote className="border-l-2 border-gold pl-5 py-2 my-8 bg-gradient-to-r from-[rgba(196,160,80,0.05)] to-transparent">
          <p className="italic text-text font-serif text-xl leading-relaxed">&ldquo;<RichLine richText={block.quote.rich_text} />&rdquo;</p>
          {author && <footer className="text-gold font-mono text-[10px] uppercase tracking-widest mt-2">— {author}</footer>}
        </blockquote>
      );
    }
    case "callout": {
      const icon = block.callout.icon?.emoji ?? "✦";
      const text = getText(block.callout.rich_text);
      return (
        <div className="bg-[rgba(196,160,80,0.05)] border border-gold-dim p-4 rounded mt-4 mb-8 flex gap-4 items-start">
          <span className="text-gold mt-0.5 text-sm">{icon}</span>
          <div className="font-sans text-[15px] text-text-dim leading-relaxed">
            <DecryptText text={text} isVisible={isActive} />
          </div>
        </div>
      );
    }
    case "table": {
      const rows = block.table.children ?? [];
      const hasHeader = block.table.has_column_header;
      const bodyRows = rows.slice(hasHeader ? 1 : 0);
      return (
        <div className="overflow-x-auto my-8 border border-gold-dim rounded-lg bg-surface">
          <table className="w-full text-left border-collapse">
            {hasHeader && rows[0] && (
              <thead>
                <tr className="bg-[rgba(196,160,80,0.05)] border-b border-gold-dim">
                  {rows[0].table_row.cells.map((cell, i) => (
                    <th key={i} className="p-3 font-mono text-[10px] text-gold uppercase tracking-widest">
                      <RichLine richText={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, i) => (
                <tr key={i} className="border-b border-gold-dim/30 last:border-b-0 hover:bg-obsidian/50 transition-colors">
                  {row.table_row.cells.map((cell, j) => (
                    <td key={j} className={`p-3 font-sans text-[13px] ${j === 0 ? "text-text font-medium" : "text-text-dim"}`}>
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
      <div className="flex items-center justify-center gap-4 my-10 opacity-60">
        <div className="h-px bg-gradient-to-r from-transparent to-gold-dim w-full"></div>
        <span className="text-gold font-mono text-[10px]">◈</span>
        <div className="h-px bg-gradient-to-l from-transparent to-gold-dim w-full"></div>
      </div>
    );
    case "file":
    case "pdf": {
      const data = block[block.type];
      const url = data?.file?.url ?? data?.external?.url;
      if (!url) return null;
      const rawName =
        data?.name ||
        getText(data?.caption ?? []) ||
        url.split("/").pop().split("?")[0] ||
        "DOCUMENT";
      const isExternal = data?.type === "external";
      const ext = isExternal
        ? "LINK"
        : rawName.includes(".")
          ? rawName.split(".").pop().toUpperCase().slice(0, 4)
          : block.type === "pdf" ? "PDF" : "FILE";
      const displayName = rawName.replace(/\.[^/.]+$/, "") || rawName;
      return (
        <div className="my-8">
          <a href={url} target="_blank" rel="noopener noreferrer" className="exp-file-link block relative overflow-hidden max-w-sm">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] exp-file-bar" />
            <div className="pl-5 pr-4 py-3.5 flex items-center gap-3">
              <span className="exp-file-ext font-mono text-[9px] uppercase tracking-[0.2em] flex-shrink-0">{ext}</span>
              <div className="exp-file-divider w-px h-3.5 flex-shrink-0" />
              <span className="exp-file-name font-sans text-[13px] leading-snug truncate flex-grow">{displayName}</span>
              <span className="exp-file-arrow font-mono text-[11px] flex-shrink-0">↗</span>
            </div>
            <div className="exp-file-shimmer absolute inset-0 pointer-events-none" />
          </a>
        </div>
      );
    }
    default: return null;
  }
};

const ExperienceCard = ({ exp, isActive, onToggle, itemRefs }) => {
  // Time the card stays expanded → experience_collapsed.
  useDwellDuration(isActive, (d) => analytics.experienceCollapsed(exp.slug, d));

  const handleMouseMove = (e) => {
    const el = itemRefs.current[exp.slug];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      layout
      ref={(el) => (itemRefs.current[exp.slug] = el)}
      onMouseMove={handleMouseMove}
      onClick={() => onToggle(exp.slug)}
      className={`exp-card group hover-lift shimmer-sheen hover-glow data-flow-border bg-transparent border-b border-gold-dim overflow-hidden cursor-pointer rounded-lg ${isActive ? "active" : ""}`}
      style={isActive ? { background: "rgba(196,160,80,0.03)", borderColor: "transparent" } : {}}
    >
      <motion.div layout="position" className="px-4 py-8 md:p-8 flex flex-col md:flex-row gap-4 md:gap-16 items-start relative z-10">
        <div className="md:w-48 flex-shrink-0 pt-1">
          <div className="text-text font-mono text-sm tracking-wider mb-2">{exp.date}</div>
          <div className="text-gold-muted font-mono text-[9px] uppercase tracking-widest">{exp.category}</div>
        </div>
        <div className="flex-grow flex justify-between items-start w-full">
          <div>
            <motion.h2 layout="position" className={`text-3xl md:text-4xl font-serif mb-2 transition-colors duration-300 group-hover:text-gold ${isActive ? "text-gold italic" : "text-text italic"}`}>{exp.role}</motion.h2>
            <motion.div layout="position" className="text-text-dim font-mono text-sm tracking-wider mb-6">{exp.organization}</motion.div>
            <div className="flex flex-wrap gap-3">
              {exp.techStack.map((tech) => (
                <span key={tech} className={`px-3 py-1.5 border font-mono text-[10px] tracking-widest rounded uppercase transition-colors duration-300 ${isActive ? "border-gold text-gold bg-[rgba(196,160,80,0.1)]" : "border-gold-dim text-text-dim bg-obsidian/50"}`}>{tech}</span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="relative z-10"
          >
            <div className="px-4 md:px-8 pb-10 md:ml-64 mr-8 cursor-auto" onClick={(e) => {
              if (e.target.closest("a") || e.target.closest("pre")) e.stopPropagation();
            }}>
              <div className="border-t border-gold-dim/20 pt-8 mt-2">
                {groupBlocks(exp.body ?? []).map((block, index) => (
                  <NotionBlockRenderer key={index} block={block} isActive={isActive} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function Experiences({
  experiences = FALLBACK_EXPERIENCES,
  copy = FALLBACK_SECTION_COPY.experiences,
  extraCopy = FALLBACK_SECTION_COPY["experiences-extra"],
}) {
  const [activeSlug, setActiveSlug] = useState(null);
  const itemRefs = useRef({});

  const workItems = experiences.filter((e) => e.kind === "work");
  const extracurricularItems = experiences.filter((e) => e.kind === "extracurricular");

  // URL ↔ accordion sync. Inline accordion stays as the click experience
  // (memory: inline expansion was deliberate). We push /?exp=<slug> via the
  // history API so the URL is shareable without triggering a Next route
  // change. Direct visits to /experiences/<slug> still hit the canonical
  // full-page renderer.
  const slugSet = useMemo(
    () => new Set(experiences.map((e) => e.slug)),
    [experiences]
  );

  // Initialize from ?exp= on mount. Two-phase reveal so the URL-arrived
  // user lands on the section the way a navbar click would: scroll to the
  // section first (~150ms beat so they perceive the landing), then expand
  // the accordion + fine-tune scroll once the expansion settles.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("exp");
    if (!initial || !slugSet.has(initial)) return;

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const behavior = reducedMotion ? "auto" : "smooth";

    // Phase 1 (immediate): smooth-scroll to the Experiences section anchor
    // — matches the navbar pill's behavior so the URL feels like a deep
    // navbar link. Done before expanding the accordion so the user sees
    // the section land first.
    const section = document.getElementById("experience");
    section?.scrollIntoView({ behavior, block: "start" });

    // Phase 2 (after section scroll settles): open the accordion. The
    // expansion animation runs for ~500ms (height: auto + spring).
    const expandTimer = setTimeout(() => {
      setActiveSlug(initial);
    }, reducedMotion ? 0 : 650);

    // Phase 3 (after expansion settles): fine-tune scroll to the specific
    // card so it's centered, not just the section eyebrow.
    const fineScrollTimer = setTimeout(() => {
      const el = itemRefs.current[initial];
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior });
    }, reducedMotion ? 0 : 1250);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(fineScrollTimer);
    };
  }, [slugSet]);

  // Browser back/forward changes ?exp= → mirror into state
  useEffect(() => {
    function onPop() {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("exp");
      setActiveSlug(next && slugSet.has(next) ? next : null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [slugSet]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest(".exp-card")) return;
      if (activeSlug) {
        setActiveSlug(null);
        syncUrl(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeSlug]);

  function syncUrl(slug) {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("exp", slug);
    else url.searchParams.delete("exp");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  useEffect(() => {
    if (activeSlug) {
      Object.values(itemRefs.current).forEach((ref) => { if (ref) ref.classList.remove("mobile-highlight"); });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.filter((e) => e.isIntersecting);
      if (intersecting.length > 0) {
        Object.values(itemRefs.current).forEach((ref) => ref?.classList.remove("mobile-highlight"));
        intersecting[0].target.classList.add("mobile-highlight");
      }
    }, {
      rootMargin: "-49% 0px -49% 0px",
      threshold: 0,
    });

    Object.values(itemRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [activeSlug]);

  const toggleExperience = (slug) => {
    const isOpening = activeSlug !== slug;
    const next = isOpening ? slug : null;
    if (isOpening) analytics.experienceExpanded(experiences.find((e) => e.slug === slug));
    setActiveSlug(next);
    syncUrl(next);
    if (isOpening) {
      setTimeout(() => {
        const element = itemRefs.current[slug];
        if (element) {
          const y = element.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 350);
    }
  };

  return (
    <div id="experience" className="bg-obsidian py-20 px-6 md:px-12 relative">
      <div className="max-w-6xl mx-auto relative z-10">

        <SectionFrame
          eyebrow={`✦ ${copy.eyebrow}`}
          title={copy.title}
          description={copy.intro}
        />

        <div className="text-gold font-mono text-[10px] tracking-[0.18em] mb-3 uppercase opacity-60">Work</div>

        <TelemetryGrid layout className={`flex flex-col gap-6 mb-12 ${activeSlug ? "has-active" : ""}`}>
          {workItems.map((exp) => (
            <TelemetryItem key={exp.slug}>
              <ExperienceCard exp={exp} isActive={activeSlug === exp.slug} onToggle={toggleExperience} itemRefs={itemRefs} />
            </TelemetryItem>
          ))}
        </TelemetryGrid>

        <SectionFrame
          eyebrow={`✦ ${extraCopy.eyebrow}`}
          title={extraCopy.title}
          description={extraCopy.intro || undefined}
        />

        <TelemetryGrid layout className={`flex flex-col gap-6 ${activeSlug ? "has-active" : ""}`}>
          {extracurricularItems.map((exp) => (
            <TelemetryItem key={exp.slug}>
              <ExperienceCard exp={exp} isActive={activeSlug === exp.slug} onToggle={toggleExperience} itemRefs={itemRefs} />
            </TelemetryItem>
          ))}
        </TelemetryGrid>

      </div>

      <style jsx global>{`
        .exp-card { transition: filter 0.5s ease, opacity 0.5s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease; position: relative; }

        @media (hover: hover) {
          .hover-lift:hover { transform: translateY(-4px) scale(1.01); box-shadow: 0 10px 30px -10px rgba(196,160,80,0.15); border-color: rgba(196,160,80,0.4); }
          .shimmer-sheen:hover::after { left: 200%; }
          .hover-glow:hover::before { opacity: 1; }
        }

        .shimmer-sheen { position: relative; overflow: hidden; }
        .shimmer-sheen::after {
          content: ''; position: absolute; top: 0; left: -150%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(196,160,80,0.08), transparent);
          transform: skewX(-20deg); transition: left 0.6s cubic-bezier(0.4,0,0.2,1); pointer-events: none; z-index: 20;
        }

        @media (hover: hover) {
          .has-active .exp-card:not(.active) { filter: blur(2px) grayscale(60%); opacity: 0.35; }
        }
        @media (hover: none) {
          .has-active .exp-card:not(.active) { opacity: 0.45; }
        }

        @media (max-width: 768px) {
          .exp-card:not(.active).mobile-highlight { transform: translateY(-4px) scale(1.02); box-shadow: 0 15px 35px -10px rgba(196,160,80,0.2); border-color: rgba(196,160,80,0.5); }
          .exp-card:not(.active).mobile-highlight::before { opacity: 1; }
          .exp-card:not(.active).mobile-highlight::after { left: 200%; }
          .exp-card:not(.active).mobile-highlight h2 { color: #c4a050 !important; }
        }

        .data-flow-border::before {
          content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px;
          background: conic-gradient(from var(--angle), transparent 70%, #c4a050 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; animation: exp-spin 3s linear infinite;
          opacity: 0; transition: opacity 0.5s ease; pointer-events: none;
        }
        .exp-card.active .data-flow-border::before { opacity: 1; }
        @property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes exp-spin { from { --angle: 0deg; } to { --angle: 360deg; } }

        .hover-glow { position: relative; }
        .hover-glow::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; transition: opacity 0.3s ease; pointer-events: none; z-index: 0;
          background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(196,160,80,0.1), transparent 40%);
        }

        .exp-file-link {
          border: 1px solid rgba(196,160,80,0.15);
          background: rgba(196,160,80,0.018);
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
          transition: border-color 0.3s ease, background 0.3s ease;
        }
        .exp-file-link:hover { border-color: rgba(196,160,80,0.5); background: rgba(196,160,80,0.045); }
        .exp-file-bar { background: rgba(196,160,80,0.28); transition: background 0.3s ease; }
        .exp-file-link:hover .exp-file-bar { background: #c4a050; }
        .exp-file-ext { color: rgba(196,160,80,0.6); transition: color 0.2s ease; }
        .exp-file-link:hover .exp-file-ext { color: rgba(196,160,80,0.95); }
        .exp-file-divider { background: rgba(196,160,80,0.2); }
        .exp-file-name { color: rgba(255,255,255,0.88); transition: color 0.2s ease; }
        .exp-file-link:hover .exp-file-name { color: #c4a050; }
        .exp-file-arrow { color: rgba(196,160,80,0.45); transition: color 0.2s ease, transform 0.2s ease; }
        .exp-file-link:hover .exp-file-arrow { color: #c4a050; transform: translate(2px, -2px); }
        .exp-file-shimmer {
          background: linear-gradient(110deg, transparent 30%, rgba(196,160,80,0.07) 50%, transparent 70%);
          transform: translateX(-120%);
        }
        .exp-file-link:hover .exp-file-shimmer {
          transform: translateX(220%);
          transition: transform 0.55s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </div>
  );
}
