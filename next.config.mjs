/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reverse-proxy PostHog through our own domain (/ingest/*) so analytics
  // survives ad blockers. Points at PostHog US cloud. If you ever move the
  // project to EU cloud, swap us(-assets).i.posthog.com → eu(-assets).i.posthog.com
  // here AND update ui_host in app/providers.jsx.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog's API needs trailing-slash requests to pass through untouched.
  skipTrailingSlashRedirect: true,

  // Safety net for static generation: the build pre-renders every slug page,
  // each rendering the full landing. Notion reads are deduped per build (see
  // lib/notion.js), so this rarely bites — but give slow/retried pages headroom
  // over the 60s default so a transient hiccup doesn't fail the whole build.
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
