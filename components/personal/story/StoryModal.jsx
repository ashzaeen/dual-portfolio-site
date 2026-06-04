"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import styles from "./StoryModal.module.css";

// Module-level counter so that nested/stacked StoryModals share a single
// body-scroll lock. The previous per-instance "remember previous overflow"
// trick was fragile across staggered unmounts: closing the top modal
// would restore overflow to "hidden" (snapshot taken while the bottom
// modal already locked it), but closing the bottom modal in turn would
// only restore to "hidden" too if any sequencing differed — leaving the
// body permanently scroll-locked after both layers were dismissed. The
// counter releases the lock exactly when the last open modal unmounts.
let _modalOpenCount = 0;
let _bodyOverflowPrev = "";
function lockBodyScroll() {
  if (_modalOpenCount === 0) {
    _bodyOverflowPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  _modalOpenCount++;
}
function unlockBodyScroll() {
  _modalOpenCount = Math.max(0, _modalOpenCount - 1);
  if (_modalOpenCount === 0) {
    document.body.style.overflow = _bodyOverflowPrev;
  }
}

export default function StoryModal({ children, onClose, onBack }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  // Default close = stay on the site. If the user got here from a same-
  // origin page (clicked a postcard), router.back returns them to that
  // exact scroll state. If they arrived from an external link (shared URL,
  // bookmark, new tab), router.back would exit the site entirely — so we
  // router.replace to the landing's travel section instead. { scroll: false }
  // preserves the scroll position the choreography already set.
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

  // ESC: go back one level if possible, otherwise close fully
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (onBack) onBack();
      else closeAll();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isClosing, onBack]);

  // Body scroll lock — counter-based so stacked modals share one lock.
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  // Simple focus trap
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
      data-theme="personal"
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
        {onBack && (
          <button
            className={styles.backBtn}
            onClick={onBack}
            aria-label="Back to list"
          >
            ← Back
          </button>
        )}
        <button
          className={styles.closeBtn}
          onClick={closeAll}
          aria-label="Close story"
        >
          ✕
        </button>

        <div className={styles.body}>{children}</div>
      </motion.div>
    </div>
  );
}
