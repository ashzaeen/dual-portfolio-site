"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FALLBACK_EDUCATION,
  FALLBACK_CERTIFICATIONS,
  FALLBACK_COURSEWORK,
  FALLBACK_CURIOSITY,
} from "@/data/credentials";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import SectionFrame from "./SectionFrame";
import { TelemetryGrid, TelemetryItem } from "./Telemetry";
import { analytics } from "@/lib/analytics";

// All four sub-sections (Education / Certifications / Coursework / Curiosity)
// are driven by props. Page-level fetch composes them via fetchCredentials()
// which Promise.all's four sub-fetchers (each falls back independently).
//
// Polish preserved: `/` keybind opens search modal across Coursework +
// Curiosity, CopyText hash/insight scramble, hover-glow + shimmer-sheen on
// cert cards, cred-blink terminal cursor, console-log easter egg.
//
// Cert title kept at `text-xl md:text-2xl font-mono` per the locked
// pro-layout-finals rule (Projects/Credentials card titles stay mono).

const CopyText = ({ text, label, className, onCopy }) => {
  const [displayText, setDisplayText] = useState(text);
  const [isCopied, setIsCopied] = useState(false);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  // Keep display in sync if the source text changes (e.g., Notion refresh).
  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    onCopy?.();
    setIsCopied(true);

    const targetText = label || "[ COPIED TO CLIPBOARD ]";
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(targetText.split("").map((char, idx) => {
        if (idx < iteration) return targetText[idx];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(""));
      if (iteration >= targetText.length) clearInterval(interval);
      iteration += 1;
    }, 20);

    setTimeout(() => {
      let revIter = 0;
      const revInterval = setInterval(() => {
        setDisplayText(text.split("").map((char, idx) => {
          if (idx < revIter) return text[idx];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join(""));
        if (revIter >= text.length) {
          clearInterval(revInterval);
          setIsCopied(false);
        }
        revIter += 1;
      }, 20);
    }, 1500);
  };

  return (
    <span onClick={handleCopy} className={`cursor-pointer transition-colors ${isCopied ? "text-gold" : className}`} title="Click to copy">
      {displayText}
    </span>
  );
};

export default function Credentials({
  credentials = {
    education: FALLBACK_EDUCATION,
    certifications: FALLBACK_CERTIFICATIONS,
    coursework: FALLBACK_COURSEWORK,
    curiosity: FALLBACK_CURIOSITY,
  },
  copy = FALLBACK_SECTION_COPY.credentials,
}) {
  const { education, certifications, coursework, curiosity } = credentials;

  useEffect(() => {
    console.log(
      `%c
   ◈ OBSIDIAN GOLD OS ◈
   > SYS_ADMIN: ASHZAEEN
   > CLEARANCE: LEVEL_9
   > RUNNING DIAGNOSTICS... [OK]
      `,
      "color: #c4a050; background: #0f0e0c; font-size: 14px; font-family: monospace; padding: 20px; border: 1px solid #c4a050; border-radius: 4px;"
    );
  }, []);

  const [hoveredCert, setHoveredCert] = useState(null);
  const [hoveredCoursework, setHoveredCoursework] = useState(null);
  const [hoveredCuriosity, setHoveredCuriosity] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const itemRefs = useRef({});

  // Shared hover-dwell timer (only one card is hovered at a time). endHover
  // fires `fire(durationMs)` when the pointer leaves after ≥500ms.
  const hoverStartRef = useRef(0);
  const startHover = () => { hoverStartRef.current = performance.now(); };
  const endHover = (fire) => {
    const d = Math.round(performance.now() - (hoverStartRef.current || 0));
    const ok = hoverStartRef.current && d >= 500;
    hoverStartRef.current = 0;
    if (ok) fire(d);
  };

  const openSearch = () => {
    if (!isSearchOpen) analytics.credentialSearchOpened();
    setIsSearchOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") setIsSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search_performed — fires ~400ms after the visitor stops typing.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!isSearchOpen || !q) return;
    const t = setTimeout(() => {
      analytics.credentialSearchPerformed(q, filteredCoursework.length + filteredCuriosity.length);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isSearchOpen]);

  const handleMouseMove = (e, idx) => {
    const el = itemRefs.current[idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  const filteredCoursework = coursework.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.category ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.insight ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCuriosity = curiosity.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.insight ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="credentials" className="bg-obsidian py-20 px-6 md:px-12 relative">

      <div className="max-w-6xl mx-auto relative z-10">

        <header className="mb-[30px] flex justify-between items-end flex-wrap gap-6">
          <SectionFrame
            eyebrow={`✦ ${copy.eyebrow}`}
            title={copy.title}
            description={copy.intro}
            className="!mb-0"
          />
          <div
            onClick={openSearch}
            className="hidden md:flex items-center gap-2 bg-surface border border-gold-dim px-3 py-1.5 rounded cursor-pointer hover:border-gold transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4a050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span className="text-text-dim font-mono text-[10px] tracking-widest">PRESS <kbd className="text-gold">/</kbd> TO SEARCH</span>
          </div>
        </header>

        {/* EDUCATION — now iterates so multi-degree (Masters/PhD) can stack later */}
        {education.length > 0 && (
          <div className="mb-16 pb-16 border-b border-gold-dim/30">
            <h4 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-6">Education</h4>
            <TelemetryGrid className="flex flex-col gap-10">
              {education.map((edu, idx) => (
                <TelemetryItem key={idx} className="flex flex-col md:flex-row gap-4 md:gap-16 items-start px-1">
                  <div className="md:w-48 flex-shrink-0">
                    <div className="text-text font-mono text-sm tracking-wider mb-1">{edu.date}</div>
                    <div className="text-gold-muted font-mono text-[9px] uppercase tracking-widest">{edu.category}</div>
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-serif italic text-text mb-1">{edu.degree}</h2>
                    <div className="text-text-dim font-mono text-sm tracking-wider mb-4">{edu.institution}</div>
                    <div className="flex flex-wrap gap-2">
                      {(edu.tags ?? []).map((t) => (
                        <span key={t} className="px-3 py-1 border border-gold-dim bg-obsidian text-text-dim font-mono text-[9px] uppercase tracking-widest rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </TelemetryItem>
              ))}
            </TelemetryGrid>
          </div>
        )}

        {/* CERTIFICATIONS */}
        {certifications.length > 0 && (
          <div className="mb-24">
            <h4 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-6">Certifications</h4>
            <TelemetryGrid className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certifications.map((cert, idx) => (
                <TelemetryItem key={idx} className="flex">
                <div
                  ref={(el) => (itemRefs.current[idx] = el)}
                  onMouseMove={(e) => handleMouseMove(e, idx)}
                  onMouseEnter={() => { startHover(); setHoveredCert(idx); }}
                  onMouseLeave={() => { endHover((d) => analytics.certificationHovered(cert.title, cert.issuer, d)); setHoveredCert(null); }}
                  className="cert-card shimmer-sheen hover-glow bg-surface border border-gold-dim rounded-lg p-5 md:p-6 flex flex-col group cursor-default relative overflow-hidden w-full"
                >
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-5">
                      <span className="text-gold font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 border border-gold-dim rounded flex items-center gap-2 bg-obsidian/80">
                        <div className="w-1.5 h-1.5 bg-gold rounded-full group-hover:animate-pulse" />
                        STATUS: {cert.verification}
                      </span>
                      <span className="text-text-dim font-mono text-[10px] tracking-widest mt-0.5">{cert.date}</span>
                    </div>

                    <div className="flex-grow">
                      <h2 className="text-xl md:text-2xl font-mono text-text group-hover:text-gold transition-colors mb-1.5 leading-tight">
                        {cert.title}
                      </h2>
                      <div className="text-text-dim font-sans text-xs md:text-sm">{cert.issuer}</div>

                      {cert.link && (
                        <div className="mt-4">
                          <a href={cert.link.url} target="_blank" rel="noreferrer" onClick={() => analytics.credentialLinkClicked(cert.title, "certification")} className="inline-flex items-center gap-2 px-4 py-1.5 border border-gold-dim rounded-md text-gold font-mono text-[9px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-all">
                            {cert.link.label} <span>↗</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {cert.hash && (
                      <div className="mt-6 pt-4 border-t border-gold-dim/30 flex justify-between items-center">
                        <span className="text-gold-muted font-mono text-[9px] uppercase tracking-widest">HASH:</span>
                        <CopyText
                          text={cert.hash}
                          label="COPIED_HASH"
                          onCopy={() => analytics.credentialHashCopied(cert.title)}
                          className="text-gold-muted group-hover:text-gold font-mono text-[10px] tracking-widest hover:underline"
                        />
                      </div>
                    )}
                  </div>
                </div>
                </TelemetryItem>
              ))}
            </TelemetryGrid>
          </div>
        )}

        {/* COURSEWORK & CURIOSITY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12">

          {/* COURSEWORK */}
          {coursework.length > 0 && (
            <div>
              <h4 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-6">Coursework</h4>
              <TelemetryGrid className="flex flex-col border-t border-gold-dim/30 max-h-[420px] overflow-y-auto overflow-x-hidden creds-scroll pr-1">
                {coursework.map((course, idx) => {
                  const isHovered = hoveredCoursework === idx;
                  return (
                  <TelemetryItem key={idx}>
                  <div
                    onMouseEnter={() => { startHover(); setHoveredCoursework(idx); }}
                    onMouseLeave={() => { endHover((d) => analytics.courseworkHovered(course.name, course.provider, d)); setHoveredCoursework(null); }}
                    className={`course-row py-4 border-b border-gold-dim/30 flex flex-col group cursor-default px-3 transition-colors -mx-3 ${isHovered ? "bg-[rgba(196,160,80,0.05)]" : ""}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-grow pr-4">
                        <div className={`font-sans text-base transition-colors ${isHovered ? "text-gold" : "text-text"}`}>{course.name}</div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {course.category && (
                            <span className="text-text-dim font-mono text-[9px] uppercase tracking-widest border border-gold-dim/50 px-1.5 py-0.5 rounded bg-obsidian">{course.category}</span>
                          )}
                          <span className={`font-mono text-[11px] tracking-wider transition-colors ${isHovered ? "text-gold-muted" : "text-text-dim"}`}>{course.provider}</span>
                        </div>
                      </div>
                      {course.link && (
                        <div className="flex-shrink-0">
                          <a href={course.link} target="_blank" rel="noreferrer" onClick={() => analytics.credentialLinkClicked(course.name, "coursework")} className="px-3 py-1.5 border border-gold-dim rounded text-gold font-mono text-[9px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-colors whitespace-nowrap">
                            {course.linkLabel || "View"} ↗
                          </a>
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {isHovered && course.insight && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-3 flex gap-2">
                            <span className="text-gold-muted font-mono text-[10px] uppercase tracking-widest mt-0.5 shrink-0">&gt;&nbsp;INSIGHT:</span>
                            <CopyText
                              text={course.insight}
                              className="text-text-dim font-mono text-[12px] hover:text-gold"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  </TelemetryItem>
                  );
                })}
              </TelemetryGrid>
            </div>
          )}

          {/* CURIOSITY */}
          {curiosity.length > 0 && (
            <div>
              <h4 className="font-mono text-xs text-text-dim uppercase tracking-widest mb-6">Curiosity</h4>
              <div className="bg-surface border border-gold-dim rounded-lg p-6 font-mono text-[13px] leading-relaxed h-full relative overflow-hidden">

                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-gold-dim/30">
                  <span className="text-gold-muted">❯</span>
                  <span className="text-text-dim">query:</span>
                  <span className="text-gold">/sys/intel --verbose</span>
                  <span className="cred-blink text-gold">_</span>
                </div>

                <TelemetryGrid className="flex flex-col max-h-[320px] overflow-y-auto overflow-x-hidden creds-scroll pr-1">
                  {curiosity.map((item, idx) => {
                    const isHovered = hoveredCuriosity === idx;
                    return (
                      <TelemetryItem key={idx}>
                      <div
                        onMouseEnter={() => { startHover(); setHoveredCuriosity(idx); }}
                        onMouseLeave={() => { endHover((d) => analytics.curiosityHovered(item.title, item.category, d)); setHoveredCuriosity(null); }}
                        className={`flex flex-col cursor-default px-3 py-3 -mx-3 rounded transition-colors ${isHovered ? "bg-[rgba(196,160,80,0.05)]" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <motion.div animate={{ x: isHovered ? 4 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex gap-2">
                            <span className="text-gold opacity-50 shrink-0">·</span>
                            <span className={isHovered ? "text-gold" : "text-text"}>{item.title}</span>
                          </motion.div>
                          <span className={`text-[9px] uppercase tracking-widest shrink-0 ml-4 ${isHovered ? "text-gold" : "text-text-dim/40"}`}>
                            [{item.category}]
                          </span>
                        </div>

                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3 pl-4 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                                <div className="flex gap-2 pr-4">
                                  <span className="text-gold-muted text-[10px] uppercase tracking-widest mt-0.5 shrink-0">&#62;&nbsp;INSIGHT:</span>
                                  <CopyText
                                    text={item.insight}
                                    className="text-text-dim text-[12px] hover:text-gold"
                                  />
                                </div>
                                {item.link && (
                                  <a href={item.link.url} target="_blank" rel="noreferrer" onClick={() => analytics.credentialLinkClicked(item.title, "curiosity")} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 border border-gold-dim rounded text-gold font-mono text-[9px] uppercase tracking-widest hover:bg-[rgba(196,160,80,0.1)] hover:border-gold transition-colors whitespace-nowrap">
                                    {item.link.label} <span>↗</span>
                                  </a>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      </TelemetryItem>
                    );
                  })}
                </TelemetryGrid>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* SEARCH OVERLAY */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-obsidian/80 backdrop-blur-md flex justify-center items-start pt-32 px-4"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ y: -20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: -20, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-surface border border-gold shadow-[0_0_50px_rgba(196,160,80,0.15)] rounded-lg overflow-hidden flex flex-col"
            >
              <div className="flex items-center px-6 py-4 border-b border-gold-dim/50">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4a050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-text font-mono text-lg placeholder-text-dim"
                />
                <kbd className="hidden sm:inline-block border border-gold-dim text-text-dim font-mono text-[10px] px-2 py-1 rounded bg-obsidian">ESC</kbd>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {searchQuery && filteredCoursework.length === 0 && filteredCuriosity.length === 0 ? (
                  <div className="p-8 text-center text-text-dim font-mono text-sm">NO RECORDS FOUND</div>
                ) : (
                  <>
                    {filteredCoursework.length > 0 && (
                      <div className="px-2 py-4">
                        <div className="px-4 text-gold-muted font-mono text-[10px] uppercase tracking-widest mb-2">Coursework</div>
                        {filteredCoursework.map((c, i) => (
                          <div key={i} className="px-4 py-3 hover:bg-[rgba(196,160,80,0.1)] rounded mx-2 flex justify-between cursor-pointer group transition-colors">
                            <span className="text-text group-hover:text-gold font-sans">{c.name}</span>
                            <span className="text-text-dim font-mono text-[10px]">{c.category}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {filteredCuriosity.length > 0 && (
                      <div className="px-2 py-4 border-t border-gold-dim/30">
                        <div className="px-4 text-gold-muted font-mono text-[10px] uppercase tracking-widest mb-2">Curiosity</div>
                        {filteredCuriosity.map((c, i) => (
                          <div key={i} className="px-4 py-3 hover:bg-[rgba(196,160,80,0.1)] rounded mx-2 flex flex-col cursor-pointer group transition-colors">
                            <span className="text-text group-hover:text-gold font-mono text-sm mb-1">{c.title}</span>
                            <span className="text-text-dim font-sans text-xs">{c.insight}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .cert-card { transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .cert-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px -10px rgba(196,160,80,0.15); border-color: #c4a050; }
        .shimmer-sheen { position: relative; overflow: hidden; }
        .shimmer-sheen::after {
          content: ''; position: absolute; top: 0; left: -150%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(196,160,80,0.05), transparent);
          transform: skewX(-20deg); transition: left 0.6s cubic-bezier(0.4,0,0.2,1); pointer-events: none; z-index: 20;
        }
        .shimmer-sheen:hover::after { left: 200%; }
        .hover-glow { position: relative; }
        .hover-glow::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 0;
          background: radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(196,160,80,0.12), transparent 40%);
        }
        .hover-glow:hover::before { opacity: 1; }
        .course-row { position: relative; }
        .course-row::after {
          content: ''; position: absolute; bottom: -1px; left: 0; height: 1px; width: 0%;
          background-color: #c4a050; transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
        }
        .course-row:hover::after { width: 100%; }
        .cred-blink { animation: credBlinker 1s step-start infinite; }
        @keyframes credBlinker { 50% { opacity: 0; } }
        .creds-scroll { scrollbar-width: thin; scrollbar-color: rgba(196,160,80,0.4) transparent; }
        .creds-scroll::-webkit-scrollbar { width: 6px; }
        .creds-scroll::-webkit-scrollbar-track { background: transparent; }
        .creds-scroll::-webkit-scrollbar-thumb { background: rgba(196,160,80,0.35); border-radius: 3px; }
        .creds-scroll::-webkit-scrollbar-thumb:hover { background: rgba(196,160,80,0.6); }
      `}</style>
    </div>
  );
}
