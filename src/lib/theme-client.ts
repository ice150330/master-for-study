'use client';

import { useSyncExternalStore } from 'react';

const THEME_KEY = 'mentor-theme';
const THEME_EVENT = 'mentor-theme-change';

/** 四种内置纸张主题：纸白（默认）/ 暖纸 / 青蓝 / 夜墨（唯一深色）。 */
export type ThemeMode = 'paper' | 'warm' | 'blueprint' | 'night';

export const THEME_MODES: Array<{ value: ThemeMode; label: string; swatch: string }> = [
  { value: 'paper', label: '纸白', swatch: '#fffef5' },
  { value: 'warm', label: '暖纸', swatch: '#f7f2df' },
  { value: 'blueprint', label: '青蓝', swatch: '#dfe9f2' },
  { value: 'night', label: '夜墨', swatch: '#1e211f' },
];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'paper' || value === 'warm' || value === 'blueprint' || value === 'night';
}

/** 旧值迁移：light → paper，dark → warm（2026-08-25 前的双主题存量）。 */
function normalizeStored(value: string | null): ThemeMode {
  if (value === 'light') return 'paper';
  if (value === 'dark') return 'warm';
  return isThemeMode(value) ? value : 'paper';
}

export function readStoredTheme(): ThemeMode {
  try {
    return normalizeStored(localStorage.getItem(THEME_KEY));
  } catch {
    return 'paper';
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

/** 快照直接读 data-theme（首帧由 layout 防闪脚本写入），返回原始值引用稳定。 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    subscribe,
    () => {
      const current = document.documentElement.getAttribute('data-theme');
      return isThemeMode(current) ? current : 'paper';
    },
    () => 'paper',
  );
}

export function setThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  if (mode === 'paper') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode === 'night' ? 'dark' : 'light';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage 不可用时主题仅在当前页面生效
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
