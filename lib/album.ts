import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const INFO_DIR = join(process.cwd(), 'public/info');

export interface AlbumInfo {
  id: string;
  title: string;
  description: string;
  location?: string;
  shootDate?: string;
  endDate?: string;
  coverImage?: string;
}

export function getAlbumInfo(albumId: string): AlbumInfo | null {
  try {
    const infoPath = join(INFO_DIR, albumId, 'info.json');

    if (!existsSync(infoPath)) {
      return null;
    }

    const rawData = readFileSync(infoPath, 'utf-8');
    const info = JSON.parse(rawData);

    return {
      id: albumId,
      ...info,
    };
  } catch {
    return null;
  }
}
