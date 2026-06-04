"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiDevpost, SiGithub, SiInstagram, SiVsco } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa";
import { TbWorld } from "react-icons/tb";
import styles from "./PersonalFooter.module.css";
import { FALLBACK_FOOTER_PERSONAL, FALLBACK_FOOTER_SOCIALS } from "@/data/footer";
import { analytics } from "@/lib/analytics";
import { useHoverDwell } from "@/lib/dwell";

// React-icons component map. Keys match the Socials DB's `Icon` Select
// values (lowercased). Unknown keys fall through to TbWorld (generic
// globe) so a new social added in Notion still renders.
const ICON_MAP = {
  devpost: SiDevpost,
  github: SiGithub,
  linkedin: FaLinkedinIn,
  instagram: SiInstagram,
  vsco: SiVsco,
};

function pickIcon(icon) {
  return ICON_MAP[String(icon ?? "").toLowerCase()] ?? TbWorld;
}

export default function PersonalFooter({
  config = FALLBACK_FOOTER_PERSONAL,
  socials = FALLBACK_FOOTER_SOCIALS,
}) {
  const router = useRouter();
  // Clicking "Professional" slides the pill across first, then navigates the
  // instant it lands (onTransitionEnd) so the switch feels like one motion.
  const [leaving, setLeaving] = useState(false);
  const toggleHover = useHoverDwell((d) => analytics.sideToggleHovered("footer", d));
  return (
    <footer className={styles.footer}>

      {/* ── Wax-seal divider ── */}
      <div className={styles.sealRow}>
        <div className={styles.sealRuleL} />
        <div className={styles.seal}>
          <span className={styles.sealLetter}>{config.avatarLetter}</span>
        </div>
        <div className={styles.sealRuleR} />
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* Identity */}
        <div className={styles.identity}>
          <p className={styles.name}>{config.footerName}</p>
          <p className={styles.tagline}>&ldquo;{config.quote}&rdquo;</p>
        </div>

        {/* Side toggle — currently on the personal side */}
        <div
          className={styles.toggle}
          role="tablist"
          aria-label="Switch between professional and personal sides"
          onMouseEnter={toggleHover.onMouseEnter}
          onMouseLeave={toggleHover.onMouseLeave}
        >
          <span
            className={`${styles.toggleIndicator}${leaving ? " " + styles.toggleIndicatorGo : ""}`}
            aria-hidden="true"
            onTransitionEnd={(e) => {
              if (leaving && e.propertyName === "left") router.push("/");
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className={`${styles.toggleHalf}${leaving ? " " + styles.toggleActive : ""}`}
            onClick={() => { if (!leaving) { analytics.sideToggled("personal", "professional", "footer"); setLeaving(true); } }}
          >
            Professional
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className={`${styles.toggleHalf}${!leaving ? " " + styles.toggleActive : ""}`}
            onClick={() => router.push("/personal")}
          >
            Personal
          </button>
        </div>

        {/* Social icons */}
        <nav className={styles.socials} aria-label="Social links">
          {socials.map((social) => {
            const Icon = pickIcon(social.icon);
            return (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.iconLink}
                aria-label={social.name}
                onClick={() => analytics.externalLinkClicked(social.url, `footer-social:${social.name}`)}
              >
                <span className={styles.iconWrap}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className={styles.iconLabel}>{social.name}</span>
              </a>
            );
          })}
        </nav>

        {/* High-school postage stamp */}
        {config.stampUrl && (
          <div className={styles.hsSection}>
            <span className={styles.hsCaption}>where it all started</span>
            <a
              href={config.stampUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.hsStamp}
              aria-label={`Visit ${config.stampSubtitle} website`}
            >
              {/* Postmark cancellation — decorative, aria-hidden */}
              <div className={styles.postmark} aria-hidden="true">
                <div className={styles.pmCircle} />
                <div className={styles.pmLines}>
                  <div /><div /><div />
                </div>
              </div>

              <span className={styles.stampSchool}>{config.stampTitle}</span>
              <span className={styles.stampLoc}>{config.stampSubtitle}</span>
              <span className={styles.stampYear}>{config.stampCaption}</span>
            </a>
          </div>
        )}

        {/* Utility — copyright */}
        <div className={styles.utilRow}>
          <Link href="/copyright" className={styles.utilLink}>
            Usage &amp; Copyright →
          </Link>
        </div>

      </div>

      {/* ── Colophon ── */}
      <div className={styles.colophon}>
        <span className={styles.coloCopy}>© {new Date().getFullYear()}</span>
        <span className={styles.coloPowered}>{config.bottomTagline}</span>
        <span className={styles.coloEdition}>{config.sideLabel}</span>
      </div>

    </footer>
  );
}
