"use client";
import { useEffect } from "react";

// Module-level counter so every modal — Hero carousel, StoryModal, AllStopsBook,
// CaseStudy, Editorial, pinboard modals — shares one lock. The body only becomes
// fixed on the first lock and only restores on the last unlock, so stacked modals
// (e.g. StoryIndex + StoryView) stay locked until both dismiss.
let _count = 0;

function applyLock() {
  if (_count === 0) {
    const y = window.scrollY;
    document.body.dataset.slY = String(y);
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    // Keep overflow-y: scroll so any desktop scrollbar stays present and
    // the layout doesn't shift when the body goes fixed.
    document.body.style.overflowY = "scroll";
  }
  _count++;
}

function releaseLock() {
  _count = Math.max(0, _count - 1);
  if (_count === 0) {
    const y = +(document.body.dataset.slY || 0);
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.overflowY = "";
    delete document.body.dataset.slY;
    // Instant scroll — don't let html { scroll-behavior: smooth } animate this.
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    document.documentElement.style.scrollBehavior = "";
  }
}

/**
 * Locks the page scroll while a modal is open.
 * Uses position:fixed + saved scrollY so the page doesn't jump and Chrome's
 * address bar has no scroll delta to react to on open/close.
 *
 * @param {boolean} active - pass false to skip (e.g. AllStopsBook when open=false)
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    applyLock();
    return releaseLock;
  }, [active]);
}
