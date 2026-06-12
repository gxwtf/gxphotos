import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import ExifParser from 'exif-parser';

const PHOTOS_DIR = join(process.cwd(), 'public/photos');
const INFO_DIR = join(process.cwd(), 'public/info');

function getExifDate(filePath: string): string | null {
  try {
    const buffer = readFileSync(filePath);
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    
    if (result.tags?.DateTime) {
      const dateStr = result.tags.DateTime;
      const [date] = dateStr.split(' ');
      const [year, month, day] = date.split(':');
      return `${year}-${month}-${day}`;
    }
    
    if (result.tags?.DateTimeOriginal) {
      const dateStr = result.tags.DateTimeOriginal;
      const [date] = dateStr.split(' ');
      const [year, month, day] = date.split(':');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    // Silently fail if EXIF parsing fails
  }
  
  return null;
}

function getFileDate(filePath: string): string {
  const stat = statSync(filePath);
  const mtime = stat.mtime;
  return mtime.toISOString().split('T')[0];
}

function getAlbumDateRange(albumId: string): { shootDate: string; endDate: string } {
  const albumPath = join(PHOTOS_DIR, albumId);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const dates: string[] = [];
  
  if (existsSync(albumPath)) {
    const items = readdirSync(albumPath);
    
    for (const item of items) {
      const itemPath = join(albumPath, item);
      const stat = statSync(itemPath);
      
      if (!stat.isDirectory()) {
        const ext = '.' + item.split('.').pop()?.toLowerCase();
        if (imageExtensions.includes(ext)) {
          const date = getExifDate(itemPath) || getFileDate(itemPath);
          dates.push(date);
        }
      }
    }
  }
  
  if (dates.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return { shootDate: today, endDate: today };
  }
  
  dates.sort();
  return {
    shootDate: dates[0],
    endDate: dates[dates.length - 1],
  };
}

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
  request: Request,
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
    
    const { shootDate, endDate } = getAlbumDateRange(albumId);
    const viewCount = getViewCount(albumId);

    return NextResponse.json({
      id: albumId,
      ...info,
      shootDate,
      endDate,
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
