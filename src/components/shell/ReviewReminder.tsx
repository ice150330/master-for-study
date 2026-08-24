'use client';

import { useEffect } from 'react';

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * 到期提醒（优化方向 A4）：
 * - 标题徽标：有到期卡时在页面标题前显示 (N)；
 * - 浏览器通知：授权开启后，应用打开期间每日至多提醒一次（本地 Web 的边界——
 *   应用未打开时不产生系统级通知，这是明确的产品决策）。
 */
export function ReviewReminder() {
  useEffect(() => {
    let stopped = false;

    async function check() {
      let due = 0;
      try {
        const res = await fetch('/api/review?summary=1');
        if (!res.ok) return;
        const data = (await res.json()) as { summary?: { due?: number } };
        due = Number(data.summary?.due ?? 0);
      } catch {
        return;
      }
      if (stopped) return;

      // 以当前标题为基础去掉旧徽标再叠加，避免冻结路由标题
      const base = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = due > 0 ? `(${due}) ${base}` : base;

      if (due > 0 && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const dayKey = `mentor-review-notified-${new Date().toISOString().slice(0, 10)}`;
        try {
          if (localStorage.getItem(dayKey) !== '1') {
            new Notification('Mentor · 该复习了', {
              body: `有 ${due} 张记忆卡到期，趁热巩固一下。`,
              tag: 'mentor-review',
            });
            localStorage.setItem(dayKey, '1');
          }
        } catch {
          // 通知或存储不可用时静默降级为仅标题徽标
        }
      }
    }

    void check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.title = document.title.replace(/^\(\d+\)\s*/, '');
    };
  }, []);

  return null;
}
