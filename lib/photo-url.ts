/**
 * 纯字符串的 URL 映射助手 —— 客户端组件也可以安全 import（不含任何 node 模块）。
 *
 * URL 契约：
 *   原图   /photos/<albumId>/<filename>           由 nginx 静态提供（见 deploy/nginx.example.conf）
 *   缩略图 /thumbs/<albumId>/<filename>.webp      构建期由 scripts/generate-thumbnails.mjs 生成，
 *                                               位于 public/thumbs/ 由 Next 静态服务
 */

export const ORIGINAL_URL_PREFIX = '/photos';
export const THUMB_URL_PREFIX = '/thumbs';
export const THUMB_SUFFIX = '.webp';

/** 原图 URL：由 albumId + 文件名拼出，与照片的物理目录解耦 */
export function toOriginalUrl(albumId: string, filename: string): string {
  return `${ORIGINAL_URL_PREFIX}/${albumId}/${filename}`;
}

/** 归一化成 `/photos/...` 形式（容忍传入相对路径或已带前缀的路径） */
function normalizeOriginalUrl(photoPath: string): string {
  if (photoPath.startsWith(ORIGINAL_URL_PREFIX + '/')) return photoPath;
  if (photoPath.startsWith('/')) return photoPath;
  return `${ORIGINAL_URL_PREFIX}/${photoPath}`;
}

/**
 * 原图 URL → 缩略图 URL（纯字符串替换，相册与文件名原样保留）。
 * `/photos/a/x.jpg` → `/thumbs/a/x.jpg.webp`
 */
export function toThumbUrl(photoPath: string): string {
  const normalized = normalizeOriginalUrl(photoPath);
  if (!normalized.startsWith(ORIGINAL_URL_PREFIX + '/')) return normalized;
  const rest = normalized.slice(ORIGINAL_URL_PREFIX.length); // 以 '/' 开头
  return `${THUMB_URL_PREFIX}${rest}${THUMB_SUFFIX}`;
}
