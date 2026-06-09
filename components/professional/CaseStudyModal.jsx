"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import styles from "./CaseStudyModal.module.css";
import { useScrollLock } from "@/lib/useScrollLock";
import { navSignal } from "@/lib/navSignal";

export default function CaseStudyModal({ children, onClose }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  const handleClose = onClose ?? (() => router.back());

  function closeAll() {
    if (isClosing) return;
    navSignal.modalClosed(); // signal immediately, before the 270ms exit animation
    setIsClosing(true);
    setTimeout(() => handleClose(), 270);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isClosing]);

  useEffect(() => { navSignal.modalOpened(); return () => navSignal.modalClosed(); }, []);

  useScrollLock();

  // Focus trap
  useEffect(() => {
    const el = modalRef.current;
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

  const animState = isClosing
    ? { opacity: 0, scale: 0.96, y: 12 }
    : { opacity: 1, scale: 1, y: 0 };

  return (
    <div
      className={styles.overlay}
      data-theme="pro"
      role="dialog"
      aria-modal="true"
      ref={modalRef}
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
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={animState}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <button
          className={styles.closeBtn}
          onClick={closeAll}
          aria-label="Close"
        >
          ✕
        </button>
        <div className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
