import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [],
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/search_results/:path*',
        destination: '/search_results/:path*',
      },
    ];
  },
};

export default nextConfig;