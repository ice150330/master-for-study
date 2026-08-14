'use client';

import Link from 'next/link';
import { isNavActive, type NavItem } from '@/lib/nav';

/**
 * 组内子标签：下划线式 tabs，紧贴顶栏底边。
 * 仅当前路由属于某组时由 AppShell 渲染。
 */
export function SubTabs({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav className="flex h-full items-center gap-1">
      {items.map((it) => {
        const active = isNavActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex h-full items-center border-b-2 px-3 text-sm transition-colors ${
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
