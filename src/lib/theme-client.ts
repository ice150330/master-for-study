'use client';

import { useSyncExternalStore } from 'react';

const THEME_KEY = 'mentor-theme';
const THEME_EVENT = 'mentor-theme-change';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

export function useThemeMode(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
    () => 'light',
  );
}

export function setThemeMode(mode: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage 不可用时主题仅在当前页面生效
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
