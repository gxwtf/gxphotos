'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 点击一次切到下一种：跟随系统 → 浅色 → 深色 → 跟随系统 */
const ORDER = ['system', 'light', 'dark'] as const;

type ThemeChoice = (typeof ORDER)[number];

const LABELS: Record<ThemeChoice, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
};

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

/**
 * 是否已经在前端跑起来了。
 *
 * 服务端渲染时返回 false，客户端 hydrate 完成后返回 true —— 用
 * useSyncExternalStore 而不是「useState + useEffect 里 setMounted(true)」，
 * 既能保证首屏与 SSR 标记一致，也不触发 react-hooks/set-state-in-effect。
 */
const subscribeNoop = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

/**
 * 外观切换按钮。
 *
 * 默认是「跟随系统」，用户点一下可以临时覆盖成浅色/深色，再点回到跟随系统。
 * 服务端渲染时一律先按「跟随系统」渲染（此时还不知道用户的系统偏好），
 * 挂载后再换成真实的当前项，避免 hydration 不一致。
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current: ThemeChoice =
    mounted && ORDER.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = mounted ? ICONS[current] : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={() => setTheme(next)}
      title={`外观：${LABELS[current]}（点击切换到「${LABELS[next]}」）`}
      aria-label={`外观：${LABELS[current]}，点击切换到${LABELS[next]}`}
    >
      <Icon className="size-5" />
    </Button>
  );
}
