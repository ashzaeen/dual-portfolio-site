"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";

// Telemetry: staggered card-entry wrapper for the pro side. Designed to
// pair with SectionFrame — that handles the section header reveal; this
// handles the content (cards, list rows) staggering in beneath it. Each
// <TelemetryItem> child fades up with a 70ms stagger between siblings.
//
// Respects prefers-reduced-motion by skipping the wrappers entirely.

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] },
  },
};

export function TelemetryGrid({ children, className = "", as = "div", ...rest }) {
  const reducedMotion = useReducedMotion();
  // useInView is more reliable than whileInView in Next.js SSR/hydration:
  // whileInView's IntersectionObserver can miss the initial-load trigger, leaving
  // cards stuck at opacity:0. useInView fires imperatively on mount, same as
  // SectionFrame, and correctly handles elements already in the viewport.
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.05 });

  if (reducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const MotionTag = motion[as];
  return (
    <MotionTag
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function TelemetryItem({ children, className = "", ...rest }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}
