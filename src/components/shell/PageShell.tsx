import type { ReactNode } from 'react';
import { findItemByKey, type NavIconKey } from '@/lib/nav';
import { NAV_ICONS } from './nav-icons';

/**
 * 模块页统一壳：吸顶页头条 + 版心容器。
 * 模块导航由左侧胶带纸签轨（TapeRail，AppShell 提供）承担；页头条只承载
 * 本页信息——左红竖条 + 模块标题（pageKey 反查图标与页名）+ meta 统计，
 * 右 filters 过滤与 actions 动作，随滚动吸顶常驻。
 * 无 hooks，服务端 / 客户端组件均可使用。
 */
export function PageShell({
  pageKey,
  title,
  meta,
  actions,
  filters,
  width = 'md',
  flush = false,
  children,
}: {
  /** 当前页的导航键（7 个模块页必填），反查图标与页名 */
  pageKey?: NavIconKey;
  /** 无 pageKey 的直排标题（/dev/ui 演示页等非导航页用） */
  title?: string;
  /** 页头条左侧统计 chips */
  meta?: ReactNode;
  /** 页头条右侧动作按钮 */
  actions?: ReactNode;
  /** 页头条过滤控件（SegmentedControl / Select） */
  filters?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  flush?: boolean;
  children: ReactNode;
}) {
  const maxWidth =
    width === 'sm'
      ? 'max-w-2xl'
      : width === 'lg'
        ? 'max-w-5xl'
        : width === 'xl'
          ? 'max-w-7xl'
          : 'max-w-3xl';
  const found = pageKey ? findItemByKey(pageKey) : null;
  const HeadIcon = found ? NAV_ICONS[found.item.icon] : null;
  const label = found?.item.label ?? title ?? '';

  return (
    <div
      className={`animate-page-enter mx-auto flex min-h-full w-full ${maxWidth} flex-col ${
        flush ? 'px-0 py-0' : 'px-4 py-4 md:px-6 md:py-5'
      }`}
    >
      <header className="sticky top-0 z-30 shrink-0 pb-3">
        {/* 整窗即本子：页头条是贴在本子上的一条不透明纸带（吸顶时遮住滚过的横线） */}
        <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-dashed border-[color-mix(in_srgb,var(--foreground)_38%,transparent)] bg-card px-3.5 py-2 shadow-[0_3px_0_rgba(44,44,44,0.07)]">
          <span
            aria-hidden="true"
            className="h-5 w-1 shrink-0 rotate-1 bg-primary shadow-[2px_0_0_var(--marker-yellow)]"
          />
          {HeadIcon ? <HeadIcon aria-hidden="true" className="size-4 shrink-0 text-muted" /> : null}
          <h1
            data-testid="page-context-title"
            className="shrink-0 truncate text-sm font-extrabold text-foreground"
          >
            {label}
          </h1>
          {meta ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{meta}</div> : <div className="min-w-0 flex-1" />}
          {filters || actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {filters}
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );
}
