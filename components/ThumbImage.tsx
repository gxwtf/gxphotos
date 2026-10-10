'use client';

import { toThumbUrl } from '@/lib/photo-url';

interface ThumbImageProps {
  /** 原图 URL，形如 /photos/<albumId>/<filename>；缩略图 URL 由 toThumbUrl 推导 */
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * 网格 / 轮播用的缩略图 <img>。
 *
 * - 默认请求 `/thumbs/...`（构建期由 scripts/generate-thumbnails.mjs 预生成的 WebP），
 *   不再走 `next/image` 运行时优化器（已在 next.config.ts 全局 unoptimized）。
 * - 缩略图缺失或生成失败时 onError 回退到原图 URL，保证图仍然可见。
 */
export default function ThumbImage({
  src,
  alt,
  className,
  loading = 'lazy',
}: ThumbImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 缩略图已预压缩，且需要 onError 回退原图
    <img
      src={toThumbUrl(src)}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        // 原图也失败时不再反复回退，避免死循环
        if (img.dataset.thumbFallback === '1') return;
        img.dataset.thumbFallback = '1';
        img.src = src;
      }}
    />
  );
}
