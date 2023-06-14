/** @type {import('next').NextConfig} */

const nextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: "/static/:match*",
        destination: "https://ph.usecyclone.dev/static/:match*",
      },
      {
        source: "/:slug*",
        destination: "/api/mintlify",
      },
    ];
  },
};

module.exports = nextConfig;
