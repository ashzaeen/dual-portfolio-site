"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FALLBACK_PROJECTS } from "@/data/projects";
import { FALLBACK_SECTION_COPY } from "@/data/sections";
import EditorialModal from "./projects/EditorialModal";
import SectionFrame from "./SectionFrame";
import { TelemetryGrid, TelemetryItem } from "./Telemetry";
import { analytics } from "@/lib/analytics";
import { useDwellDuration } from "@/lib/dwell";

// In-app card clicks open the modal LOCALLY (state + history.pushState),
// not via router.push to the intercepting route. This eliminates the
// server roundtrip — the projects array is already in props, so there's
// nothing to fetch. URL still updates so it's shareable; browser back/
// forward stays in sync via popstate. The intercepting + canonical routes
// remain for direct-URL arrivals only.

const SLUG_PATTERN = /^\/projects\/([^/]+)/;

export default function Projects({ projects = FALLBACK_PROJECTS, copy = FALLBACK_SECTION_COPY.projects }) {
  const [selectedSlug, setSelectedSlug] = useState(null);
  const itemRefs = useRef({});
  // Tracks whether the user has interacted (clicked a card) — gates the
  // popstate sync. Without this, browsers that fire popstate on initial
  // page load (Safari legacy, older Chrome) would extract the slug from
  // the canonical-route URL and mount a SECOND modal underneath the one
  // SlugLandingChoreography already mounts.
  const hasInteracted = useRef(false);
  // Slug of the open project, held in a ref so project_closed can name it
  // after selectedSlug clears.
  const openedSlugRef = useRef(null);
  useDwellDuration(!!selectedSlug, (d) => analytics.projectClosed(openedSlugRef.current, d));

  const selected = selectedSlug
    ? projects.find((p) => p.slug === selectedSlug) ?? null
    : null;

  function openProject(project) {
    openedSlugRef.current = project.slug;
    analytics.projectOpened(project);
    setSelectedSlug(project.slug);
    window.history.pushState({}, "", `/projects/${project.slug}`);
    hasInteracted.current = true;
  }

  function closeProject() {
    setSelectedSlug(null);
    // Clean landing URL — no hash. Scroll position is preserved naturally
    // since pushState doesn't move scroll, so the user stays at the
    // section visually while the URL bar shows just "/".
    window.history.pushState({}, "", "/");
  }

  // Sync state with URL on browser back/forward — but ONLY after the user
  // has explicitly interacted via openProject. Otherwise an initial-load
  // popstate would clash with SlugLandingChoreography on canonical routes.
  useEffect(() => {
    function onPopState() {
      if (!hasInteracted.current) return;
      const m = window.location.pathname.match(SLUG_PATTERN);
      setSelectedSlug(m?.[1] ?? null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleMouseMove = (e, slug) => {
    const el = itemRefs.current[slug];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div id="projects" className="bg-obsidian py-20 px-6 md:px-12 relative overflow-hidden">

      <div className="max-w-6xl mx-auto relative z-10">
        <SectionFrame
          eyebrow={`✦ ${copy.eyebrow}`}
          title={copy.title}
          description={copy.intro}
        />
      </div>

      <TelemetryGrid className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {projects.map((project) => {
          const cover = project.coverMedia;
          const coverLabel = cover?.type === "youtube" ? "VIDEO_EMBED" : (cover?.placeholder ?? "PREVIEW");
          return (
            <TelemetryItem key={project.slug} className="flex">
            <motion.div
              layoutId={`container-${project.slug}`}
              ref={(el) => (itemRefs.current[project.slug] = el)}
              onMouseMove={(e) => handleMouseMove(e, project.slug)}
              onClick={() => openProject(project)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openProject(project);
                }
              }}
              className="project-card group hover-glow bg-surface border border-gold-dim rounded flex flex-col overflow-hidden cursor-pointer w-full"
            >
              <motion.div layoutId={`image-${project.slug}`} className="h-48 w-full bg-obsidian border-b border-gold-dim relative flex items-center justify-center overflow-hidden">
                {cover?.type === "image" && cover.src ? (
                  <img src={cover.src} alt={cover.alt || project.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="text-gold-muted font-mono text-[10px] z-10 border border-gold-dim px-3 py-1 bg-surface shadow-md">
                    [ {coverLabel} ]
                  </div>
                )}
              </motion.div>

              <div className="p-6 flex-grow flex flex-col relative z-10">
                <motion.div layoutId={`header-${project.slug}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-text-dim font-mono text-[9px] tracking-widest uppercase">{project.category}</div>
                    {project.award && <div className="text-gold font-mono text-[9px] bg-[rgba(196,160,80,0.1)] px-2 py-0.5 rounded">{project.award}</div>}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif italic text-text mb-2 group-hover:text-gold transition-colors leading-tight">{project.title}</h2>
                  <p className="text-[13px] text-text-dim font-sans leading-relaxed line-clamp-3 mb-5">{project.summary}</p>
                </motion.div>

                <motion.div layoutId={`tech-${project.slug}`} className="mt-auto flex flex-wrap gap-1.5">
                  {project.techStack.map((tech) => (
                    <span key={tech} className="px-2 py-1 bg-obsidian border border-gold-dim text-text-dim text-[9px] rounded uppercase font-mono">{tech}</span>
                  ))}
                </motion.div>
              </div>
            </motion.div>
            </TelemetryItem>
          );
        })}
      </TelemetryGrid>

      <AnimatePresence>
        {selected && (
          <EditorialModal project={selected} onClose={closeProject} />
        )}
      </AnimatePresence>

      <style jsx global>{`
        .bg-cad-grid {
          background-image: linear-gradient(rgba(196, 160, 80, 0.05) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(196, 160, 80, 0.05) 1px, transparent 1px);
          background-size: 30px 30px;
        }
        .project-card {
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease;
          position: relative;
        }
        .project-card:hover {
          transform: translateY(-6px) scale(1.005);
          box-shadow: 0 30px 60px -15px rgba(0,0,0,0.8), 0 15px 25px -5px rgba(196,160,80,0.12);
          border-color: rgba(196,160,80,0.6);
        }
        .hover-glow::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; opacity: 0; transition: opacity 0.4s ease; pointer-events: none; z-index: 0;
          background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(196, 160, 80, 0.06), transparent 40%);
        }
        .project-card:hover::before { opacity: 1; }
      `}</style>
    </div>
  );
}
