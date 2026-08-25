'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import { NAV_SECTIONS, isNavActive, type NavItem } from '@/lib/nav';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';
import { saveCurrentRouteScrollPosition } from '@/components/context/RouteScrollRegion';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SidebarTools } from './ShellTools';
import { NAV_ICONS } from './nav-icons';

/**
 * 左缘胶带纸签轨：模块导航以八张撕裂胶带签**贴在页面（内容区）左缘**
 * （整窗即本子，见 .notebook-root；轨是悬浮在纸面上的覆盖列，不占内容流）。
 * 图标签右缘贴住页面边（页面已左移消除空隙）；**当前页签左缘对齐本子外缘、
 * 向右压在页面左留白带上悬浮**（页面留白让位，不盖主体内容），墨底 +
 * 黄影 + 常显全名。收起只露图标、悬停 / 聚焦整轨扇出页名。
 * 轨底工具段：工作区 / 搜索 / 设置 / 主题四条青色小胶带（2×2）。
 */
export function TapeRail({ onOpenSettings }: { onOpenSettings: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  /** 与原侧栏同款：跳转携带学习上下文并保存来源页滚动位置 */
  function navTo(item: NavItem) {
    return (event: React.MouseEvent) => {
      saveCurrentRouteScrollPosition();
      const context = parseLearningContext(new URLSearchParams(window.location.search));
      if (!context.conceptId && !context.source && !context.attempt && !context.workspaceId) return;
      event.preventDefault();
      router.push(withLearningContext(item.href, context));
    };
  }

  return (
    <nav
      aria-label="主导航"
      className="tape-rail pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-28 flex-col items-end gap-[3px] pb-[3.5rem] pt-3 md:flex"
    >
      {/* 品牌小标：本子左上角一枚手绘章 */}
      <span
        aria-hidden="true"
        className="doodle-action mb-2 flex size-8 rotate-[-1deg] items-center justify-center rounded-[2px] border-2 border-dashed border-foreground bg-card text-foreground"
      >
        <GraduationCap className="size-[17px]" />
      </span>
      {NAV_SECTIONS.map((section, sectionIndex) => (
        <RailGroup key={section.key} mark={sectionIndex > 0}>
          {section.items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={navTo(item)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={`rail-tape pointer-events-auto ${active ? 'rail-tape--current self-start' : ''}`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="rail-tape-label">{item.label}</span>
              </Link>
            );
          })}
        </RailGroup>
      ))}

      {/* 工具段：沉底，四条青色小胶带 2×2（贴本子左下角，不遮内容） */}
      <div className="mt-auto grid grid-cols-2 gap-[3px] self-start pb-1">
        <WorkspaceSwitcher tape />
        <SidebarTools onOpenSettings={onOpenSettings} vertical />
      </div>
    </nav>
  );
}

/** 分组容器：非首组上方垫虚线小刻度（四区降为视觉间隔）。display:contents 让签直接参与轨的 flex 布局。 */
function RailGroup({ mark, children }: { mark: boolean; children: ReactNode }) {
  return (
    <div className="contents">
      {mark ? <span aria-hidden="true" className="rail-tape-group-mark pointer-events-none" /> : null}
      {children}
    </div>
  );
}
