'use client';

import type { CSSProperties } from 'react';
import { CornerDownRight, CornerUpLeft, Layers3 } from 'lucide-react';
import type { ChatSession } from './chat-types';

/** 每侧最多直接可见的纸签数，超出收进树抽屉 */
const MAX_VISIBLE = 3;

/**
 * 会话纸签（替代旧实体卡堆叠）：
 * 父级贴在当前卡左缘、从顶部往下排；子分支贴右缘、从底部往上排。
 * 越靠上游越向外探出，形成"深度"暗示；主卡不再为堆叠预留任何尺寸。
 * 点击纸签直接切换；超出上限的层级经「+N」进入会话树抽屉。
 */
export function SessionTabs({
  ancestors,
  branches,
  onSelect,
  onOpenTree,
}: {
  /** 由近到远：[父, 祖父, …] */
  ancestors: ChatSession[];
  branches: ChatSession[];
  onSelect: (id: string) => void;
  onOpenTree: () => void;
}) {
  if (ancestors.length === 0 && branches.length === 0) return null;

  const ancestorLayers = ancestors.slice(0, MAX_VISIBLE);
  const ancestorOverflow = ancestors.length - ancestorLayers.length;
  const branchLayers = branches.slice(0, MAX_VISIBLE);
  const branchOverflow = branches.length - branchLayers.length;

  return (
    <>
      {/* 父级纸签：左缘，越上游越向外探出 */}
      {ancestorLayers.map((session, index) => (
        <PaperTab
          key={session.id}
          side="ancestor"
          index={index}
          icon={<CornerUpLeft aria-hidden="true" className="size-3 text-primary" />}
          label={index === 0 ? '父会话' : `上游 ${index + 1}`}
          session={session}
          onSelect={onSelect}
        />
      ))}
      {ancestorOverflow > 0 ? (
        <PaperTabOverflow
          key="ancestor-overflow"
          side="ancestor"
          index={ancestorLayers.length}
          count={ancestorOverflow}
          direction="up"
          onOpenTree={onOpenTree}
        />
      ) : null}

      {/* 子分支纸签：右缘，从底部往上排 */}
      {branchLayers.map((session, index) => (
        <PaperTab
          key={session.id}
          side="branch"
          index={index}
          icon={<CornerDownRight aria-hidden="true" className="size-3 text-primary" />}
          label={`分支 ${index + 1}`}
          session={session}
          onSelect={onSelect}
        />
      ))}
      {branchOverflow > 0 ? (
        <PaperTabOverflow
          key="branch-overflow"
          side="branch"
          index={branchLayers.length}
          count={branchOverflow}
          direction="down"
          onOpenTree={onOpenTree}
        />
      ) : null}
    </>
  );
}

/** 纸签定位：上游向左外探、分支向右外探；越深探出越多，形成"路径深度"暗示。 */
function paperTabStyle(side: 'ancestor' | 'branch', index: number): CSSProperties {
  const outward = 10 + index * 9;
  const base: CSSProperties & Record<string, string | number> = {
    zIndex: 40 + index,
    '--tab-rotate': `${index % 2 === 0 ? -0.7 : 0.5}deg`,
    transform: 'rotate(var(--tab-rotate))',
  };
  if (side === 'ancestor') {
    base.left = `${-outward}px`;
    base.top = `${60 + index * 34}px`;
  } else {
    base.right = `${-outward}px`;
    base.bottom = `${128 + index * 34}px`;
  }
  return base as CSSProperties;
}

function PaperTab({
  side,
  index,
  icon,
  label,
  session,
  onSelect,
}: {
  side: 'ancestor' | 'branch';
  index: number;
  icon: React.ReactNode;
  label: string;
  session: ChatSession;
  onSelect: (id: string) => void;
}) {
  const style = paperTabStyle(side, index);
  return (
    <button
      type="button"
      title={`回到：${session.title}`}
      aria-label={`${label}：${session.title}，点击切换`}
      onClick={() => onSelect(session.id)}
      style={style}
      className={`session-paper-tab session-paper-tab--${side} pointer-events-auto absolute hidden max-w-44 items-center gap-1.5 px-2.5 py-1 text-[11px] text-muted @min-[720px]/session-stack:flex`}
    >
      {icon}
      <span className="shrink-0 text-[10px]">{label}</span>
      <span className="min-w-0 truncate font-semibold text-card-foreground">{session.title}</span>
    </button>
  );
}

function PaperTabOverflow({
  side,
  index,
  count,
  direction,
  onOpenTree,
}: {
  side: 'ancestor' | 'branch';
  index: number;
  count: number;
  direction: 'up' | 'down';
  onOpenTree: () => void;
}) {
  const style = paperTabStyle(side, index);
  return (
    <button
      type="button"
      title={`还有 ${count} 个${direction === 'up' ? '更早的父级' : '其余分支'}，打开会话树查看`}
      aria-label={`还有 ${count} 个${direction === 'up' ? '更早的父级' : '其余分支'}，打开会话树`}
      onClick={onOpenTree}
      style={style}
      className={`session-paper-tab session-paper-tab--${side} pointer-events-auto absolute hidden items-center gap-1.5 px-2.5 py-1 text-[11px] text-muted @min-[720px]/session-stack:flex`}
    >
      <Layers3 aria-hidden="true" className="size-3 text-primary" />
      <span className="font-semibold text-card-foreground">+{count}</span>
      <span className="shrink-0 text-[10px]">{direction === 'up' ? '更早路径' : '其余分支'}</span>
    </button>
  );
}
