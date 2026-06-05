"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import styles from "./StoryModal.module.css";
import { useScrollLock } from "@/lib/useScrollLock";

export default function StoryModal({ children, onClose, onBack }) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  // Swipe-to-dismiss: direct CSS animation on a wrapper div so Framer Motion
  // on the inner modal is never touched. dismissRef tracks gesture state;
  // dismissWrapRef is the DOM node we transform.
  const dismissWrapRef = useRef(null);
  const dismissRef = useRef({ active: false, dead: false, startY: 0, startX: 0 });

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

  useScrollLock();

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

  // ── Swipe-to-dismiss ──────────────────────────────────────────────────
  // Tracks a downward drag on the overlay. Moves dismissWrapRef with a
  // direct CSS transform (no React state → no re-renders). Framer Motion
  // on the inner modal is untouched. Threshold: 110px or fast flick.
  function onDismissStart(e) {
    if (isClosing || e.touches.length !== 1) return;
    dismissRef.current = {
      active: false, dead: false,
      startY: e.touches[0].clientY,
      startX: e.touches[0].clientX,
    };
  }

  function onDismissMove(e) {
    const d = dismissRef.current;
    if (d.dead || isClosing) return;
    const dy = e.touches[0].clientY - d.startY;
    const dx = e.touches[0].clientX - d.startX;
    if (!d.active) {
      if (dy > 12 && dy > Math.abs(dx) * 1.8) { d.active = true; }
      else if (Math.abs(dx) > 10 || dy < -8) { d.dead = true; return; }
      else return;
    }
    const y = Math.max(0, dy);
    const wrap = dismissWrapRef.current;
    if (!wrap) return;
    wrap.style.transition = "none";
    wrap.style.transform = `translateY(${y}px)`;
    wrap.style.opacity = String(Math.max(0, 1 - y / 320));
  }

  function onDismissEnd() {
    const d = dismissRef.current;
    const wrap = dismissWrapRef.current;
    dismissRef.current = { active: false, dead: false, startY: 0, startX: 0 };
    if (!d.active || !wrap) return;
    const match = wrap.style.transform.match(/translateY\(([-\d.]+)px\)/);
    const currentY = match ? parseFloat(match[1]) : 0;
    if (currentY > 110) {
      // Dismiss: slide off screen, then close without the Framer exit anim.
      wrap.style.transition = "transform 0.28s cubic-bezier(0.4,0,1,1), opacity 0.28s ease";
      wrap.style.transform = `translateY(${window.innerHeight}px)`;
      wrap.style.opacity = "0";
      setTimeout(() => handleClose(), 260);
    } else {
      // Spring back.
      wrap.style.transition = "transform 0.48s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease";
      wrap.style.transform = "translateY(0)";
      wrap.style.opacity = "1";
    }
  }

  // No scale — scale forces a new GPU compositing layer on Chrome mobile
  // which causes a one-frame brightness flash. Pure y+opacity is smoother.
  const animState = isClosing
    ? { opacity: 0, y: 18 }
    : { opacity: 1, y: 0 };

  return (
    <div
      className={styles.overlay}
      data-theme="personal"
      role="dialog"
      aria-modal="true"
      ref={modalRef}
      onTouchStart={onDismissStart}
      onTouchMove={onDismissMove}
      onTouchEnd={onDismissEnd}
      onTouchCancel={onDismissEnd}
    >
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={isClosing ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.24 }}
        onClick={closeAll}
        aria-hidden="true"
      />

      {/* Dismiss wrapper — receives the CSS swipe transform directly */}
      <div ref={dismissWrapRef} className={styles.dismissWrap}>
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 18 }}
          animate={animState}
          transition={{ type: "spring", stiffness: 340, damping: 38 }}
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
    </div>
  );
}
