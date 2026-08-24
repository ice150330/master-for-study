'use client';

import { Notebook, StickyNote } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { setThemeMode, useThemeMode } from '@/lib/theme-client';

/**
 * 手绘纸张切换：纸白 / 护眼暖纸。
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
      label={mode === 'dark' ? '切换为纸白' : '切换为暖纸'}
    >
      {/* 纸白时显示便签，暖纸时显示笔记本。 */}
      <span className="dark:hidden">
        <StickyNote aria-hidden="true" className="size-4" />
      </span>
      <span className="hidden dark:inline">
        <Notebook aria-hidden="true" className="size-4" />
      </span>
    </IconButton>
  );
}
