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
 * 左缘胶带纸签轨：替代原左侧导航栏的模块导航。八张撕裂胶带签沿内容
 * 左缘竖向堆叠（渲染区外独立轨列），收起只露图标、悬停 / 聚焦整轨扇出
 * 页名；当前页签墨底 + 黄错位影 + 常显全名。四区降为虚线小刻度。
 * 轨底工具段：工作区切换 / 搜索 / 设置 / 主题（与导航签隔开）。
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
      className="paper-control tape-rail relative z-20 hidden shrink-0 flex-col items-start border-r border-dashed pb-3 pl-2 pr-3 pt-3 md:flex"
    >
      {/* 品牌小标：原侧栏徽标收成轨顶一枚手绘章 */}
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
                className={`rail-tape ${active ? 'rail-tape--current' : ''}`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="rail-tape-label">{item.label}</span>
              </Link>
            );
          })}
        </RailGroup>
      ))}

      {/* 工具段：沉底，与导航签隔虚线 */}
      <div className="mt-auto flex w-full flex-col items-center gap-0.5 border-t border-dashed pt-3">
        <WorkspaceSwitcher />
        <SidebarTools onOpenSettings={onOpenSettings} vertical />
      </div>
    </nav>
  );
}

/** 分组容器：非首组上方垫虚线小刻度（四区降为视觉间隔）。display:contents 让签直接参与轨的 flex 布局。 */
function RailGroup({ mark, children }: { mark: boolean; children: ReactNode }) {
  return (
    <div className="contents">
      {mark ? <span aria-hidden="true" className="rail-tape-group-mark" /> : null}
      {children}
    </div>
  );
}
