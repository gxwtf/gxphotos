import { readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { isImageFile, PHOTOS_DIR } from '@/lib/paths';
import { getPhotoTimestamps } from '@/lib/photo-meta';
import { toOriginalUrl } from '@/lib/photo-url';

interface Photo {
  name: string;
  path: string;
  shotDate?: string; // ISO date string (YYYY-MM-DD)，按天分组用
  shotTime?: number; // 拍摄时间的墙上时间 epoch 毫秒，精确排序用
}

/**
 * 并发度：取 EXIF 需要整份读原图，串行读 4000 张要好几秒；
 * 并发 8 既能压满磁盘读、又不会把内存顶穿（单张原图 2~5 MB）。
 */
const CONCURRENCY = 8;

async function collectPhotos(
  albumPath: string,
  albumId: string,
  filenames: string[]
): Promise<Photo[]> {
  const photos: Photo[] = new Array(filenames.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(CONCURRENCY, filenames.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= filenames.length) return;
      const name = filenames[index];
      const { shotDate, shotTime } = await getPhotoTimestamps(join(albumPath, name));
      photos[index] = {
        name,
        // URL 与物理位置解耦：原图由 nginx 从 PHOTOS_DIR 托管
        path: toOriginalUrl(albumId, name),
        shotDate,
        shotTime,
      };
    }
  });

  await Promise.all(workers);
  return photos;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params;
    const albumPath = join(PHOTOS_DIR, albumId);

    if (!existsSync(albumPath)) {
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      );
    }

    // 只遍历当前目录中的照片（不递归扫描子目录）
    const items = readdirSync(albumPath).filter((item) => {
      const itemPath = join(albumPath, item);
      return !statSync(itemPath).isDirectory() && isImageFile(item);
    });

    const photos = await collectPhotos(albumPath, albumId, items);

    return NextResponse.json({
      albumId,
      count: photos.length,
      photos,
    });
  } catch (error) {
    console.error('Error reading photos:', error);
    return NextResponse.json(
      { error: 'Failed to read photos' },
      { status: 500 }
    );
  }
}
