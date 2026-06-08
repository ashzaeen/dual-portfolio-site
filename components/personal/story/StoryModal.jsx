"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import styles from "./StoryModal.module.css";
import { useScrollLock } from "@/lib/useScrollLock";

export default function StoryModal({ children, onClose, onBack }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef(null);
  const triggerRef = useRef(null);

  const handleClose = onClose ?? (() => {
    const ref = typeof document !== "undefined" ? document.referrer : "";
    const sameOrigin = ref && ref.startsWith(window.location.origin);
    if (sameOrigin) {
      router.back();
    } else {
      router.replace("/personal#travel", { scroll: false });
    }
  });

  function closeAll() {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => handleClose(), 270);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (onBack) onBack();
      else closeAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isClosing, onBack]);

  useScrollLock();

  // Simple focus trap
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    triggerRef.current = document.activeElement;
    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    function onTab(e) {
      if (e.key !== "Tab") return;
      if (!focusable.length) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", onTab);
    return () => {
      el.removeEventListener("keydown", onTab);
      triggerRef.current?.focus();
    };
  }, []);

  // Track visual viewport so the modal fills exactly the visible area —
  // accounts for iOS Safari / Chrome address bar and bottom toolbar.
  // Sets --vvh (true visible height) and --vv-top (offset from layout top)
  // so the modal never overlaps browser chrome.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    function sync() {
      const vv = window.visualViewport;
      el.style.setProperty("--vvh", `${vv?.height ?? window.innerHeight}px`);
      el.style.setProperty("--vv-top", `${vv?.offsetTop ?? 0}px`);
    }
    sync();
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  const animState = isClosing ? { opacity: 0, y: 18 } : { opacity: 1, y: 0 };

  return (
    <div
      className={styles.overlay}
      data-theme="personal"
      role="dialog"
      aria-modal="true"
      ref={overlayRef}
    >
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={isClosing ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.24 }}
        onClick={closeAll}
        aria-hidden="true"
      />

      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 18 }}
        animate={animState}
        transition={{ type: "spring", stiffness: 340, damping: 38 }}
      >
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="Back to list">
            ← Back
          </button>
        )}
        <button className={styles.closeBtn} onClick={closeAll} aria-label="Close story">
          ✕
        </button>
        <div className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
