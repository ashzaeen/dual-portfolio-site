"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

// PostHog bootstrap for the App Router. Lives in the root layout (NOT
// app/template.jsx) so init runs exactly once and survives client-side
// navigations. When NEXT_PUBLIC_POSTHOG_KEY is unset (e.g. local dev), the
// SDK never initializes and every capture call no-ops — see lib/analytics.js.
export function PostHogProvider({ children }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      // Reverse proxy (see next.config.mjs rewrites) — dodges ad blockers.
      api_host: "/ingest",
      // Where the SDK links to the PostHog UI (toolbar etc.). Direct, not proxied.
      ui_host: "https://us.posthog.com",
      // We capture $pageview manually below; App Router doesn't fire a fresh
      // page load on client navigations, so the SDK's auto-pageview misses them.
      capture_pageview: false,
      capture_pageleave: true,
      // Don't create a person profile for anonymous visitors — keeps us well
      // inside the free tier and avoids tracking drive-by traffic as people.
      person_profiles: "identified_only",
      // Click/scroll heatmaps (autocapture-based) — "where do people linger".
      capture_heatmaps: true,
      // Session replay. NOTE: also flip Session Replay ON in the PostHog
      // project settings (Settings → Replay) — it's server-gated, this client
      // config only governs masking/sampling once it's enabled there.
      // Inputs are masked by default; text is left visible so replays are
      // legible. Revisit before launch if you add any form that collects PII.
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-mask]",
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <SuspendedPageView />
      {children}
    </PHProvider>
  );
}

// Fires a $pageview whenever the path or query string changes. usePathname /
// useSearchParams are the App Router's signal for SPA route changes.
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || !ph || !posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += "?" + qs;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

// useSearchParams opts the subtree into client rendering; isolating it behind
// Suspense stops that from deopting the whole app to CSR.
function SuspendedPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
