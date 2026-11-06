import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';
import { PHOTOS_DIR } from '@/lib/paths';
import { getPhotoTimestamps, type PhotoTimestamps } from '@/lib/photo-meta';
import { toOriginalUrl } from '@/lib/photo-url';

function getPhotoTimestampsSafe(albumId: string, filename: string): PhotoTimestamps {
  const filePath = join(PHOTOS_DIR, albumId, filename);
  if (!existsSync(filePath)) {
    const now = Date.now();
    return { shotDate: new Date(now).toISOString().split('T')[0], shotTime: now };
  }
  return getPhotoTimestamps(filePath);
}

// 从环境变量读取人脸服务地址，默认值作为备选
const FACE_API_URL = process.env.NEXT_PUBLIC_FACE_API_URL || 'http://localhost:8001';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;
  const { query } = await request.json();

  if (!query) {
    return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
  }

  try {
    // 调用 FastAPI 服务
    const response = await fetch(`${FACE_API_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        album: albumId,
        query: query.trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || '搜索失败');
    }

    const data = await response.json();
    
    // 转换为 Photo 对象格式，路径为 /photos/{albumId}/{filename}（由 nginx 提供原图）
    const photos = data.photos.map((name: string) => ({
      name: name,
      path: toOriginalUrl(albumId, name),
      ...getPhotoTimestampsSafe(albumId, name),
    }));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('搜索执行失败:', error);
    return NextResponse.json(
      { error: '搜索失败，请确保人脸服务已启动' },
      { status: 500 }
    );
  }
}
