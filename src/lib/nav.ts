/**
 * 全局导航配置（纯数据）：学习 / 测验两大分组 + 全局工具入口。
 * 路由字面量集中收敛在此，供 AppShell 的胶囊与子标签复用（typed routes）。
 */

/** 应用页面路由字面量（与 src/app 目录一一对应）。 */
export type AppRoute =
  | '/'
  | '/notes'
  | '/resources'
  | '/practice'
  | '/interview'
  | '/review'
  | '/analytics'
  | '/whiteboard';

export type NavItem = { href: AppRoute; label: string };
export type NavGroupKey = 'learn' | 'test';

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  items: NavItem[];
};

/** 学习 / 测验两大分组（顶栏大胶囊内的两个小胶囊）。 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'learn',
    label: '学习',
    items: [
      { href: '/', label: '聊天' },
      { href: '/notes', label: '笔记' },
      { href: '/resources', label: '资源库' },
      { href: '/practice', label: '实践区' },
    ],
  },
  {
    key: 'test',
    label: '测验',
    items: [
      { href: '/interview', label: '模拟面试' },
      { href: '/review', label: '复习' },
    ],
  },
];

/** 全局工具（顶栏右侧独立入口，不属于学习/测验任何一组）。 */
export const TOOL_ITEMS: NavItem[] = [
  { href: '/analytics', label: '成长分析' },
  { href: '/whiteboard', label: '白板' },
];

/** 路由激活判断：首页全等，其余允许前缀匹配（为未来动态段预留）。 */
export function isNavActive(pathname: string, href: AppRoute): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
