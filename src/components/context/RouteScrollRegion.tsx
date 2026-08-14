'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { contextFocusRef, parseLearningContext } from '@/lib/learning-context';

const SCROLL_PREFIX = 'mentor-scroll:';
const SAVE_DELAY_MS = 80;

/** 链接导航前同步保存，避免 App Router 复用容器时把目标页的归零写回来源页。 */
export function saveCurrentRouteScrollPosition() {
  const container = document.querySelector<HTMLElement>('[data-testid="route-scroll-region"]');
  if (!container) return;
  const routeKey = `${window.location.pathname}${window.location.search}`;
  sessionStorage.setItem(`${SCROLL_PREFIX}${routeKey}`, String(container.scrollTop));
}

/** App Router 只恢复 window；学习工作台的滚动容器需要按完整 URL 单独恢复。 */
export function RouteScrollRegion({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const serialized = searchParams.toString();
  const routeKey = `${pathname}${serialized ? `?${serialized}` : ''}`;
  const focusRef = contextFocusRef(parseLearningContext(searchParams));

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const storageKey = `${SCROLL_PREFIX}${routeKey}`;
    const stored = sessionStorage.getItem(storageKey);
    let restoreFrame = 0;
    let restoreTimer = 0;
    let saveTimer = 0;
    window.history.scrollRestoration = 'manual';
    const restoreTop = stored ? Number(stored) || 0 : 0;
    restoreFrame = requestAnimationFrame(() => {
      container.scrollTop = restoreTop;
      if (stored) restoreFrame = requestAnimationFrame(() => { container.scrollTop = restoreTop; });
    });
    if (stored) restoreTimer = window.setTimeout(() => { container.scrollTop = restoreTop; }, 80);

    const save = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        sessionStorage.setItem(storageKey, String(container.scrollTop));
      }, SAVE_DELAY_MS);
    };
    container.addEventListener('scroll', save, { passive: true });

    if (!stored) {
      if (focusRef) {
        const focus = () => focusContextTarget(container, focusRef);
        requestAnimationFrame(focus);
        const delayed = window.setTimeout(focus, 260);
        return () => {
          container.removeEventListener('scroll', save);
          cancelAnimationFrame(restoreFrame);
          window.clearTimeout(restoreTimer);
          window.clearTimeout(saveTimer);
          window.clearTimeout(delayed);
        };
      }
    }
    return () => {
      container.removeEventListener('scroll', save);
      cancelAnimationFrame(restoreFrame);
      window.clearTimeout(restoreTimer);
      window.clearTimeout(saveTimer);
    };
  }, [focusRef, routeKey]);

  return (
    <main
      ref={mainRef}
      data-testid="route-scroll-region"
      onClickCapture={saveCurrentRouteScrollPosition}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0"
    >
      {children}
    </main>
  );
}

function focusContextTarget(container: HTMLElement, focusRef: string) {
  const target = container.querySelector<HTMLElement>(`[data-context-focus="${CSS.escape(focusRef)}"]`);
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'auto' });
  target.focus({ preventScroll: true });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.animate(
      [
        { boxShadow: '0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
        { boxShadow: '0 0 0 3px color-mix(in srgb, var(--primary) 32%, transparent)' },
        { boxShadow: '0 0 0 0 color-mix(in srgb, var(--primary) 0%, transparent)' },
      ],
      { duration: 720, easing: 'ease-out' },
    );
  }
}
