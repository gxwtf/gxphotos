import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

const INFO_DIR = join(process.cwd(), 'public/info');

function getViewCount(albumId: string): number {
  const viewCountPath = join(INFO_DIR, albumId, 'views.txt');
  if (existsSync(viewCountPath)) {
    try {
      const count = readFileSync(viewCountPath, 'utf-8').trim();
      return parseInt(count, 10) || 0;
    } catch {
      return 0;
    }
  }
  // 返回一个随机模拟浏览次数（用于演示）
  return Math.floor(Math.random() * 50000) + 1000;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  try {
    const { albumId } = await params;
    const infoPath = join(INFO_DIR, albumId, 'info.json');

    if (!existsSync(infoPath)) {
      return NextResponse.json(
        { error: 'Album not found' },
        { status: 404 }
      );
    }

    const rawData = readFileSync(infoPath, 'utf-8');
    const info = JSON.parse(rawData);
    
    const viewCount = getViewCount(albumId);

    return NextResponse.json({
      id: albumId,
      ...info,
      viewCount,
    });
  } catch (error) {
    console.error('Error reading album:', error);
    return NextResponse.json(
      { error: 'Failed to read album' },
      { status: 500 }
    );
  }
}