"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";
import { TunerProvider, Tunable, useTuner, DEFAULT_TUNE_CONFIG } from "./HeroTuner";
import { FALLBACK_HERO_STATUS } from "@/data/status";
import { useActiveStatus } from "@/lib/useActiveStatus";
import {
  FALLBACK_HERO_CONFIG,
  FALLBACK_HERO_CHIPS,
  FALLBACK_HERO_STATS,
  FALLBACK_HERO_TICKER,
} from "@/data/hero";
import { analytics } from "@/lib/analytics";

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$%&";

// Length-aware scramble: settles in ~1.4s regardless of text size so short
// labels still feel snappy and long status lines don't take forever to reveal.
const ScrambleText = ({ text }) => {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    let iterations = 0;
    const tickMs = 35;
    const ticks = 40; // ~1400ms total
    const increment = Math.max(0.4, text.length / ticks);
    const interval = setInterval(() => {
      setDisplay(text.split('').map((char, index) => {
        if (char === " ") return " ";
        if (index < iterations) return char;
        return characters[Math.floor(Math.random() * characters.length)];
      }).join(''));
      if (iterations >= text.length) clearInterval(interval);
      iterations += increment;
    }, tickMs);
    return () => clearInterval(interval);
  }, [text]);
  return <span>{display}</span>;
};

// Statuses + cycle config live in data/status.js (shared with the personal
// Hero so both sides tick in lockstep, computed from wall-clock time).
// All other content atoms (name/email/chips/stats/ticker) come in as props
// — see data/hero.js for fallback shape and the (pro)/page.jsx for the
// (eventually Notion-backed) fetch pipeline.

