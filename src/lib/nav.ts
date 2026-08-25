/** 全局导航配置：今日、学习、测验、洞察四个任务区域。 */

export type AppRoute =
  | '/today'
  | '/'
  | '/notes'
  | '/resources'
  | '/interview'
  | '/review'
  | '/analytics'
  | '/whiteboard';

export type NavIconKey =
  | 'today'
  | 'chat'
  | 'notes'
  | 'resources'
  | 'interview'
  | 'review'
  | 'analytics'
  | 'whiteboard';

export type NavItem = {
  href: AppRoute;
  label: string;
  shortLabel: string;
  icon: NavIconKey;
};

export type NavSectionKey = 'today' | 'learn' | 'test' | 'insight';

export type NavSection = {
  key: NavSectionKey;
  label: string;
  shortLabel: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'today',
    label: '今日',
    shortLabel: '今日',
    items: [{ href: '/today', label: '今日学习', shortLabel: '今日', icon: 'today' }],
  },
  {
    key: 'learn',
    label: '学习',
    shortLabel: '学习',
    items: [
      { href: '/', label: '对话学习', shortLabel: '对话', icon: 'chat' },
      { href: '/notes', label: '学习笔记', shortLabel: '笔记', icon: 'notes' },
      { href: '/resources', label: '资源库', shortLabel: '资源', icon: 'resources' },
    ],
  },
  {
    key: 'test',
    label: '测验',
    shortLabel: '测验',
    items: [
      { href: '/interview', label: '模拟面试', shortLabel: '面试', icon: 'interview' },
      { href: '/review', label: '复习', shortLabel: '复习', icon: 'review' },
    ],
  },
  {
    key: 'insight',
    label: '洞察',
    shortLabel: '洞察',
    items: [
      { href: '/analytics', label: '成长分析', shortLabel: '分析', icon: 'analytics' },
      { href: '/whiteboard', label: '知识白板', shortLabel: '白板', icon: 'whiteboard' },
    ],
  },
];

export function isNavActive(pathname: string, href: AppRoute): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveSection(pathname: string): NavSection | null {
  return NAV_SECTIONS.find((section) =>
    section.items.some((item) => isNavActive(pathname, item.href)),
  ) ?? null;
}

export function findActiveItem(pathname: string): NavItem | null {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((candidate) => isNavActive(pathname, candidate.href));
    if (item) return item;
  }
  return null;
}

/** 索引标签页头用：按图标键反查条目与其所属分组（iconKey 与路由一一对应）。 */
export function findItemByKey(iconKey: NavIconKey): { section: NavSection; item: NavItem } | null {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((candidate) => candidate.icon === iconKey);
    if (item) return { section, item };
  }
  return null;
}
