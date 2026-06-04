"use client";

import { motion, useReducedMotion } from "framer-motion";

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
  if (reducedMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const MotionTag = motion[as];
  return (
    <MotionTag
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-12% 0px -10% 0px" }}
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
