"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Navbar.module.css";
import { analytics } from "@/lib/analytics";
import { useHoverDwell } from "@/lib/dwell";

const PRO_LINKS = [
  { label: "Stack", href: "#stack" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Credentials", href: "#credentials" },
];

const PERSONAL_LINKS = [
  { label: "Travel", href: "#travel", glyph: "✦" },
  { label: "Writing", href: "#writing", glyph: "✎" },
  { label: "Music", href: "#music", glyph: "♪" },
  { label: "Series", href: "#series", glyph: "◈" },
  { label: "Gallery", href: "#gallery", glyph: "◉" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isPersonal = pathname?.startsWith("/personal");
  const side = isPersonal ? "personal" : "pro";

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const navRef = useRef(null);

  // Instantly suppress the nav's CSS transition for one frame so open/close
  // of the menu doesn't produce a sluggish 0.4s background fade.
  const setMenuOpenInstant = useCallback((next) => {
    const nav = navRef.current;
    if (nav) nav.style.transition = "none";
    setMenuOpen(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (navRef.current) navRef.current.style.transition = "";
      });
    });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      // While a modal has the page scroll-locked (useScrollLock sets
      // body{position:fixed}), window.scrollY reads 0 and the reflow fires a
      // bogus scroll event. That would flip the nav to its un-scrolled
      // (transparent) state on open, then animate back to opaque on close —
      // the exact "navbar transparency + delay" bug. Ignore scroll updates
      // entirely while locked so the nav holds whatever state it had.
      if (document.body.style.position === "fixed") return;
      setScrolled(window.scrollY > 60);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);


  // Dismiss on click-outside, scroll, or Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onOutsideClick = (e) => {
      if (e.target.closest(`.${styles.menuOverlay}`)) return;
      if (e.target.closest(`.${styles.hamburger}`)) return;
      setMenuOpenInstant(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpenInstant(false);
    };
    const onScroll = () => setMenuOpenInstant(false);
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("touchstart", onOutsideClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("touchstart", onOutsideClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [menuOpen]);

  // Route change closes the menu.
  useEffect(() => {
    setMenuOpenInstant(false);
  }, [pathname, setMenuOpenInstant]);

  // Idle-time prefetch of the OTHER side so the toggle feels near-instant.
  // Defers 1s after mount so critical post-hydration work finishes first,
  // then runs the prefetch inside requestIdleCallback so it never competes
  // with user interaction. Skips on save-data / slow-2g connections so we
  // don't burn mobile data for a feature the user may not exercise.
  //
  // Two pieces:
  //   1. router.prefetch(otherSide) — primes the HTML + RSC payload for
  //      the other landing route
  //   2. import('./TravelMap') etc. — eagerly downloads the heavy lazy
  //      chunks (D3 + topojson) that the personal side defers via
  //      next/dynamic, so the toggle hits them warm. Pro side has no
  //      lazy chunks to mirror this direction.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const conn = navigator.connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return;

    const otherSide = isPersonal ? "/" : "/personal";

    const delayId = setTimeout(() => {
      const run = () => {
        router.prefetch(otherSide);
        if (!isPersonal) {
          // Preload personal-side dynamic chunks while on pro side
          import("@/components/personal/TravelMap");
          import("@/components/personal/MobileTravelMap");
        }
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        run();
      }
    }, 1000);

    return () => clearTimeout(delayId);
  }, [isPersonal, router]);

  // Scroll-spy: highlight the link for whichever section is currently most visible.
  useEffect(() => {
    const linkList = isPersonal ? PERSONAL_LINKS : PRO_LINKS;
    const ids = linkList.map((l) => l.href.slice(1));
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          setActiveSection(visible.target.id);
        } else if (sections[0].getBoundingClientRect().top > window.innerHeight * 0.5) {
          // No tracked section is in the active strip AND the first one is
          // still below the viewport midline — we're above everything (e.g.
          // on the Hero), so no link should be highlighted.
          setActiveSection(null);
        }
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname, isPersonal]);

  const links = isPersonal ? PERSONAL_LINKS : PRO_LINKS;
  const homeHref = isPersonal ? "/personal" : "/";

  const handleToggle = (target) => {
    if (target === side) return;
    analytics.sideToggled(side, target, "navbar");
    setMenuOpenInstant(false);
    router.push(target === "personal" ? "/personal" : "/");
  };

  return (
    <nav
      ref={navRef}
      className={`${styles.nav} ${styles[side]} ${scrolled ? styles.scrolled : ""} ${menuOpen ? styles.navMenuOpen : ""}`}
    >
      <div className={styles.inner}>
        <Link href={homeHref} className={styles.logo} aria-label="Home">
          Ashzaeen <span className={styles.star}>✦</span>
        </Link>

        {/* Desktop: section links centered */}
        <div className={`${styles.links} desktop-only`}>
          {links.map((l) => {
            const isActive = activeSection === l.href.slice(1);
            return (
              <a
                key={l.label}
                href={l.href}
                onClick={() => analytics.navLinkClicked(l.href.slice(1), side)}
                className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
              >
                {l.label}
              </a>
            );
          })}
        </div>

        {/* Always-visible right group: toggle + (mobile) hamburger */}
        <div className={styles.navRight}>
          <Toggle side={side} onChange={handleToggle} location="navbar" />
          <button
            type="button"
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ""} mobile-only`}
            onClick={() => {
              const willOpen = !menuOpen;
              if (willOpen) analytics.mobileMenuOpened(side);
              setMenuOpenInstant(willOpen);
            }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <MobileMenu
            key="mobile-menu"
            side={side}
            links={links}
            activeSection={activeSection}
            onClose={() => setMenuOpenInstant(false)}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}

function MobileMenu({ side, links, activeSection, onClose }) {
  const isPersonal = side === "personal";
  return (
    <motion.div
      id="mobile-menu"
      role="menu"
      aria-label="Section navigation"
      className={styles.menuOverlay}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{
        duration: isPersonal ? 0.26 : 0.22,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      style={{ transformOrigin: "top right" }}
    >
      {/* Personal-only: folded paper corner at top-right where it meets the hamburger */}
      {isPersonal && (
        <>
          <span className={styles.foldShade} aria-hidden="true" />
          <span className={styles.foldCrease} aria-hidden="true" />
        </>
      )}

      <nav className={styles.menuNav} aria-label="Sections">
        {links.map((l, i) => {
          const isActive = activeSection === l.href.slice(1);
          return (
            <motion.a
              key={l.label}
              href={l.href}
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                analytics.navLinkClicked(l.href.slice(1), side);
                // Close menu first, then scroll — avoids two competing full-page
                // animations (menu exit + page scroll) happening simultaneously,
                // which is the main cause of mobile scroll jank from the nav menu.
                onClose();
                const id = l.href.slice(1);
                const exitMs = isPersonal ? 260 : 220;
                setTimeout(() => {
                  const el = document.getElementById(id);
                  if (!el) return;
                  window.history.pushState(null, "", l.href);
                  const navH = 56; // mobile navbar height
                  const y = el.getBoundingClientRect().top + window.scrollY - navH;
                  window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
                }, exitMs);
              }}
              className={`${styles.menuLink} ${isActive ? styles.menuLinkActive : ""}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: 0.08 + i * 0.04,
                duration: 0.25,
                ease: [0.22, 0.61, 0.36, 1],
              }}
            >
              {isPersonal ? (
                <>
                  <span className={styles.linkGlyph} aria-hidden="true">
                    {l.glyph}
                  </span>
                  <span className={styles.linkLabel}>{l.label}</span>
                </>
              ) : (
                <>
                  <span className={styles.linkNumber} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.linkArrow} aria-hidden="true">
                    ▸
                  </span>
                  <span className={styles.linkLabel}>{l.label}</span>
                </>
              )}
            </motion.a>
          );
        })}
      </nav>
    </motion.div>
  );
}

