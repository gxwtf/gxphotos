import { join, isAbsolute } from 'path';

/**
 * 服务器端路径解析（只在服务端代码里 import，切勿在客户端组件里 import，
 * 否则会把 node:path 打进浏览器 bundle —— 客户端可用的纯字符串助手在 lib/photo-url.ts）。
 */

const ROOT = process.cwd();

function resolveDir(envValue: string | undefined, fallback: string): string {
  const value = envValue?.trim();
  if (!value) return fallback;
  // 动态拼接路径会让 Turbopack 把整个项目纳入 build trace（构建期读取并驻留项目树内全部文件
  // —— 82G 原图导致构建 OOM 正是这个机制）。这里显式放弃该静态分析。
  return isAbsolute(value) ? value : join(/* turbopackIgnore: true */ ROOT, value);
}

/**
 * 原图根目录。
 * - 生产：由 `.env` 的 `PHOTOS_DIR` 指定（nginx 也从同一目录直接托管原图）
 * - 开发：默认 `<项目>/photos_data`（位于项目根下、public 之外；已被 .gitignore 忽略）
 *
 * ⚠️ 注意：`next build` 会读取并驻留**项目树内**的文件，原图目录务必留在项目之外，
 * 否则会重现 82 GB 级别构建 OOM。开发期默认值 `photos_data` 位于项目树内，
 * 只适合放少量样图；真实照片库请用绝对路径指向项目外（如 /data/gxphotos/photos）。
 */
export const PHOTOS_DIR = resolveDir(process.env.PHOTOS_DIR, join(ROOT, 'photos_data'));

/** 相册元信息（小文件，仍留在 public 内，无需迁移） */
export const INFO_DIR = join(ROOT, 'public/info');

/** 学生大头照目录（人脸检索用，可被 STUDENT_DIR 覆盖） */
export const STUDENT_DIR = resolveDir(process.env.STUDENT_DIR, join(ROOT, 'public/students'));

/** 人脸检索结果副本目录：必须留在 public 下供网页访问 */
export const SEARCH_RESULTS_DIR = join(ROOT, 'public/search_results');

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const;

/** 与 photos API 保持一致：只认这些图片后缀 */
export function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
