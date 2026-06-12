import { readdirSync, existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import ExifParser from 'exif-parser';

const PHOTOS_DIR = join(process.cwd(), 'public/photos');

interface Photo {
  name: string;
  path: string;
  shotDate?: string; // ISO date string (YYYY-MM-DD)
}

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
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    // 只遍历当前目录中的照片（不递归扫描子目录）
    const items = readdirSync(albumPath);
    
    for (const item of items) {
      const itemPath = join(albumPath, item);
      const stat = statSync(itemPath);
      
      if (!stat.isDirectory()) {
        const ext = '.' + item.split('.').pop()?.toLowerCase();
        if (imageExtensions.includes(ext)) {
          const shotDate = getExifDate(itemPath) || getFileDate(itemPath);
          
          photos.push({
            name: item,
            path: itemPath.replace(join(process.cwd(), 'public'), ''),
            shotDate,
          });
        }
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