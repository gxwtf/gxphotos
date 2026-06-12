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

export async function GET() {
  try {
    // 获取所有相册文件夹
    const albumDirs = readdirSync(PHOTOS_DIR).filter(name => {
      const path = join(PHOTOS_DIR, name);
      return statSync(path).isDirectory();
    });

    const albums = albumDirs.map(albumId => {
      const infoPath = join(INFO_DIR, albumId, 'info.json');
      const { shootDate, endDate } = getAlbumDateRange(albumId);
      
      let info = {
        id: albumId,
        title: albumId,
        description: '',
        location: '',
        shootDate,
        endDate,
      };

      if (existsSync(infoPath)) {
        const rawData = readFileSync(infoPath, 'utf-8');
        const jsonData = JSON.parse(rawData);
        info = { ...info, ...jsonData, id: albumId };
      }

      return info;
    });

    // 按时间倒序排列
    albums.sort((a, b) => new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime());

    return NextResponse.json(albums);
  } catch (error) {
    console.error('Error reading albums:', error);
    return NextResponse.json({ error: 'Failed to read albums' }, { status: 500 });
  }
}
