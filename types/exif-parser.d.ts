declare module 'exif-parser' {
  interface ExifTags {
    DateTime?: string;
    DateTimeOriginal?: string;
    [key: string]: any;
  }

  interface ExifResult {
    tags: ExifTags;
  }

  function create(buffer: Buffer): {
    parse(): ExifResult;
  };

  export default {
    create,
  };
}