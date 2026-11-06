'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * 主题（深色/浅色）提供者。
 *
 * 默认跟随系统（`system`），并用 class 策略（`.dark`）驱动 Tailwind 的
 * `dark:` 变体（见 app/globals.css 里的 `@custom-variant dark`）。
 * `next-themes` 会在页面里注入一段阻塞脚本，在首屏渲染前就把 class 写好，
 * 避免刷新时先白后黑闪一下。
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
