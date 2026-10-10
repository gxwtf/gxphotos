#!/usr/bin/env node
/**
 * 构建前增量生成 WebP 缩略图。
 *
 * 用法：
 *   node scripts/generate-thumbnails.mjs          # 增量（默认，构建时自动执行）
 *   node scripts/generate-thumbnails.mjs --force  # 忽略 mtime，全部重新生成
 *
 * 输入：PHOTOS_DIR（环境变量，绝对路径；缺省 <项目>/photos_data），只扫一层相册目录，
 *       与 app/api/albums/[albumId]/photos/route.ts 的遍历口径完全一致。
 * 输出：public/thumbs/<albumId>/<原文件名>.webp
 *       URL 映射见 lib/photo-url.ts 的 toThumbUrl()，两处必须保持一致。
 *
 * 设计约束：
 * - 增量：目标存在且 mtime >= 原图 mtime 即跳过（后续构建几乎零成本）
 * - 并发 4：避免一次性解码大量原图把内存打爆
 * - 不中断构建：单张失败只统计 + 告警，进程始终以 0 退出
 */
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 读取项目根的 .env（不覆盖已存在的环境变量）。
 * `next build` 会自己加载 .env，但本脚本在它之前独立运行，必须自己加载，
 * 否则生产构建时 PHOTOS_DIR 会退回默认的 <项目>/photos_data，缩略图被静默跳过。
 */
function loadDotEnv() {
  let text;
  try {
    text = readFileSync(path.join(ROOT, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const PHOTOS_DIR = process.env.PHOTOS_DIR?.trim()
  ? path.resolve(process.env.PHOTOS_DIR.trim())
  : path.join(ROOT, 'photos_data');
const THUMBS_DIR = path.join(ROOT, 'public', 'thumbs');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const WIDTH = 640;
const HEIGHT = 640;
const QUALITY = 75;
const CONCURRENCY = 4;
const FORCE = process.argv.includes('--force');

/** 列出所有待处理任务；原图目录不存在时返回 null */
async function listJobs() {
  let albums;
  try {
    albums = await fs.readdir(PHOTOS_DIR, { withFileTypes: true });
  } catch {
    return null;
  }

  const jobs = [];
  for (const album of albums) {
    if (!album.isDirectory()) continue;
    const albumDir = path.join(PHOTOS_DIR, album.name);
    let entries;
    try {
      entries = await fs.readdir(albumDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      jobs.push({
        album: album.name,
        src: path.join(albumDir, entry.name),
        srcName: entry.name,
        dest: path.join(THUMBS_DIR, album.name, `${entry.name}.webp`),
      });
    }
  }
  return jobs;
}

async function main() {
  const jobs = await listJobs();
  if (jobs === null) {
    console.warn(`[thumbnails] 跳过：原图目录不存在 (${PHOTOS_DIR})`);
    console.warn(
      '[thumbnails] 生产请在 .env 里设置 PHOTOS_DIR 指向项目外的照片库；' +
        '开发期可把少量样图放进 <项目>/photos_data/'
    );
    return;
  }

  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch (err) {
    console.warn(`[thumbnails] 跳过：无法加载 sharp (${err.message})，请先执行 pnpm install`);
    return;
  }

  const stats = { generated: 0, skipped: 0, failed: 0 };
  const queue = [...jobs];
  let done = 0;

  async function worker() {
    for (;;) {
      const job = queue.shift();
      if (!job) return;
      try {
        if (!FORCE) {
          const [srcStat, destStat] = await Promise.all([
            fs.stat(job.src),
            fs.stat(job.dest).catch(() => null),
          ]);
          if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) {
            stats.skipped++;
            continue;
          }
        }

        await fs.mkdir(path.dirname(job.dest), { recursive: true });
        await sharp(job.src)
          .rotate() // 按 EXIF 方向摆正
          .resize({ width: WIDTH, height: HEIGHT, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(job.dest);
        stats.generated++;
      } catch (err) {
        stats.failed++;
        console.warn(`[thumbnails] 失败 ${job.album}/${job.srcName}: ${err.message}`);
      } finally {
        done++;
        if (done % 2000 === 0) console.log(`[thumbnails] 进度 ${done}/${jobs.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const failedNote = stats.failed > 0 ? `  ⚠️ ${stats.failed} 张失败（不中断构建，详见上方日志）` : '';
  console.log(
    `[thumbnails] 原图 ${PHOTOS_DIR}\n` +
      `[thumbnails] 共 ${jobs.length} 张：生成 ${stats.generated}，跳过 ${stats.skipped}，失败 ${stats.failed}${failedNote}`
  );
}

main().catch((err) => {
  // 缩略图是优化项，绝不因为它的意外错误中断构建
  console.warn(`[thumbnails] 未预期错误（已忽略，不中断构建）：${err?.stack || err}`);
});
