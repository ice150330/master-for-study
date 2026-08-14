'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { NAV_GROUPS, TOOL_ITEMS, isNavActive, type AppRoute, type NavGroup } from '@/lib/nav';
import { GroupPill } from './GroupPill';
import { SubTabs } from './SubTabs';
import { ThemeToggle } from './ThemeToggle';

/**
 * 全局应用壳：顶栏（品牌 + 学习/测验大胶囊 + 组内子标签 + 全局工具 + 主题切换）
 * 与单滚动内容区。跨组切换时回到该组上次访问的页面（localStorage 记忆）。
 */

/** 每组「上次访问页」的 localStorage key。 */
function lastPageKey(group: NavGroup): string {
  return `mentor-nav:last:${group.key}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // 当前激活组（工具页不属于任何组 → 无激活小胶囊、不显示子标签）
  const activeGroup =
    NAV_GROUPS.find((g) => g.items.some((it) => isNavActive(pathname, it.href))) ?? null;

  // 记录当前组最后访问页（副作用写入，渲染期不读 localStorage）
  useEffect(() => {
    if (!activeGroup) return;
    try {
      localStorage.setItem(lastPageKey(activeGroup), pathname);
    } catch {
      // localStorage 不可用时静默降级
    }
  }, [pathname, activeGroup]);

  function switchGroup(group: NavGroup) {
    if (group.key === activeGroup?.key) return;
    let target: AppRoute = group.items[0].href;
    try {
      const saved = localStorage.getItem(lastPageKey(group));
      // 只采纳确实属于该组的记忆路由，避免脏数据
      if (saved && group.items.some((it) => it.href === saved)) target = saved as AppRoute;
    } catch {
      // 忽略，走默认组首页
    }
    router.push(target);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur">
        {/* 品牌 */}
        <span className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          Mentor
        </span>

        {/* 大胶囊：学习 | 测验 */}
        <GroupPill groups={NAV_GROUPS} activeKey={activeGroup?.key ?? null} onSelect={switchGroup} />

        {/* 组内子标签（仅组页显示） */}
        {activeGroup ? <SubTabs items={activeGroup.items} pathname={pathname} /> : null}

        <div className="min-w-0 flex-1" />

        {/* 全局工具 + 主题切换 */}
        <nav className="flex shrink-0 items-center gap-1">
          {TOOL_ITEMS.map((t) => {
            const active = isNavActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-surface text-foreground'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                {t.href === '/analytics' ? <ChartIcon /> : <BoardIcon />}
                {t.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </header>

      {/* 单滚动内容区：模块页自身滚动；聊天页内部按卡片堆布局管理 */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

/** 成长分析图标：柱状图 */
function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </svg>
  );
}

/** 白板图标：分栏画板 */
function BoardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
