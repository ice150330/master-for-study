'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';
import { findItemByKey, type NavIconKey, type NavItem } from '@/lib/nav';
import { saveCurrentRouteScrollPosition } from '@/components/context/RouteScrollRegion';
import { NAV_ICONS } from './nav-icons';

/**
 * 索引标签书签页头（吸顶）：面板顶缘一排索引书签——当前页大号填充标签 +
 * 同导航组兄弟页小号标签（点击带学习上下文跳转）；标签下是页头条，
 * 左侧红竖条与统计 chips，右侧过滤与动作。随滚动吸顶常驻可见。
 * pageKey 走导航分组；title 为无导航页（如 /dev/ui 演示页）的直排模式。
 */
export function BookmarkBar({
  pageKey,
  title,
  meta,
  filters,
  actions,
}: {
  pageKey?: NavIconKey;
  /** 无 pageKey 时的直排标题（演示页等非导航页用） */
  title?: string;
  /** 页头条左侧统计 chips（MetaChip 组合） */
  meta?: ReactNode;
  /** 过滤控件（SegmentedControl / Select） */
  filters?: ReactNode;
  /** 页头条右侧动作按钮 */
  actions?: ReactNode;
}) {
  const found = pageKey ? findItemByKey(pageKey) : null;
  const current: NavItem | null = found?.item ?? null;
  const siblings = found ? found.section.items.filter((item) => item.icon !== pageKey) : [];
  const CurrentIcon = current ? NAV_ICONS[current.icon] : null;
  const label = current?.label ?? title ?? '';

  return (
    <div className="sticky top-0 z-30 shrink-0 bg-[var(--background)] pb-3">
      {/* 索引标签排：当前页大标签与页头条缝合，兄弟页小标签可点跳转 */}
      <nav
        aria-label={found ? `${found.section.label}组页面` : '页面导航'}
        className="flex items-end gap-1 overflow-x-auto px-0.5"
      >
        <span
          className={cn(
            'relative z-[1] -mb-px inline-flex shrink-0 rotate-[-0.35deg] items-center gap-1.5 rounded-t-[2px] border-2 border-b-0 border-dashed border-foreground bg-foreground px-3 py-1.5 text-sm font-extrabold text-background shadow-[3px_0_0_var(--marker-yellow)]',
          )}
        >
          {CurrentIcon ? <CurrentIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
          <h1 data-testid="page-context-title" className="whitespace-nowrap">
            {label}
          </h1>
        </span>
        {siblings.map((sibling) => (
          <SiblingTab key={sibling.href} item={sibling} />
        ))}
      </nav>

      {/* 页头条：左侧红竖条 + 统计 chips，右侧过滤与动作（无内容时只留竖条） */}
      <header className="paper-panel flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-t-none border-2 border-dashed px-3.5 py-2">
        <span
          aria-hidden="true"
          className="h-5 w-1 shrink-0 rotate-1 bg-primary shadow-[2px_0_0_var(--marker-yellow)]"
        />
        {meta ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{meta}</div> : <div className="min-w-0 flex-1" />}
        {filters || actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {filters}
            {actions}
          </div>
        ) : null}
      </header>
    </div>
  );
}

/** 兄弟页小标签：虚线纸签，点击带学习上下文跳转（与 AppShell 导航同款行为）。 */
function SiblingTab({ item }: { item: NavItem }) {
  const router = useRouter();
  const Icon = NAV_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      onClick={(event) => {
        saveCurrentRouteScrollPosition();
        const context = parseLearningContext(new URLSearchParams(window.location.search));
        if (!context.conceptId && !context.source && !context.attempt && !context.workspaceId) return;
        event.preventDefault();
        router.push(withLearningContext(item.href, context));
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-t-[2px] border border-b-0 border-dashed border-transparent bg-card/55 px-2.5 py-1 text-xs font-medium text-muted transition-[transform,border-color,background-color,color] duration-150 hover:-rotate-1 hover:border-accent/65 hover:bg-accent/10 hover:text-foreground"
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}
