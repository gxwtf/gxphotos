import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

const PHOTOS_DIR = join(process.cwd(), 'public/photos');
const INFO_DIR = join(process.cwd(), 'public/info');

export async function GET() {
  try {
    // 获取所有相册文件夹
    const albumDirs = readdirSync(PHOTOS_DIR).filter(name => {
      const path = join(PHOTOS_DIR, name);
      return statSync(path).isDirectory();
    });

    const albums = albumDirs.map(albumId => {
      const infoPath = join(INFO_DIR, albumId, 'info.json');
      
      let info = {
        id: albumId,
        title: albumId,
        description: '',
        location: '',
        shootDate: '',
        endDate: '',
        coverImage: '',
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