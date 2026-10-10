import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join, normalize, resolve, sep } from 'path';
import { Readable } from 'stream';
import { PHOTOS_DIR } from '@/lib/paths';

/**
 * 开发期原图兜底路由：`next dev` 时没有 nginx，原图仍需能显示。
 * 生产环境由 nginx 直接托管 <PHOTOS_DIR>（见 deploy/nginx.example.conf），
 * 请求根本不会到达 Node，因此这里直接返回 404，避免原图进入 Node 进程。
 */

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('原图由 nginx 提供，请检查 nginx 的 /photos/ location 配置', {
      status: 404,
    });
  }

  const { path: segments } = await params;
  const relPath = normalize(decodeURIComponent(segments.join('/')));
  const filePath = resolve(join(PHOTOS_DIR, relPath));

  // 防目录穿越：必须落在 PHOTOS_DIR 之内
  if (filePath !== resolve(PHOTOS_DIR) && !filePath.startsWith(resolve(PHOTOS_DIR) + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  const info = await stat(filePath).catch(() => null);
  if (!info || !info.isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const contentType = CONTENT_TYPES[filePath.slice(filePath.lastIndexOf('.')).toLowerCase()];
  const body = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;

  return new Response(body, {
    headers: {
      'Content-Type': contentType ?? 'application/octet-stream',
      'Content-Length': String(info.size),
      'Cache-Control': 'no-store',
    },
  });
}
