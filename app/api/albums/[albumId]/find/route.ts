import { NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import ExifParser from 'exif-parser';

const PHOTOS_DIR = join(process.cwd(), 'public/photos');

function getExifDate(filePath: string): string | null {
  try {
    const buffer = readFileSync(filePath);
    const parser = ExifParser.create(buffer);
    const result = parser.parse();

    const parseDate = (value: unknown): string | null => {
      if (typeof value === 'number') {
        const d = new Date(value * 1000);
        if (isNaN(d.getTime())) return null;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      }
      if (typeof value === 'string') {
        const [date] = value.split(' ');
        const [year, month, day] = date.split(':');
        return `${year}-${month}-${day}`;
      }
      return null;
    };

    const date = parseDate(result.tags?.DateTimeOriginal) || parseDate(result.tags?.DateTime);
    if (date) return date;
  } catch {
    // silently fail
  }

  return null;
}

function getFileDate(filePath: string): string {
  const stat = statSync(filePath);
  return stat.mtime.toISOString().split('T')[0];
}

function getPhotoDate(albumId: string, filename: string): string {
  const filePath = join(PHOTOS_DIR, albumId, filename);
  if (!existsSync(filePath)) return new Date().toISOString().split('T')[0];
  return getExifDate(filePath) || getFileDate(filePath);
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
    
    // 转换为 Photo 对象格式，路径为 /photos/{albumId}/{filename}
    const photos = data.photos.map((name: string) => ({
      name: name,
      path: `/photos/${albumId}/${name}`,
      shotDate: getPhotoDate(albumId, name),
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