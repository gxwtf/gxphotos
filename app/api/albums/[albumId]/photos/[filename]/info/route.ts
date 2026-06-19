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

function formatExifDate(value: unknown): string | null {
  if (typeof value === 'number') {
    const d = new Date(value * 1000);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
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
    let dimensions: string | null = null;

    try {
      const buffer = readFileSync(filePath);
      const parser = ExifParser.create(buffer);
      const result = parser.parse();

      if (result.tags?.DateTimeOriginal) {
        captureTime = formatExifDate(result.tags.DateTimeOriginal);
      } else if (result.tags?.DateTime) {
        captureTime = formatExifDate(result.tags.DateTime);
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

      const tags = result.tags;
      // @ts-expect-error imageSize is built-in but not typed
      const imageSize = result.imageSize as { width: number; height: number } | undefined;
      const width =
        tags?.ExifImageWidth ??
        imageSize?.width;
      const height =
        tags?.ExifImageHeight ??
        imageSize?.height;
      if (width && height) {
        dimensions = `${width} × ${height}`;
      }
    } catch {
      // EXIF parsing failed, leave fields null
    }

    return NextResponse.json({
      name: filename,
      size: fileSizeFormatted,
      dimensions,
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