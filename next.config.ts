import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained .next/standalone build for a minimal Docker image.
  output: 'standalone',
  images: {
    // Posters are served from TMDB's image CDN.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