function Toggle({ side, onChange, location = "navbar" }) {
  // "How long do people hover the pro/personal toggle?" — dwell ≥500ms only.
  const hover = useHoverDwell((d) => analytics.sideToggleHovered(location, d));
  // On click we don't navigate immediately. We set `target` so the pill
  // slides to the clicked side, then fire onChange (the route push) the
  // moment it lands — onAnimationComplete. Because the destination page
  // mounts its own toggle with the pill already at this position, the
  // template fade-in reads as one continuous motion.
  const [target, setTarget] = useState(null);
  const effective = target ?? side;
  const effPersonal = effective === "personal";

  const handleClick = (t) => {
    if (target) return;     // a slide is already in flight
    if (t === side) return; // already on this side
    setTarget(t);
  };

  return (
    <div
      className={styles.toggle}
      role="tablist"
      aria-label="Switch between professional and personal sides"
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      <motion.div
        className={styles.toggleIndicator}
        initial={false}
        animate={{ left: effPersonal ? "calc(50% + 0px)" : 3 }}
        transition={
          target
            ? { type: "tween", duration: 0.36, ease: [0.4, 0, 0.2, 1] }
            : { type: "spring", stiffness: 500, damping: 38 }
        }
        onAnimationComplete={() => {
          if (target) onChange(target);
        }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={!effPersonal}
        onClick={() => handleClick("pro")}
        className={`${styles.toggleHalf} ${!effPersonal ? styles.active : ""}`}
      >
        Professional
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={effPersonal}
        onClick={() => handleClick("personal")}
        className={`${styles.toggleHalf} ${effPersonal ? styles.active : ""}`}
      >
        Personal
      </button>
    </div>
  );
}
