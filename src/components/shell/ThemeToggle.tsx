'use client';

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
    <button
      type="button"
      onClick={toggle}
      aria-label="切换浅色 / 深色主题"
      title="切换浅色 / 深色主题"
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-card-foreground"
    >
      {/* 浅色时显示月亮（点击去深色），深色时显示太阳（点击回浅色） */}
      <span className="dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:inline">
        <SunIcon />
      </span>
    </button>
  );
}

/** 太阳（当前深色，点击回浅色） */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

/** 月亮（当前浅色，点击去深色） */
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
