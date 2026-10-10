import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 缩略图在构建期由 sharp 预生成（public/thumbs），原图直接由 nginx 托管，
    // 因此彻底关闭 next/image 运行时优化器：Node 进程不再读取/缩放任何原图。
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