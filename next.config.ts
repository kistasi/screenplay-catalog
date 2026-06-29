import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
