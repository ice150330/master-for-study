'use client';

import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Library,
  MessageCircle,
  Network,
  NotebookText,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Suspense } from 'react';
import {
  NAV_SECTIONS,
  findActiveSection,
  isNavActive,
  type AppRoute,
  type NavIconKey,
  type NavSection,
} from '@/lib/nav';
import { cn } from '@/lib/cn';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { ReviewReminder } from './ReviewReminder';
import { SettingsDialog, SidebarTools } from './ShellTools';
import { LearningContextBar } from '@/components/context/LearningContextBar';
import { RouteScrollRegion, saveCurrentRouteScrollPosition } from '@/components/context/RouteScrollRegion';

const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  today: CalendarDays,
  chat: MessageCircle,
  notes: NotebookText,
  resources: Library,
  interview: ClipboardCheck,
  review: BookOpenText,
  analytics: BarChart3,
  whiteboard: Network,
};

function lastPageKey(section: NavSection): string {
  return `mentor-nav:last:${section.key}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = findActiveSection(pathname);
  // 设置大弹窗：侧边栏工具与移动端工具格共用一个实例
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
      <aside className="paper-control relative z-20 hidden w-14 shrink-0 flex-col border-r border-dashed md:flex min-[1180px]:w-[196px]">
        <div className="flex h-[52px] shrink-0 items-center border-b border-dashed border-border px-2.5 min-[1180px]:px-3">
          <div className="doodle-action flex size-8 shrink-0 rotate-[-1deg] items-center justify-center rounded-[2px] border-2 border-dashed border-foreground bg-card text-foreground">
            <GraduationCap aria-hidden="true" className="size-[17px]" />
          </div>
          <div className="ml-2.5 hidden min-w-0 min-[1180px]:block">
            <p className="marker-highlight inline text-[13px] font-extrabold text-foreground">Mentor</p>
            <p className="truncate text-[10px] text-muted">本地学习工作台</p>
          </div>
        </div>

        <nav aria-label="主导航" className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.key}
              className={cn(sectionIndex > 0 && 'mt-2.5 border-t border-dashed border-border pt-2.5')}
            >
              <p className="mb-1 hidden px-2 text-[10px] font-medium text-muted min-[1180px]:block">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = NAV_ICONS[item.icon];
                  const link = (
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        saveCurrentRouteScrollPosition();
                        const target = contextualHref(item.href);
                        if (target === item.href) return;
                        event.preventDefault();
                        router.push(target);
                      }}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-8 items-center justify-center overflow-visible rounded-[2px] border border-dashed border-transparent transition-[transform,box-shadow,background-color,color,border-color] duration-150 hover:-translate-x-px hover:-translate-y-px min-[1180px]:justify-start min-[1180px]:gap-2.5 min-[1180px]:px-2.5',
                        active
                          ? 'rotate-[-0.35deg] border-foreground bg-foreground text-background shadow-[3px_3px_0_var(--marker-yellow)] hover:bg-foreground hover:text-background'
                          : 'text-muted hover:border-accent/65 hover:bg-accent/10 hover:text-foreground',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="hidden truncate text-[13px] font-medium min-[1180px]:block">
                        {item.label}
                      </span>
                    </Link>
                  );
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right" className="min-[1180px]:hidden">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 工具下沉：工作区切换 + 搜索 / 设置 / 主题（顶栏移除后的唯一全局工具位） */}
        <div className="shrink-0 space-y-1 border-t border-dashed border-border px-2 py-2.5">
          <SidebarTools onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </aside>

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
