"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FALLBACK_FOOTER_PRO, FALLBACK_FOOTER_SOCIALS } from "@/data/footer";
import { analytics } from "@/lib/analytics";
import { useHoverDwell } from "@/lib/dwell";

// Inline SVG icon map for the pro footer. Keys match the Socials DB's
// `Icon` Select values (lowercased). Unknown keys fall through to
// FALLBACK_GLOBE so a new social added in Notion still renders something
// reasonable until I add the matching SVG here.
const ICON_MAP = {
  devpost: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.002 1.61L0 12.004L6.002 22.39h11.996L24 12.004L17.998 1.61H6.002zM17.736 12.004L13.11 19.99H7.618l4.626-7.986l-4.626-7.985h5.492l4.626 7.985z"/></svg>
  ),
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
  ),
  linkedin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
  ),
  instagram: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  ),
  vsco: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-5.5-10a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"/></svg>
  ),
};

const FALLBACK_GLOBE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

function SocialIcon({ icon }) {
  return ICON_MAP[String(icon ?? "").toLowerCase()] ?? FALLBACK_GLOBE;
}

const Magnetic = ({ children, strength = 0.3 }) => {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    setPosition({ x: (clientX - (left + width / 2)) * strength, y: (clientY - (top + height / 2)) * strength });
  };
  return (
    <motion.div ref={ref} onMouseMove={handleMouse} onMouseLeave={() => setPosition({ x: 0, y: 0 })} animate={{ x: position.x, y: position.y }} transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }} className="inline-block">
      {children}
    </motion.div>
  );
};

// Extra attention effects layered onto the pro→personal crossover toggle.
// Each is independent — set any to false to fall back to the clean toggle
// (honest thumb + auto-teaser + glowing Personal label) without that effect.
const CROSSOVER_FX = {
  aurora: true,      // slow gold halo drifting behind the pill
  pressBounce: true, // thumb does a periodic "pressed" bounce
  particles: true,   // ✦ sparks drift off the Personal side
};

