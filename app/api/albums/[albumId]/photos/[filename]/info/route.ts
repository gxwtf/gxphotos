import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';
import ExifParser from 'exif-parser';

const PHOTOS_DIR = join(process.cwd(), 'public/photos');

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ albumId: string; filename: string }> }
) {
  try {
    const { albumId, filename } = await params;
    const filePath = join(PHOTOS_DIR, albumId, decodeURIComponent(filename));

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;
    const fileSizeFormatted = formatFileSize(fileSize);

    let captureTime: string | null = null;
    let camera: string | null = null;

    try {
      const buffer = readFileSync(filePath);
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      if (result.tags?.DateTimeOriginal) {
        captureTime = result.tags.DateTimeOriginal as string;
      } else if (result.tags?.DateTime) {
        captureTime = result.tags.DateTime as string;
      }

      const make = result.tags?.Make as string | undefined;
      const model = result.tags?.Model as string | undefined;
      if (make && model) {
        camera = `${make} ${model}`;
      } else if (model) {
        camera = model;
      } else if (make) {
        camera = make;
      }
    } catch {
      // EXIF parsing failed, leave fields null
    }

    return NextResponse.json({
      name: filename,
      size: fileSizeFormatted,
      captureTime,
      camera,
    });
  } catch (error) {
    console.error('Error reading photo info:', error);
    return NextResponse.json(
      { error: 'Failed to read photo info' },
      { status: 500 }
    );
  }
}