import { promises as fs, statSync } from 'fs';
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

async function readExifWallClockEpochMs(filePath: string): Promise<number | null> {
  try {
    const buffer = await fs.readFile(filePath);
    const result = ExifParser.create(buffer).parse();
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
 * 进程内时间缓存：key = 绝对路径，value 附带 size + mtimeMs 作为失效判据。
 *
 * 为什么需要：取 EXIF 得把**整份原图**读进内存（exif-parser 只吃完整 Buffer），
 * 大相册一次请求就是几百张到几千张、几个 GB 的读盘 —— 新疆和田（1034 张）冷启动
 * 5 秒、河西走廊（4033 张）2.5 秒，全是重复劳动：照片不变，EXIF 也不变。
 * 用 size + mtime 做校验后，照片被替换/重新拷贝会自动失效重算。
 */
interface CacheEntry {
  size: number;
  mtimeMs: number;
  shotDate: string;
  shotTime: number;
}

const CACHE_MAX_ENTRIES = 50_000;
const cache = new Map<string, CacheEntry>();

function rememberEntry(filePath: string, entry: CacheEntry): void {
  cache.set(filePath, entry);

  // Map 保留插入顺序：超限时从最久未写入的条目开始淘汰（近似 FIFO，足够用）
  if (cache.size > CACHE_MAX_ENTRIES) {
    const overflow = cache.size - CACHE_MAX_ENTRIES;
    let removed = 0;
    for (const key of cache.keys()) {
      cache.delete(key);
      if (++removed >= overflow) break;
    }
  }
}

/** 清空缓存（调试用；生产无调用方） */
export function clearPhotoTimestampCache(): void {
  cache.clear();
}

/**
 * 读取一张照片的拍摄时间（墙上时间口径），带进程内缓存。
 *
 * 读取是异步的：photos 接口会对整张相册并发调度（见 CONCURRENCY），
 * 同步 readFileSync 会把并发退化成串行。
 */
export async function getPhotoTimestamps(filePath: string): Promise<PhotoTimestamps> {
  const stat = statSync(filePath);
  const cached = cache.get(filePath);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
    return { shotDate: cached.shotDate, shotTime: cached.shotTime };
  }

  const wallClock =
    (await readExifWallClockEpochMs(filePath)) ?? toWallClockEpochMs(stat.mtime.getTime());

  const entry: CacheEntry = {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    shotDate: new Date(wallClock).toISOString().slice(0, 10),
    shotTime: wallClock,
  };
  rememberEntry(filePath, entry);

  return { shotDate: entry.shotDate, shotTime: entry.shotTime };
}
