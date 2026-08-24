'use client';

import type { CSSProperties } from 'react';
import { CornerDownRight, CornerUpLeft, Layers3 } from 'lucide-react';
import type { ChatSession } from './chat-types';

/** 每侧最多直接可见的胶带数，超出收进树抽屉 */
const MAX_VISIBLE = 3;

/**
 * 会话胶带纸签：父级链是骑缝贴在主卡上缘、从左上角向右排成一行黄色胶带；
 * 子分支是贴在下缘右下角的**真实重叠堆叠**青色胶带——收起时逐条向左叠压、
 * 只露出图标与「分支N」层号（`.session-tape-stack`），鼠标悬停 / 键盘聚焦
 * 整叠扇形展开并淡入完整标题。胶带骑在卡边框上（一半在卡外留白里），
 * 不遮挡卡内任何内容；倾斜角度逐条交替，呼应全局手绘胶带语言。
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
      {/* 父级胶带：上缘左上角向右排成一行（最近父级最靠左） */}
      {ancestorLayers.map((session, index) => (
        <TapeTab
          key={session.id}
          side="ancestor"
          index={index}
          icon={<CornerUpLeft aria-hidden="true" className="size-3" />}
          label={index === 0 ? '父' : index === 1 ? '祖父' : `上游${index + 1}`}
          session={session}
          onSelect={onSelect}
        />
      ))}
      {ancestorOverflow > 0 ? (
        <TapeTabOverflow
          key="ancestor-overflow"
          side="ancestor"
          index={ancestorLayers.length}
          count={ancestorOverflow}
          direction="up"
          onOpenTree={onOpenTree}
        />
      ) : null}

      {/* 子分支胶带堆：右下角真实叠压，悬停 / 聚焦整叠展开（样式见 .session-tape-stack） */}
      {branchLayers.length > 0 || branchOverflow > 0 ? (
        <div className="session-tape-stack" role="group" aria-label={`分支会话（${branches.length} 个），悬停展开`}>
          {branchLayers.map((session, index) => (
            <TapeTab
              key={session.id}
              side="branch"
              index={index}
              stacked
              icon={<CornerDownRight aria-hidden="true" className="size-3" />}
              label={`分支${index + 1}`}
              session={session}
              onSelect={onSelect}
            />
          ))}
          {branchOverflow > 0 ? (
            <TapeTabOverflow
              key="branch-overflow"
              side="branch"
              index={branchLayers.length}
              count={branchOverflow}
              direction="down"
              stacked
              onOpenTree={onOpenTree}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** 父级胶带定位：沿上缘一行排布，倾斜逐条交替（分支堆不使用绝对定位）。 */
function tapeTabStyle(index: number): CSSProperties {
  const base: CSSProperties & Record<string, string | number> = {
    zIndex: 40 + index,
    '--tab-rotate': `${[-1.6, 1.1, -0.8, 1.4][index % 4]}deg`,
    transform: 'rotate(var(--tab-rotate))',
    top: '-9px',
    left: `${12 + index * 104}px`,
  };
  return base as CSSProperties;
}

/** 堆叠分支胶带：只带倾斜角，位置交给 .session-tape-stack 的叠压布局。 */
function stackedTabStyle(index: number): CSSProperties {
  const base: CSSProperties & Record<string, string | number> = {
    '--tab-rotate': `${[-1.6, 1.1, -0.8, 1.4][index % 4]}deg`,
    transform: 'rotate(var(--tab-rotate))',
  };
  return base as CSSProperties;
}

function TapeTab({
  side,
  index,
  stacked = false,
  icon,
  label,
  session,
  onSelect,
}: {
  side: 'ancestor' | 'branch';
  index: number;
  /** 分支堆叠样式：位置由容器控制，标题悬停展开 */
  stacked?: boolean;
  icon: React.ReactNode;
  label: string;
  session: ChatSession;
  onSelect: (id: string) => void;
}) {
  const style = stacked ? stackedTabStyle(index) : tapeTabStyle(index);
  return (
    <button
      type="button"
      title={`回到：${session.title}`}
      aria-label={`${label}会话：${session.title}，点击切换`}
      onClick={() => onSelect(session.id)}
      style={style}
      className={`session-tape-tab session-tape-tab--${side} pointer-events-auto ${
        stacked ? 'tape-in-stack' : 'absolute'
      } inline-flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold leading-4`}
    >
      {icon}
      <span className="shrink-0">{label}</span>
      <span className={`max-w-28 truncate font-medium ${stacked ? 'tape-title' : ''}`}>
        {session.title}
      </span>
    </button>
  );
}

function TapeTabOverflow({
  side,
  index,
  count,
  direction,
  stacked = false,
  onOpenTree,
}: {
  side: 'ancestor' | 'branch';
  index: number;
  count: number;
  direction: 'up' | 'down';
  stacked?: boolean;
  onOpenTree: () => void;
}) {
  const style = stacked ? stackedTabStyle(index) : tapeTabStyle(index);
  return (
    <button
      type="button"
      title={`还有 ${count} 个${direction === 'up' ? '更早的父级' : '其余分支'}，打开会话树查看`}
      aria-label={`还有 ${count} 个${direction === 'up' ? '更早的父级' : '其余分支'}，打开会话树`}
      onClick={onOpenTree}
      style={style}
      className={`session-tape-tab session-tape-tab--${side} pointer-events-auto ${
        stacked ? 'tape-in-stack' : 'absolute'
      } inline-flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold leading-4`}
    >
      <Layers3 aria-hidden="true" className="size-3" />
      <span>+{count}</span>
      <span className="shrink-0">{direction === 'up' ? '更早路径' : '其余分支'}</span>
    </button>
  );
}
