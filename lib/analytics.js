import posthog from "posthog-js";

// Single source of truth for every custom event the site fires. Keeping the
// names + property shapes here (rather than scattering posthog.capture calls)
// means the event taxonomy lives in one place and stays consistent. The
// duration/hover timing that feeds the *_closed / *_hovered events lives in
// lib/dwell.js; cross-section dwell + scroll depth live in
// components/shared/EngagementTracker.jsx.
//
// All wrappers no-op safely when PostHog isn't initialized — e.g. local dev
// without NEXT_PUBLIC_POSTHOG_KEY, or before the provider's init effect runs.
function capture(event, props) {
  if (typeof window === "undefined") return;
  if (!posthog.__loaded) return;
  posthog.capture(event, props);
}

export const analytics = {
  // ── Navigation & the Pro/Personal toggle ──────────────────────────
  sideViewed: (side) => capture("side_viewed", { side }),
  sideToggled: (from, to, location) =>
    capture("side_toggled", { from, to, location }),
  sideToggleHovered: (location, durationMs) =>
    capture("side_toggle_hovered", { location, duration_ms: durationMs }),
  navLinkClicked: (section, side) =>
    capture("nav_link_clicked", { section, side }),
  mobileMenuOpened: (side) => capture("mobile_menu_opened", { side }),

  // ── Pro · Projects ─────────────────────────────────────────────────
  projectOpened: (p) =>
    capture("project_opened", {
      slug: p?.slug,
      title: p?.name ?? p?.title,
      category: p?.category,
    }),
  projectClosed: (slug, durationMs) =>
    capture("project_closed", { slug, duration_ms: durationMs }),
  projectLinkClicked: (slug, linkType) =>
    capture("project_link_clicked", { slug, link_type: linkType }),
  projectMediaViewed: (slug, mediaType) =>
    capture("project_media_viewed", { slug, media_type: mediaType }),

  // ── Pro · Experiences ──────────────────────────────────────────────
  experienceExpanded: (exp) =>
    capture("experience_expanded", {
      slug: exp?.slug,
      kind: exp?.kind,
      category: exp?.category,
    }),
  experienceCollapsed: (slug, durationMs) =>
    capture("experience_collapsed", { slug, duration_ms: durationMs }),

  // ── Pro · Tech Stack ───────────────────────────────────────────────
  techstackModeChanged: (from, to) =>
    capture("techstack_mode_changed", { from, to }),
  techstackNodeFocused: (nodeId, type) =>
    capture("techstack_node_focused", { node_id: nodeId, type }),
  techstackNodeClosed: (nodeId, durationMs) =>
    capture("techstack_node_closed", { node_id: nodeId, duration_ms: durationMs }),
  techstackNodeHovered: (nodeId, type, durationMs) =>
    capture("techstack_node_hovered", { node_id: nodeId, type, duration_ms: durationMs }),
  techstackMobileArchToggled: () => capture("techstack_mobile_arch_toggled"),
  techstackMobileDrawerOpened: (nodeId) =>
    capture("techstack_mobile_drawer_opened", { node_id: nodeId }),

  // ── Pro · Credentials ──────────────────────────────────────────────
  courseworkHovered: (name, provider, durationMs) =>
    capture("coursework_hovered", { name, provider, duration_ms: durationMs }),
  curiosityHovered: (name, category, durationMs) =>
    capture("curiosity_hovered", { name, category, duration_ms: durationMs }),
  certificationHovered: (name, issuer, durationMs) =>
    capture("certification_hovered", { name, issuer, duration_ms: durationMs }),
  credentialSearchOpened: () => capture("credential_search_opened"),
  credentialSearchPerformed: (query, resultsCount) =>
    capture("credential_search_performed", { query, results_count: resultsCount }),
  credentialHashCopied: (name) => capture("credential_hash_copied", { name }),
  credentialLinkClicked: (name, type) =>
    capture("credential_link_clicked", { name, type }),

  // ── Personal · Travel ──────────────────────────────────────────────
  postcardOpened: (loc) =>
    capture("postcard_opened", {
      location_id: loc?.id,
      location: loc?.city ?? loc?.name,
      region: loc?.region,
    }),
  postcardClosed: (loc, durationMs) =>
    capture("postcard_closed", {
      location_id: loc?.id,
      location: loc?.city ?? loc?.name,
      duration_ms: durationMs,
    }),
  regionSwitched: (region) => capture("region_switched", { region }),
  storyOpened: (storySlug, location) =>
    capture("story_opened", { story_slug: storySlug, location }),
  storyClosed: (storySlug, durationMs) =>
    capture("story_closed", { story_slug: storySlug, duration_ms: durationMs }),
  storyMediaNavigated: (storySlug, direction) =>
    capture("story_media_navigated", { story_slug: storySlug, direction }),

  // ── Personal · Gallery / The Wall ──────────────────────────────────
  wallOpened: () => capture("wall_opened"),
  wallClosed: (durationMs) => capture("wall_closed", { duration_ms: durationMs }),
  easterEggFound: () => capture("easter_egg_found"),
  galleryItemOpened: (item) =>
    capture("gallery_item_opened", {
      item_id: item?.id,
      item_type: item?.type,
      label: item?.label,
      dynamic: !!item?._dynamic,
    }),
  galleryItemClosed: (item, durationMs) =>
    capture("gallery_item_closed", {
      item_id: item?.id,
      item_type: item?.type,
      duration_ms: durationMs,
    }),
  wallToyUsed: (kind) => capture("wall_toy_used", { kind }),
  wallPaperOpened: (kind) => capture("wall_paper_opened", { kind }),

  // ── Personal · Music ───────────────────────────────────────────────
  musicSongLoaded: (song, method) =>
    capture("music_song_loaded", {
      song_id: song?.id,
      title: song?.title,
      method,
    }),
  musicPlaybackToggled: (song, action) =>
    capture("music_playback_toggled", { song_id: song?.id, action }),
  musicSpeedChanged: (speed) => capture("music_speed_changed", { speed }),
  musicListenDuration: (song, secondsPlayed) =>
    capture("music_listen_duration", {
      song_id: song?.id,
      title: song?.title,
      seconds_played: secondsPlayed,
    }),

  // ── Personal · Series (Screening Room) ─────────────────────────────
  seriesShowSelected: (show) =>
    capture("series_show_selected", { show_id: show?.id, title: show?.title }),
  seriesSpoilersToggled: (state) =>
    capture("series_spoilers_toggled", { state: state ? "on" : "off" }),
  seriesSpoilerRevealed: (showId) =>
    capture("series_spoiler_revealed", { show_id: showId }),

  // ── Personal · Writing ─────────────────────────────────────────────
  writingPieceOpened: (piece) =>
    capture("writing_piece_opened", { slug: piece?.slug, title: piece?.title }),
  writingPieceClosed: (slug, durationMs) =>
    capture("writing_piece_closed", { slug, duration_ms: durationMs }),
  writingArchiveOpened: () => capture("writing_archive_opened"),
  writingArchiveClosed: (durationMs) =>
    capture("writing_archive_closed", { duration_ms: durationMs }),
  writingPolaroidOpened: (which) =>
    capture("writing_polaroid_opened", { which }),
  writingDeskToggled: (object) => capture("writing_desk_toggled", { object }),

  // ── Cross-cutting engagement ───────────────────────────────────────
  sectionDwell: (section, side, durationMs, maxScrollDepth) =>
    capture("section_dwell", {
      section,
      side,
      duration_ms: durationMs,
      max_scroll_depth: maxScrollDepth,
    }),
  scrollDepth: (side, percent) => capture("scroll_depth", { side, percent }),
  externalLinkClicked: (url, context) =>
    capture("external_link_clicked", { url, context }),
  contactEmailClicked: () => capture("contact_email_clicked"),
  resumeDownloaded: () => capture("resume_downloaded"),
};
