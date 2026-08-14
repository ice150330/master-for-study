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
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  NAV_SECTIONS,
  findActiveItem,
  findActiveSection,
  isNavActive,
  type AppRoute,
  type NavIconKey,
  type NavSection,
} from '@/lib/nav';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { ShellTools } from './ShellTools';

const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  today: CalendarDays,
  chat: MessageCircle,
  notes: NotebookText,
  resources: Library,
  practice: SquareTerminal,
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
  const activeItem = findActiveItem(pathname);

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
    router.push(target);
  }

  return (
    <div className="flex h-dvh min-w-0 bg-background">
      <aside className="hidden w-16 shrink-0 flex-col border-r border-border bg-card md:flex min-[1180px]:w-56">
        <div className="flex h-16 shrink-0 items-center border-b border-border px-3 min-[1180px]:px-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <GraduationCap aria-hidden="true" className="size-5" />
          </div>
          <div className="ml-3 hidden min-w-0 min-[1180px]:block">
            <p className="text-sm font-semibold text-foreground">Mentor</p>
            <p className="truncate text-[11px] text-muted">私人学习工作台</p>
          </div>
        </div>

        <nav aria-label="主导航" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div
              key={section.key}
              className={cn(sectionIndex > 0 && 'mt-4 border-t border-border pt-4')}
            >
              <p className="mb-1 hidden px-2 text-[11px] font-medium text-muted min-[1180px]:block">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = NAV_ICONS[item.icon];
                  const link = (
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-10 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground min-[1180px]:justify-start min-[1180px]:gap-3 min-[1180px]:px-3',
                        active && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                      <span className="hidden truncate text-sm font-medium min-[1180px]:block">
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

      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:h-16 md:px-5">
          <div className="min-w-0 flex-1">
            <p className="hidden text-[11px] text-muted md:block">
              {activeSection?.label ?? 'Mentor'}
            </p>
            <p
              data-testid="page-context-title"
              className="truncate text-sm font-semibold text-foreground md:mt-0.5"
            >
              {activeItem?.label ?? (pathname.startsWith('/dev/') ? '开发视图' : '学习工作台')}
            </p>
          </div>
          <ShellTools />
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      <nav
        aria-label="移动端区域导航"
        className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-border bg-card/95 px-2 backdrop-blur md:hidden"
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
                active && 'text-primary',
              )}
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span>{section.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
