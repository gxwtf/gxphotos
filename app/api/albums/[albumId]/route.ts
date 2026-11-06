import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import { getViewCount } from '@/lib/counter';

const INFO_DIR = join(process.cwd(), 'public/info');

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