export default function Footer({
  config = FALLBACK_FOOTER_PRO,
  socials = FALLBACK_FOOTER_SOCIALS,
}) {
  const router = useRouter();
  // Clicking "Personal" slides the thumb across the track first, then
  // navigates the instant it lands (onTransitionEnd) — one fluid motion
  // into the personal side rather than an abrupt page swap.
  const [leaving, setLeaving] = useState(false);
  const toggleHover = useHoverDwell((d) => analytics.sideToggleHovered("footer", d));
  return (
    <div className="relative bg-obsidian overflow-hidden">

      <div className="max-w-3xl mx-auto px-8 pt-10 pb-6 relative z-10 flex flex-col items-center gap-7">

        {/* 1. The Ambient Glass Core (Avatar) */}
        <div className="relative flex justify-center items-center">
          <div className="absolute left-1/2 right-1/2 top-1/2 w-[200vw] h-px bg-gradient-to-r from-transparent via-gold-dim to-transparent -translate-x-1/2 z-0" />
          <div className="absolute w-20 h-20 bg-gold blur-xl opacity-20 rounded-full z-0 pointer-events-none" />
          <div className="w-[58px] h-[58px] bg-obsidian/40 backdrop-blur-md border border-gold-dim/40 rounded-full flex items-center justify-center relative z-10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden auto-sheen">
            <span className="relative z-10 font-sans font-medium text-gold text-2xl tracking-wide drop-shadow-[0_0_8px_rgba(196,160,80,0.6)]">
              {config.avatarLetter}
            </span>
          </div>
        </div>

        {/* 2. Name & Blinking Cursor Quote */}
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-serif italic text-text mb-2">{config.footerName}</h1>
          <p className="text-text-dim font-mono text-[11px] tracking-wide italic">
            &ldquo;{config.quote}&rdquo;<span className="footer-blink text-gold font-bold ml-1 not-italic">_</span>
          </p>
        </div>

        {/* 2.5. The Crossover — an invitation to the personal side */}
        <div className="flex flex-col items-center gap-2.5 -mt-1">
          <div className="cross-eyebrow flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] font-medium">
            <span className="cross-spark">✦</span>
            <span>Check Out my Personal Side</span>
            <span className="cross-arrow">→</span>
          </div>

          <div className="cross-stage">
            {CROSSOVER_FX.aurora && <span className="cross-aurora" aria-hidden="true" />}
            <div
              className="cross-toggle"
              role="tablist"
              aria-label="Switch between professional and personal sides"
              onMouseEnter={toggleHover.onMouseEnter}
              onMouseLeave={toggleHover.onMouseLeave}
            >
              <span
                className={`cross-indicator${leaving ? " cross-go" : ""}`}
                aria-hidden="true"
                onTransitionEnd={(e) => {
                  if (leaving && e.propertyName === "transform") router.push("/personal");
                }}
              >
                <span
                  className={`cross-indicator-skin${
                    CROSSOVER_FX.pressBounce ? " cross-press" : ""
                  }`}
                />
              </span>
              <button
                type="button"
                role="tab"
                aria-selected="true"
                className="cross-half cross-active"
                onClick={() => router.push("/")}
              >
                Professional
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="false"
                className="cross-half cross-personal"
                onClick={() => { if (!leaving) { analytics.sideToggled("professional", "personal", "footer"); setLeaving(true); } }}
              >
                <span className="cross-sheen" aria-hidden="true" />
                <span className="cross-label">Personal</span>
                <span className="cross-personal-spark" aria-hidden="true">✦</span>
              </button>
              {CROSSOVER_FX.particles && (
                <span className="cross-particles" aria-hidden="true">
                  <span className="cross-particle">✦</span>
                  <span className="cross-particle">✦</span>
                  <span className="cross-particle">✦</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. The Comms Array (Socials) */}
        <div className="flex flex-wrap justify-center gap-[1.1rem]">
          {socials.map((social) => (
            <Magnetic key={social.name}>
              <a href={social.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-[5px] group" onClick={() => analytics.externalLinkClicked(social.url, `footer-social:${social.name}`)}>
                <div className="social-btn w-9 h-9 rounded-full bg-surface border border-gold-dim text-text-dim flex items-center justify-center relative overflow-hidden">
                  <div className="relative z-10"><SocialIcon icon={social.icon} /></div>
                  <div className="absolute inset-0 bg-gold/5 transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                </div>
                <span className="text-text-dim font-mono text-[8px] uppercase tracking-widest group-hover:text-gold transition-colors">
                  {social.name}
                </span>
              </a>
            </Magnetic>
          ))}
        </div>

        {/* 4. The Archive Stamp */}
        {config.stampUrl && (
          <div className="flex flex-col items-center gap-2.5">
            <span className="text-text-dim font-serif italic text-[15px]">where it all started</span>
            <a
              href={config.stampUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ transform: "rotate(-3deg)" }}
              className="archive-stamp relative block bg-surface px-[22px] pt-[14px] pb-[12px] text-center cursor-pointer overflow-hidden max-w-xs"
            >
              <div className="footer-scanline" />
              <div className="font-mono font-bold text-gold text-sm mb-0.5 tracking-wider">{config.stampTitle}</div>
              <div className="font-sans text-text-dim text-[11px]">{config.stampSubtitle}</div>
              <div className="font-mono text-gold-muted text-[8px] uppercase tracking-widest mt-1">{config.stampCaption}</div>
            </a>
          </div>
        )}

        {/* 5. System Docs (Copyright) */}
        <div>
          <a href="/copyright" className="flex items-center gap-1.5 text-text-dim hover:text-gold transition-colors group">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em]">Usage &amp; Copyright</span>
            <motion.span animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="font-mono text-[9px] text-gold group-hover:translate-x-1">
              →
            </motion.span>
          </a>
        </div>

      </div>

      {/* 6. The Bottom Bar */}
      <div className="w-full bg-obsidian border-t border-gold-dim/50 pt-[0.9rem] pb-[1.4rem] relative z-10">
        <div className="max-w-3xl mx-auto px-12 flex justify-center md:justify-between items-center gap-4">
          <div className="hidden md:block text-text-dim font-mono text-[9px] tracking-widest opacity-60">
            © {new Date().getFullYear()}
          </div>
          <div className="text-gold font-mono text-[9px] tracking-[0.2em] opacity-80 text-center">
            {config.bottomTagline}
          </div>
          <div className="hidden md:block text-text-dim font-mono text-[9px] tracking-widest opacity-60">
            {config.sideLabel}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .social-btn { transition: all 0.3s ease; }
        .social-btn:hover { box-shadow: 0 0 20px rgba(196,160,80,0.2); border-color: #c4a050; color: #c4a050; transform: translateY(-4px); }

        .archive-stamp { transition: all 0.4s cubic-bezier(0.16,1,0.3,1); border: 2px dashed rgba(196,160,80,0.3); }
        .archive-stamp:hover { border-color: #c4a050; background: rgba(196,160,80,0.05); transform: rotate(0deg) scale(1.05) !important; box-shadow: 0 10px 30px -10px rgba(196,160,80,0.2); }

        .footer-scanline { position: absolute; top: 0; left: 0; right: 0; height: 100%; background: linear-gradient(to bottom, transparent, rgba(196,160,80,0.1), transparent); opacity: 0; transition: opacity 0.3s; pointer-events: none; animation: footerScan 2s linear infinite; }
        .archive-stamp:hover .footer-scanline { opacity: 1; }
        @keyframes footerScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }

        .footer-blink { animation: footerBlinker 1s step-start infinite; }
        @keyframes footerBlinker { 50% { opacity: 0; } }

        /* ── The Crossover toggle ── */
        .cross-eyebrow { color: rgba(196,160,80,0.82); }
        .cross-spark { color: #c4a050; animation: crossTwinkle 2.4s ease-in-out infinite; }
        .cross-arrow { color: #c4a050; animation: crossNudge 1.6s ease-in-out infinite; }
        @keyframes crossTwinkle { 0%,100% { opacity: .3; transform: scale(.82); } 50% { opacity: 1; transform: scale(1.12); } }
        @keyframes crossNudge { 0%,100% { transform: translateX(0); opacity: .55; } 50% { transform: translateX(4px); opacity: 1; } }

        .cross-toggle {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          width: 232px;
          height: 36px;
          padding: 3px;
          border-radius: 999px;
          background: rgba(20,12,4,0.5);
          border: 1px solid rgba(196,160,80,0.28);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          transition: border-color .3s ease, box-shadow .3s ease, transform .3s ease;
        }
        .cross-toggle:hover {
          border-color: rgba(196,160,80,0.5);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px -8px rgba(196,160,80,0.28);
        }

        /* The single thumb — sits honestly on Professional (you are here)
           and only teases toward Personal in brief peeks that snap back.
           Split in two: an outer positioner drives the horizontal teaser,
           an inner skin carries the gold look + the optional press bounce,
           so the two transforms (translate + scale) never clobber each
           other. */
        .cross-indicator {
          position: absolute; top: 3px; bottom: 3px; left: 3px;
          width: calc(50% - 3px);
          z-index: 0;
          animation: crossTease 4.2s ease-in-out infinite;
          transition: transform .38s cubic-bezier(0.34,1.4,0.64,1);
        }
        .cross-indicator-skin {
          position: absolute; inset: 0;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(64,48,24,0.92), rgba(34,25,12,0.88));
          border: 1px solid rgba(196,160,80,0.55);
          box-shadow:
            inset 0 1px 0 rgba(255,240,210,0.25),
            inset 0 -2px 5px rgba(0,0,0,0.4),
            0 2px 6px rgba(0,0,0,0.5);
          transition: border-color .3s ease, box-shadow .3s ease;
        }
        .cross-press { animation: crossPress 3.4s ease-in-out infinite; }
        /* Thumb stays honestly on Professional even on hover — it must never
           settle under Personal or it would read as "you're already there".
           It just brightens; the glowing Personal label carries the invite. */
        .cross-toggle:hover .cross-indicator { animation: none; }
        .cross-toggle:hover .cross-indicator-skin {
          animation: none;
          border-color: rgba(196,160,80,0.6);
          box-shadow: inset 0 1px 0 rgba(255,240,210,0.2),
            0 0 14px rgba(196,160,80,0.22);
        }
        @keyframes crossTease {
          0%, 60%, 84%, 100% { transform: translateX(0); }
          72% { transform: translateX(36%); }
        }
        @keyframes crossPress {
          0%, 28%, 100% { transform: scale(1); }
          36% { transform: scale(0.88); }
          44% { transform: scale(1); }
        }

        /* On click: slide the thumb across to Personal, then navigate when
           it lands (transitionend). Teaser + press are paused so the slide
           is the only motion. Labels swap to follow the moving thumb. */
        .cross-indicator.cross-go {
          animation: none;
          transform: translateX(100%);
        }
        .cross-indicator.cross-go .cross-indicator-skin { animation: none; }
        .cross-indicator.cross-go ~ .cross-active { color: rgba(220,205,170,0.45); }
        .cross-indicator.cross-go ~ .cross-personal { color: #f5e6c0; }

        /* Aurora — slow gold halo drifting behind the pill */
        .cross-stage { position: relative; display: inline-flex; }
        .cross-aurora {
          position: absolute; inset: -14px;
          border-radius: 999px; z-index: 0; pointer-events: none;
          filter: blur(16px); opacity: 0.55;
          background: conic-gradient(from 0deg,
            rgba(196,160,80,0) 0deg,
            rgba(196,160,80,0) 55deg,
            rgba(212,175,90,0.5) 130deg,
            rgba(196,160,80,0.3) 210deg,
            rgba(196,160,80,0) 300deg,
            rgba(196,160,80,0) 360deg);
          animation: auroraDrift 9s linear infinite;
        }
        @keyframes auroraDrift { to { transform: rotate(360deg); } }

        /* Sparks — tiny ✦ drifting off the Personal half */
        .cross-particles {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 50%; z-index: 2; pointer-events: none;
        }
        .cross-particle {
          position: absolute; bottom: 7px;
          font-size: 6px; line-height: 1; color: #d4af5a;
          opacity: 0; text-shadow: 0 0 6px rgba(196,160,80,0.6);
          animation: crossFloat 4.5s ease-in-out infinite;
        }
        .cross-particle:nth-child(1) { left: 24%; animation-delay: 0s; }
        .cross-particle:nth-child(2) { left: 54%; animation-delay: 1.6s; }
        .cross-particle:nth-child(3) { left: 76%; animation-delay: 3.1s; }
        @keyframes crossFloat {
          0%   { opacity: 0; transform: translateY(0) scale(0.5); }
          18%  { opacity: 0.9; }
          60%  { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(-26px) scale(1); }
        }

        .cross-half {
          flex: 1; position: relative; z-index: 1;
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
          height: 100%; border: none; background: transparent; cursor: pointer;
          font-family: var(--font-mono); font-size: 8.5px; font-weight: 500;
          letter-spacing: 0.16em; text-transform: uppercase; border-radius: 999px;
          user-select: none; transition: color .3s ease;
        }
        .cross-active { color: rgba(245,236,214,0.82); }
        .cross-active:hover { color: rgba(245,236,214,0.95); }

        .cross-personal { color: #c4a050; overflow: hidden; }
        .cross-personal:hover { color: #f5e6c0; }
        .cross-personal .cross-label {
          position: relative; z-index: 2;
          text-shadow: 0 0 10px rgba(196,160,80,0.4);
        }
        .cross-personal-spark {
          position: relative; z-index: 2; font-size: 8px;
          animation: crossTwinkle 2.4s ease-in-out infinite;
        }
        .cross-sheen {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          border-radius: 999px; overflow: hidden;
        }
        .cross-sheen::after {
          content: ''; position: absolute; top: 0; left: -60%;
          width: 40%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(196,160,80,0.5), transparent);
          transform: skewX(-20deg);
          animation: crossSweep 3s ease-in-out infinite;
        }
        @keyframes crossSweep { 0%,55% { left: -60%; } 80%,100% { left: 130%; } }

        @media (prefers-reduced-motion: reduce) {
          .cross-spark, .cross-arrow, .cross-indicator, .cross-press,
          .cross-aurora, .cross-particle, .cross-personal-spark,
          .cross-sheen::after { animation: none !important; }
          .cross-particle { display: none; }
        }

        .auto-sheen { position: relative; overflow: hidden; }
        .auto-sheen::after {
          content: ''; position: absolute; top: 0; left: -150%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(196,160,80,0.6), transparent);
          transform: skewX(-20deg); pointer-events: none; z-index: 20;
          animation: autoShimmer 3.5s ease-in-out infinite;
        }
        @keyframes autoShimmer {
          0%, 50% { left: -150%; opacity: 0; }
          60% { opacity: 1; }
          75%, 100% { left: 200%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