function HeroInner({ config, chips, stats, tickerLogs, status }) {
  const tuner = useTuner();
  const tuneOn = tuner?.enabled ?? false;
  const C = tuner?.config ?? DEFAULT_TUNE_CONFIG;

  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("--:--:--");
  const [locState, setLocState] = useState(0);
  const [logIndex, setLogIndex] = useState(0);
  const [statusTimeAgo, setStatusTimeAgo] = useState("JUST NOW");

  // Rotates through the day's status batch by the location's timezone; falls
  // back to status.text/generatedAt when there's no schedule.
  const activeStatus = useActiveStatus(status);

  const particles = useMemo(() => mounted ? Array.from({ length: 25 }).map(() => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 150}%`,
    size: `${Math.random() * 3 + 1}px`,
    delay: `${Math.random() * 20}s`,
    duration: `${15 + Math.random() * 20}s`
  })) : [], [mounted]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const gridX = useSpring(useTransform(mouseX, [-500, 500], [15, -15]), { stiffness: 50, damping: 20 });
  const gridY = useSpring(useTransform(mouseY, [-500, 500], [15, -15]), { stiffness: 50, damping: 20 });
  const avatarX = useSpring(useTransform(mouseX, [-500, 500], [-10, 10]), { stiffness: 100, damping: 30 });
  const avatarY = useSpring(useTransform(mouseY, [-500, 500], [-10, 10]), { stiffness: 100, damping: 30 });

  const { scrollY } = useScroll();
  const heroRotateX = useTransform(scrollY, [0, 600], [0, 45]);
  const heroZ = useTransform(scrollY, [0, 600], [0, -600]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  const slamVariants = {
    hidden: { opacity: 0, scale: 3, z: 500, filter: "blur(20px)" },
    visible: {
      opacity: 1, scale: 1, z: 0, filter: "blur(0px)",
      y: [0, 0, 20, -15, 10, -5, 0], x: [0, 0, -10, 8, -6, 3, 0],
      transition: {
        opacity: { duration: 0.4 }, filter: { duration: 0.4 },
        scale: { type: "spring", stiffness: 200, damping: 15, mass: 1 },
        z: { type: "spring", stiffness: 200, damping: 15, mass: 1 },
        y: { duration: 0.5, delay: 0.15, ease: "easeInOut" }, x: { duration: 0.5, delay: 0.15, ease: "easeInOut" }
      }
    }
  };

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    // Status text is now a single value from the GPT-regen cron writeback
    // (see fetchHeroStatus + app/api/cron/regenerate-status). No client-
    // side cycling; only the relative-time label below ticks every second.
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    const locTimer = setInterval(() => setLocState(p => p === 0 ? 1 : 0), 4000);
    const logTimer = setInterval(() => setLogIndex(p => (p + 1) % tickerLogs.length), 3500);

    const handleMouseMove = (e) => {
      mouseX.set(e.clientX - window.innerWidth / 2);
      mouseY.set(e.clientY - window.innerHeight / 2);
    };
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      clearInterval(timer);
      clearInterval(locTimer);
      clearInterval(logTimer);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Ticks the "UPDATED Xs/m/h/d AGO" label every second relative to the
  // GPT regen timestamp from Notion. If no generatedAt yet (cron hasn't
  // run / DB has no timestamp column), shows "JUST NOW" indefinitely.
  useEffect(() => {
    if (!activeStatus.generatedAt) {
      setStatusTimeAgo("JUST NOW");
      return;
    }
    const generatedAtMs = new Date(activeStatus.generatedAt).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - generatedAtMs) / 1000);
      if (elapsed < 60) setStatusTimeAgo(`${elapsed}S AGO`);
      else if (elapsed < 3600) setStatusTimeAgo(`${Math.floor(elapsed / 60)}M AGO`);
      else if (elapsed < 86400) setStatusTimeAgo(`${Math.floor(elapsed / 3600)}H AGO`);
      else setStatusTimeAgo(`${Math.floor(elapsed / 86400)}D AGO`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeStatus.generatedAt]);

  return (
    <div className="relative w-full perspective-stage">

      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div style={{ x: gridX, y: gridY }} className="absolute inset-0">
          {particles.map((p, i) => (
            <div key={i} className="particle" style={{
              left: p.left, top: p.top, width: p.size, height: p.size,
              animationDelay: p.delay, animationDuration: p.duration
            }} />
          ))}
        </motion.div>
      </div>

      <div className="fixed top-20 left-8 font-mono text-[9px] tracking-[0.2em] text-text-dim uppercase hidden md:block z-50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
          <span>System Online</span>
        </div>
        <div className="relative h-4 overflow-hidden w-48">
          <AnimatePresence mode="wait">
            <motion.div key={locState} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.3 }} className="absolute">
              Loc: {locState === 0 ? config.locationCoords : config.locationLabel}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed top-20 right-8 font-mono text-[9px] tracking-[0.2em] text-text-dim uppercase text-right hidden md:block z-50">
        <div>Uptime: {time}</div>
      </div>

      <motion.div
        style={{ opacity: heroOpacity, rotateX: heroRotateX, z: heroZ, transformOrigin: "bottom center" }}
        className="hero-outer relative min-h-[100dvh] md:min-h-screen w-full flex flex-col items-center justify-center z-10 pt-16 pb-8 md:pt-12 md:pb-0"
      >
        <div className="hero-stage flex flex-col w-full h-full max-w-5xl mx-auto px-6 my-auto">

          {/* Centered grid: avatar (left column on md+) + content (right column).
              Mobile collapses to a single column with avatar stacked above the
              content. flex-1 wrapper takes available vertical space and centers
              the grid in it, leaving the ticker pinned at the bottom. */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">

            {/* Identity card — avatar paired with name, role badges, primary CTAs.
                max-w-4xl keeps the two-column pairing reading as a single unit
                even on ultrawide displays. Stats and status are pulled OUT of
                this column so they can center on the page axis below. */}
            <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-8 md:gap-8 items-center w-full max-w-4xl text-center">

              <Tunable id="avatar" className="relative md:justify-self-center">
                {/* Baked tuner offset: avatar nudged 87px right / 22px down at md+.
                    Wrapping div carries the translate so framer-motion's parallax
                    transform on the inner motion.div doesn't override it. */}
                <div className="relative md:justify-self-center md:translate-x-[87px] md:translate-y-[22px]">
                  <motion.div style={{ x: avatarX, y: avatarY }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} className="relative">
                    <div
                      className={`lens-glow rounded-full border border-gold-dim p-1.5 relative overflow-hidden bg-obsidian ${tuneOn ? "" : "w-28 h-28 md:w-48 md:h-48"}`}
                      style={tuneOn ? { width: C.avatar.size, height: C.avatar.size } : undefined}
                    >
                      <div className="scanline" />
                      <img src="/images/profile.png" alt="Ashzaeen Fatmi Khan Profile Picture" className="w-full h-full rounded-full object-cover grayscale-[20%] contrast-[1.1]" />
                    </div>
                    <div className="absolute -top-1 -left-1 md:-top-2 md:-left-2 w-4 h-4 border-t border-l border-gold/40" />
                    <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 w-4 h-4 border-b border-r border-gold/40" />
                  </motion.div>
                </div>
              </Tunable>

              <div className="flex flex-col items-center w-full">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1 }}>
                  <Tunable id="name">
                    <h1
                      className={`font-serif italic md:leading-[1.05] text-text mb-4 md:mb-[19px] drop-shadow-2xl md:translate-y-[23px] ${tuneOn ? "" : "text-4xl md:text-[3rem]"}`}
                      style={tuneOn ? { fontSize: C.name.fontSize } : undefined}
                    >
                      <ScrambleText text={config.name} />
                    </h1>
                  </Tunable>
                  <Tunable id="roles">
                    <div
                      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 md:gap-4 font-mono uppercase tracking-[0.2em] md:tracking-[0.25em] text-gold/80 px-2 md:translate-y-[31px] ${tuneOn ? "" : "text-[9px] md:text-xs"}`}
                      style={tuneOn ? { fontSize: C.roles.fontSize } : undefined}
                    >
                      {chips.map((chip, i) => (
                        <Fragment key={chip}>
                          {i > 0 && <span className="opacity-30">•</span>}
                          <span>{chip}</span>
                        </Fragment>
                      ))}
                    </div>
                  </Tunable>
                </motion.div>

                <Tunable id="buttons">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="flex flex-row gap-4 md:gap-6 mt-8 md:mt-6 md:translate-y-[34px]">
                    <div
                      className="flex flex-row gap-4 md:gap-6"
                      style={tuneOn && C.buttons.scale !== 1 ? { transform: `scale(${C.buttons.scale})`, transformOrigin: "center top" } : undefined}
                    >
                      <a href={config.resumeUrl} target="_blank" rel="noopener noreferrer" onClick={() => analytics.resumeDownloaded()} className="px-5 md:px-6 py-2 border border-gold bg-gold/10 text-gold hover:bg-gold hover:text-obsidian transition-all duration-300 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(196,160,80,0.15)] whitespace-nowrap">
                        Download Resume
                      </a>
                      <a href={`mailto:${config.email}?subject=[Portfolio Site] - `} onClick={() => analytics.contactEmailClicked()} className="px-5 md:px-6 py-2 border border-gold-dim text-text hover:border-gold hover:text-gold transition-all duration-300 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] relative overflow-hidden group whitespace-nowrap">
                        <div className="absolute inset-0 bg-gold/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                        <span className="relative z-10">Email Me</span>
                      </a>
                    </div>
                  </motion.div>
                </Tunable>
              </div>
            </div>

            {/* Stats — promoted out of the identity card so they center on the
                page axis instead of being offset by the avatar. border-t doubles
                as the divider between identity (who) and details (what). */}
            <Tunable id="stats" className="w-full flex justify-center">
              {/* Wrapping div carries the baked translate so a future tune-mode
                  scale (which would set inline transform on motion.div) can't
                  clobber it. */}
              <div className="w-full flex justify-center md:translate-y-[18px]">
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1.5 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-6 w-full max-w-3xl border-t border-gold-dim pt-8 md:pt-7 mt-10 md:mt-10 text-center"
                style={tuneOn && C.stats.scale !== 1 ? { transform: `scale(${C.stats.scale})`, transformOrigin: "center top" } : undefined}
              >
                {stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-1.5 md:gap-1">
                    <span className="font-mono text-[8px] md:text-[9px] uppercase text-text-dim tracking-widest"><ScrambleText text={stat.label} /></span>
                    <span className="font-serif italic text-[16px] md:text-base text-text leading-snug">{stat.line1}<br className="hidden md:block" /><span className="md:hidden text-gold-muted"> • </span>{stat.line2}</span>
                  </div>
                ))}
              </motion.div>
              </div>
            </Tunable>

            {/* "Human note" status — single GPT-regenerated value from Notion (cron).
                Three attention layers: (1) ● LIVE STATUS · UPDATED Xs/m AGO header
                that mirrors the System Online corner pattern, (2) ✦ ornament that
                flashes + scales on each text change, (3) ScrambleText reveal on the
                status string so each update reads as the HUD decoding new data. */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.35, duration: 1.2 }} className="w-full flex flex-col items-center mt-8 md:mt-10">
              {/* LIVE header — pulsing dot + cycling timestamp */}
              <Tunable id="liveStatus">
                <div
                  className={`flex items-center gap-2 mb-3 font-mono tracking-[0.22em] uppercase text-text-dim md:translate-y-[53px] ${tuneOn ? "" : "text-[9px] md:text-[10px]"}`}
                  style={tuneOn ? { fontSize: C.liveStatus.fontSize } : undefined}
                >
                  <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
                  <span className="text-gold/85">Live Status</span>
                  <span className="opacity-30">·</span>
                  <span>Updated {statusTimeAgo}</span>
                </div>
              </Tunable>

              {/* Ornament — flashes + scales briefly each time the status changes.
                  Wrapping div carries the baked translate; framer-motion's scale
                  animation on the inner span would otherwise overwrite a class-
                  level transform. */}
              <Tunable id="ornament">
                <div className="md:-translate-y-[14px] mb-3">
                  <motion.span
                    key={`orn-${activeStatus.text}`}
                    initial={{ scale: 1.5, filter: "drop-shadow(0 0 14px rgba(196, 160, 80, 0.9))" }}
                    animate={{ scale: 1, filter: "drop-shadow(0 0 0px rgba(196, 160, 80, 0))" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`font-serif text-gold/55 leading-none select-none block ${tuneOn ? "" : "text-lg"}`}
                    style={tuneOn ? { fontSize: C.ornament.fontSize } : undefined}
                    aria-hidden="true"
                  >
                    ✦
                  </motion.span>
                </div>
              </Tunable>

              {/* Status text — ScrambleText keys to statusIndex so each cycle decodes in.
                  min-h reserves space for ~3 lines at md:text-[17px] to prevent layout shift.
                  .status-shimmer applies a warm gold-cream gradient + continuous
                  slow sweep so it reads as the "alive" element on the page. */}
              <Tunable id="statusText">
                <p
                  className={`status-shimmer font-sans italic text-center max-w-[760px] leading-relaxed px-4 min-h-[5em] md:translate-y-[25px] ${tuneOn ? "" : "text-[15px] md:text-[17px]"}`}
                  style={tuneOn ? { fontSize: C.statusText.fontSize } : undefined}
                >
                  <ScrambleText key={activeStatus.text} text={activeStatus.text} />
                </p>
              </Tunable>
            </motion.div>

          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1.5 }} className="w-full flex justify-between items-center pt-8 pb-4 md:pb-0">
            <div className="flex-1 border-t border-gold-dim/30 h-px mr-4 md:mr-8" />
            <div className="font-mono text-[10px] md:text-[11px] text-gold tracking-widest min-w-[320px] md:min-w-[380px] text-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={logIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5 }}>
                  {tickerLogs[logIndex]}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex-1 border-t border-gold-dim/30 h-px ml-4 md:ml-8" />
          </motion.div>

        </div>
      </motion.div>

      <style jsx global>{`
        .perspective-stage { perspective: 1500px; transform-style: preserve-3d; }
        .cad-grid {
          background-image: linear-gradient(rgba(196, 160, 80, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(196, 160, 80, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .lens-glow { animation: breathe 4s ease-in-out infinite; }
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 20px rgba(196,160,80,0.1), inset 0 0 10px rgba(196,160,80,0.05); border-color: rgba(196,160,80,0.2); }
          50% { box-shadow: 0 0 40px rgba(196,160,80,0.25), inset 0 0 20px rgba(196,160,80,0.1); border-color: rgba(196,160,80,0.6); }
        }
        .scanline {
          position: absolute; top: 0; left: 0; width: 100%; height: 2px;
          background: rgba(196,160,80,0.1);
          animation: scanning 8s linear infinite; pointer-events: none;
        }
        @keyframes scanning { 0% { top: 0; } 100% { top: 100%; } }
        .particle {
          position: absolute; background: #c4a050; border-radius: 50%;
          animation: float linear infinite; pointer-events: none;
        }
        @keyframes float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }
        /* Warm gold-cream gradient + continuous slow sweep on the status text.
           Background gradient is 200% wide so the cream highlight at 50% can
           sweep across the visible area as background-position animates. */
        .status-shimmer {
          background-image: linear-gradient(
            110deg,
            rgba(196, 160, 80, 0.78) 0%,
            rgba(220, 200, 160, 0.92) 30%,
            rgba(248, 235, 205, 1) 50%,
            rgba(220, 200, 160, 0.92) 70%,
            rgba(196, 160, 80, 0.78) 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: statusShimmer 6.5s linear infinite;
        }
        @keyframes statusShimmer {
          0%   { background-position: 200% 50%; }
          100% { background-position: -200% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .status-shimmer { animation: none; background-position: 50% 50%; }
        }
        /* Laptop zoom rule removed — the two-column layout (avatar left,
           content right) frees enough vertical space that everything fits
           at native size without shrinking. Hero now renders identically
           on laptop and desktop, just centered with more empty space on
           bigger monitors. */
      `}</style>
    </div>
  );
}

// Wraps the hero in the tuner context. In normal viewing the provider is
// inert (enabled=false). Add ?tune=1 to the URL to activate the floating
// panel + drag/resize affordances. See HeroTuner.jsx.
//
// All content atoms accept props; fallbacks let the component still render
// if called with no data (e.g., during incremental refactors). The page
// route is the real source of these props — eventually fetched from Notion.
export default function Hero({
  config = FALLBACK_HERO_CONFIG,
  chips = FALLBACK_HERO_CHIPS,
  stats = FALLBACK_HERO_STATS,
  tickerLogs = FALLBACK_HERO_TICKER,
  status = FALLBACK_HERO_STATUS,
}) {
  return (
    <TunerProvider>
      <HeroInner
        config={config}
        chips={chips}
        stats={stats}
        tickerLogs={tickerLogs}
        status={status}
      />
    </TunerProvider>
  );
}
