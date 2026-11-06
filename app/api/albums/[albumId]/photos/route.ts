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

    const photos: Photo[] = [];

    // 只遍历当前目录中的照片（不递归扫描子目录）
    const items = readdirSync(albumPath);

    for (const item of items) {
      const itemPath = join(albumPath, item);
      const stat = statSync(itemPath);

      if (!stat.isDirectory() && isImageFile(item)) {
        const { shotDate, shotTime } = getPhotoTimestamps(itemPath);

        photos.push({
          name: item,
          // URL 与物理位置解耦：原图由 nginx 从 PHOTOS_DIR 托管
          path: toOriginalUrl(albumId, item),
          shotDate,
          shotTime,
        });
      }
    }

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
