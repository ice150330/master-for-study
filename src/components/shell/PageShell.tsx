import type { ReactNode } from 'react';
import type { NavIconKey } from '@/lib/nav';
import { BookmarkBar } from './BookmarkBar';

/**
 * 模块页统一壳：索引标签书签页头（吸顶）+ 版心容器。
 * 页头由 BookmarkBar 渲染：当前页大标签 + 同组兄弟页小标签 +
 * 页头条（meta 统计 / filters 过滤 / actions 动作）；顶栏导航由 AppShell 提供。
 * 本组件无 hooks，服务端 / 客户端组件均可使用（BookmarkBar 是客户端子树）。
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
  /** 当前页的导航键（7 个模块页必填），驱动大标签与兄弟页标签 */
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
  return (
    <div
      className={`animate-page-enter mx-auto flex min-h-full w-full ${maxWidth} flex-col ${
        flush ? 'px-0 py-0' : 'px-4 py-4 md:px-6 md:py-5'
      }`}
    >
      <BookmarkBar pageKey={pageKey} title={title} meta={meta} filters={filters} actions={actions} />
      {children}
    </div>
  );
}
