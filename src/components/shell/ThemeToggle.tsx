'use client';

import { Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

/**
 * 主题切换按钮：浅色（默认）/ 深色。
 * - 图标由 CSS（dark: 变体）决定，无客户端状态、无 hydration 问题
 * - 真实主题真相源是 <html> 上的 .dark 类（首帧由 layout 防闪脚本决定）
 * - 本组件只负责切换类与写 localStorage 持久化
 */

const THEME_KEY = 'mentor-theme';

export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // localStorage 不可用（隐私模式等）时静默降级，仅本次会话生效
    }
  }

  return (
    <IconButton
      onClick={toggle}
      label="切换浅色 / 深色主题"
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
