import { readFileSync, statSync } from 'fs';
import ExifParser from 'exif-parser';

/**
 * 照片时间口径（服务端专用，勿在客户端组件 import，否则 node:fs 会被打进浏览器包）。
 *
 * EXIF 的 `DateTimeOriginal` 是**不带时区的墙上时间**（形如 `2026:11:06 12:29:05`），
 * `exif-parser` 会把它转成「按 UTC 解释的秒级时间戳」。这里统一成
 * **墙上时间 epoch 毫秒**（= 把墙上时间当 UTC 存下来的毫秒数），这样：
 *
 * - `shotTime` 的数值大小顺序 === 用户在相册里看到的时间顺序（跨时区也不会错位）；
 * - `shotDate` 直接 `new Date(shotTime).toISOString().slice(0, 10)` 就是 `YYYY-MM-DD`，
 *   与改造前 `getExifDate()` 的返回值完全一致（按天分组的日期 tab 不变）。
 *
 * 没有 EXIF 时退回文件 mtime，并**同样换算到墙上时间口径**：mtime 是真实时刻，
 * 直接和 EXIF 的墙上时间戳比较会差一个时区（东八区 8 小时），跨天时排序会错。
 */
export interface PhotoTimestamps {
  /** `YYYY-MM-DD`（墙上时间），用于按天分组 */
  shotDate: string;
  /** 墙上时间 epoch 毫秒，用于精确排序 */
  shotTime: number;
}

/** EXIF 时间值（dom 里可能是 number 也可能是 string）→ 墙上时间 epoch 毫秒 */
function parseWallClockEpochMs(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // exif-parser 已按 UTC 解释墙上时间，直接乘 1000 即为墙上时间 epoch
    return value * 1000;
  }
  if (typeof value === 'string') {
    // 形如 "2026:11:06 12:29:05"（少数设备用 '-' 或只有日期部分）
    const m = value.trim().match(
      /^(\d{4})[:\-/](\d{2})[:\-/](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (!m) return null;
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = m;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
  }
  return null;
}

/** 真实时刻 → 墙上时间 epoch 毫秒（按本机时区取年月日时分秒） */
function toWallClockEpochMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );
}

function readExifWallClockEpochMs(filePath: string): number | null {
  try {
    const result = ExifParser.create(readFileSync(filePath)).parse();
    return (
      parseWallClockEpochMs(result.tags?.DateTimeOriginal) ??
      parseWallClockEpochMs(result.tags?.DateTime)
    );
  } catch {
    // EXIF 缺失 / 解析失败都不致命，交给 mtime 兜底
    return null;
  }
}

/**
 * 读取一张照片的拍摄时间（墙上时间口径）。
 *
 * ⚠️ 会整份读入文件（EXIF 在文件头，但 exif-parser 需要 Buffer）。逐张调用时请保持
 * 一次请求内的调用次数可控——目前 photos / find 两个接口都是每张照片各读一次。
 */
export function getPhotoTimestamps(filePath: string): PhotoTimestamps {
  const wallClock =
    readExifWallClockEpochMs(filePath) ?? toWallClockEpochMs(statSync(filePath).mtime.getTime());

  return {
    shotDate: new Date(wallClock).toISOString().slice(0, 10),
    shotTime: wallClock,
  };
}
