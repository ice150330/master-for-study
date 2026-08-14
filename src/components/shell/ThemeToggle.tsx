'use client';

import { Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { setThemeMode, useThemeMode } from '@/lib/theme-client';

/**
 * 主题切换按钮：浅色（默认）/ 深色。
 * - 图标由 CSS（dark: 变体）决定，无客户端状态、无 hydration 问题
 * - 真实主题真相源是 <html> 上的 .dark 类（首帧由 layout 防闪脚本决定）
 * - 本组件只负责切换类与写 localStorage 持久化
 */

export function ThemeToggle() {
  const mode = useThemeMode();

  function toggle() {
    setThemeMode(mode === 'dark' ? 'light' : 'dark');
  }

  return (
    <IconButton
      onClick={toggle}
      label={mode === 'dark' ? '切换为浅色主题' : '切换为深色主题'}
      className="size-8 rounded-full"
    >
      {/* 浅色时显示月亮（点击去深色），深色时显示太阳（点击回浅色） */}
      <span className="dark:hidden">
        <Moon aria-hidden="true" className="size-4" />
      </span>
      <span className="hidden dark:inline">
        <Sun aria-hidden="true" className="size-4" />
      </span>
    </IconButton>
  );
}
