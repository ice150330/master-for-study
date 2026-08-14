'use client';

import type { NavGroup, NavGroupKey } from '@/lib/nav';

/**
 * 大胶囊：包裹「学习 / 测验」两个小胶囊的 segmented control。
 * 激活小胶囊 = 卡片色浮起（bg-card + 卡上文字色），未激活 = 弱化文字。
 */
export function GroupPill({
  groups,
  activeKey,
  onSelect,
}: {
  groups: NavGroup[];
  activeKey: NavGroupKey | null;
  onSelect: (group: NavGroup) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface p-1">
      {groups.map((g) => {
        const active = g.key === activeKey;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onSelect(g)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {g.key === 'learn' ? <BookIcon /> : <ClipboardIcon />}
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

/** 学习组图标：翻开的书 */
function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/** 测验组图标：带勾的题板 */
function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  );
}
