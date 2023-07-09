/** @type {import('next').NextConfig} */

const nextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: "/static/:match*",
        destination: "https://app.posthog.com/static/:match*",
      },
      {
        source: "/:slug*",
        destination: "/api/continue",
      },
    ];
  },
};

module.exports = nextConfig;
