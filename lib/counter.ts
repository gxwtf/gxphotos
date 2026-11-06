/**
 * 第三方计数器客户端（https://github.com/YangguangZhou/Counter）。
 *
 * 契约（官方 README）：
 * - `POST /api/counter` → JSON `{ "times": N }`，**并把本次请求计入**
 * - `POST /api/view`    → 同上，但不计入
 * - `GET  /counter?name=` → SVG 图片（给 <img> 用）
 *
 * 原实现（在 app/api/albums/[albumId]/route.ts 里）有两个问题：
 * 1. 打的是 `/api/counter`（返回 JSON），却用正则去匹配 SVG 的 `<text>` ——
 *    上游健康时也永远解析出 0；
 * 2. 上游超时/504 时，每次打开相册页都要白等 3 秒（`/api/albums/<id>` 是首屏
 *    关键路径），日志还每请求刷一行。
 *
 * 现在：JSON 优先、SVG 兜底；超时收到 1.5s；失败后进入 60s 冷却期，
 * 期间直接返回 0 不再去撞墙（上游恢复后最迟 60s 自动恢复）。
 */

export const DEFAULT_COUNTER_API = 'https://counter.jerryz.com.cn/api/counter';

/** 首屏不能被计数器拖住：上游正常时 <300ms 就回来，800ms 拿不到就当没有 */
export const COUNTER_TIMEOUT_MS = 800;
/** 上游故障后的冷却期 */
export const COUNTER_FAILURE_COOLDOWN_MS = 60_000;

let disabledUntil = 0;
let loggedFailure = false;

/** 仅用于测试/排障：清空冷却状态 */
export function resetCounterState(): void {
  disabledUntil = 0;
  loggedFailure = false;
}

/**
 * 从上游响应体里取出次数。
 * 主路径是 JSON `{ times: N }`；SVG（`<text>123</text>`）只是历史兜底。
 */
export function parseCounterPayload(text: string): number | null {
  try {
    const json = JSON.parse(text) as { times?: unknown };
    if (typeof json?.times === 'number' && Number.isFinite(json.times)) return json.times;
  } catch {
    // 不是 JSON，走 SVG 兜底
  }

  const match = text.match(/<text[^>]*>(\d+)<\/text>/);
  if (match) return parseInt(match[1], 10);

  return null;
}

export function isCounterCoolingDown(now = Date.now()): boolean {
  return now < disabledUntil;
}

export async function getViewCount(
  albumId: string,
  apiUrl: string = process.env.COUNTER_API || DEFAULT_COUNTER_API
): Promise<number> {
  if (isCounterCoolingDown()) return 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COUNTER_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: albumId }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const count = parseCounterPayload(await response.text());
    if (count === null) throw new Error('响应里没有 times 字段');

    loggedFailure = false;
    return count;
  } catch (error) {
    // 进入冷却期；只在"从健康转入故障"时打一行日志，避免刷屏
    disabledUntil = Date.now() + COUNTER_FAILURE_COOLDOWN_MS;
    if (!loggedFailure) {
      loggedFailure = true;
      console.error(
        `Counter 不可用，${COUNTER_FAILURE_COOLDOWN_MS / 1000}s 内不再重试（album=${albumId}）:`,
        error instanceof Error ? error.message : error
      );
    }
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}
