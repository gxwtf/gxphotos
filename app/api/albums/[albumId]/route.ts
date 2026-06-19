import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

const INFO_DIR = join(process.cwd(), 'public/info');
const COUNTER_API = 'https://counter.jerryz.com.cn/api/counter';

async function getViewCount(albumId: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(COUNTER_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: albumId }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return 0;

    const svgText = await response.text();
    const match = svgText.match(/<text[^>]*>(\d+)<\/text>/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    console.error(`Failed to fetch view count for album: ${albumId}`);
    return 0;
  }
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
    
    const viewCount = await getViewCount(albumId);

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