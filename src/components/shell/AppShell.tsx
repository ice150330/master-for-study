'use client';

import { Settings2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Suspense } from 'react';
import { NAV_SECTIONS, findActiveSection, type AppRoute, type NavSection } from '@/lib/nav';
import { cn } from '@/lib/cn';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';
import { ReviewReminder } from './ReviewReminder';
import { SettingsDialog } from './ShellTools';
import { TapeRail } from './TapeRail';
import { LearningContextBar } from '@/components/context/LearningContextBar';
import { RouteScrollRegion, saveCurrentRouteScrollPosition } from '@/components/context/RouteScrollRegion';
import { NAV_ICONS } from './nav-icons';

function lastPageKey(section: NavSection): string {
  return `mentor-nav:last:${section.key}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = findActiveSection(pathname);
  // 设置大弹窗：纸签轨工具段与移动端工具格共用一个实例
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!activeSection) return;
    try {
      localStorage.setItem(lastPageKey(activeSection), pathname);
    } catch {
      // localStorage 不可用时仅失去跨区域的上次访问记忆
    }
  }, [pathname, activeSection]);

  function switchSection(section: NavSection) {
    if (section.key === activeSection?.key) return;
    let target: AppRoute = section.items[0].href;
    try {
      const saved = localStorage.getItem(lastPageKey(section));
      if (saved && section.items.some((item) => item.href === saved)) target = saved as AppRoute;
    } catch {
      // 忽略不可用的本地记忆并回到区域默认页
    }
    saveCurrentRouteScrollPosition();
    router.push(contextualHref(target));
  }

  function contextualHref(target: string) {
    if (typeof window === 'undefined') return target;
    const context = parseLearningContext(new URLSearchParams(window.location.search));
    if (!context.conceptId && !context.source && !context.attempt && !context.workspaceId) return target;
    return withLearningContext(target, context);
  }

  return (
    <div className="relative isolate flex h-dvh min-w-0 overflow-hidden bg-transparent">
      <a
        href="#mentor-main"
        className="fixed left-3 top-3 z-[120] -translate-y-20 rounded-[2px] border-2 border-dashed border-foreground bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-[4px_4px_0_var(--marker-teal)] transition-transform focus:translate-y-0"
      >
        跳到主要内容
      </a>

      {/* 左缘胶带纸签轨：模块导航（八页常显）+ 轨底工具段，替代原左侧导航栏 */}
      <TapeRail onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 到期提醒：标题徽标 + 浏览器通知（A4），无界面输出 */}
        <ReviewReminder />
        <Suspense fallback={<main className="min-h-0 min-w-0 flex-1 overflow-y-auto" />}>
          <RouteScrollRegion>{children}</RouteScrollRegion>
        </Suspense>
        {/* 学习上下文条：常驻页底，显示工作区 / 来源 / 概念 / 当前位置 */}
        <Suspense fallback={null}><LearningContextBar /></Suspense>
      </div>

      <nav
        aria-label="移动端区域导航"
        className="paper-control fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-dashed px-2 md:hidden"
      >
        {NAV_SECTIONS.map((section) => {
          const item = section.items[0];
          const Icon = NAV_ICONS[item.icon];
          const active = section.key === activeSection?.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => switchSection(section)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted',
                active && 'text-foreground underline decoration-wavy decoration-primary decoration-2 underline-offset-4',
              )}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span>{section.shortLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted"
        >
          <Settings2 aria-hidden="true" className="size-[18px]" />
          <span>工具</span>
        </button>
      </nav>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
