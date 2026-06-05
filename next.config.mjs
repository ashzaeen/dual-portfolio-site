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

  // Safety net for static generation. PersonalLanding fetches are protected by
  // unstable_cache (cross-worker) and build-phase memoization (within a worker)
  // but on a cold first build, a slow Notion API can still push close to 120s.
  // 240s gives comfortable headroom without letting genuinely broken pages hang.
  staticPageGenerationTimeout: 240,
};

export default nextConfig;
