"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// Shared header for the pro side. Replaces the eyebrow + h1 + description
// + underline pattern that each pro section was duplicating inline.
// Animates as a single choreographed reveal when the header enters
// viewport:
//   1. Eyebrow scrambles in
//   2. Title fades up with a scanline pass over it
//   3. Description fades in
//   4. Gold underline wipes left → right
//
// Designed to pair with Telemetry (sibling component) which staggers the
// content below this header. Both respect prefers-reduced-motion.

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$%&";

function ScrambleSpan({ text, isVisible, skip }) {
  const [display, setDisplay] = useState(skip ? text : text);

  useEffect(() => {
    if (!isVisible || skip) {
      setDisplay(text);
      return;
    }
    let iterations = 0;
    const tickMs = 35;
    const ticks = 28;
    const increment = Math.max(0.5, text.length / ticks);
    const interval = setInterval(() => {
      setDisplay(text.split("").map((char, i) => {
        if (char === " ") return " ";
        if (i < iterations) return char;
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }).join(""));
      if (iterations >= text.length) clearInterval(interval);
      iterations += increment;
    }, tickMs);
    return () => clearInterval(interval);
  }, [text, isVisible, skip]);

  return <span>{display}</span>;
}

export default function SectionFrame({
  eyebrow,
  title,
  description,
  className = "",
  id,
}) {
  const ref = useRef(null);
  const reducedMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  const animate = inView && !reducedMotion;
  const showStatic = reducedMotion;

  return (
    <header
      ref={ref}
      id={id}
      className={`relative inline-block mb-[30px] ${className}`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={animate || showStatic ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-gold font-mono text-[12px] tracking-[0.20em] mb-1.5 uppercase"
      >
        <ScrambleSpan text={eyebrow} isVisible={inView} skip={reducedMotion} />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={animate || showStatic ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ lineHeight: 1.6 }}
        className="text-4xl md:text-5xl font-serif italic font-semibold text-text relative"
      >
        {title}
        {animate && <span className="section-title-scanline" aria-hidden="true" />}
      </motion.h2>

      {description && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={animate || showStatic ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="font-mono text-[11px] text-text-dim/40 tracking-[0.04em] mt-2"
        >
          {description}
        </motion.p>
      )}

      <motion.div
        initial={{ scaleX: 0 }}
        animate={animate || showStatic ? { scaleX: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
        className="w-11 h-px mt-[27px] origin-left"
        style={{ background: "linear-gradient(90deg, #c4a050, transparent)" }}
        aria-hidden="true"
      />

      <style jsx>{`
        .section-title-scanline {
          position: absolute;
          left: 0;
          right: 0;
          top: -2px;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 5%,
            rgba(196, 160, 80, 0.65) 50%,
            transparent 95%
          );
          animation: section-scan 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) 0.55s 1 forwards;
          pointer-events: none;
          opacity: 0;
        }
        @keyframes section-scan {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(120%);
            opacity: 0;
          }
        }
      `}</style>
    </header>
  );
}
