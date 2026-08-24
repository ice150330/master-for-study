'use client';

import type { CSSProperties } from 'react';
import { CornerUpLeft, Layers3 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import type { ChatSession } from './chat-types';

type AncestorLayer =
  | { kind: 'session'; session: ChatSession; depth: number }
  | { kind: 'overflow'; sessions: ChatSession[]; depth: number };

/**
 * 父级实体卡堆：每层都是与当前会话同尺寸的完整卡片。
 * 默认紧密叠放，悬停或键盘聚焦任一卡沿时整叠向左上展开。
 */
export function AncestorStack({
  ancestors,
  hasBranches,
  onSelect,
}: {
  /** 由近到远：[父, 祖父, 曾祖, …] */
  ancestors: ChatSession[];
  hasBranches: boolean;
  onSelect: (id: string) => void;
}) {
  if (ancestors.length === 0) return null;

  const direct = ancestors.slice(0, 2).map<AncestorLayer>((session, index) => ({
    kind: 'session',
    session,
    depth: index,
  }));
  const overflow = ancestors.slice(2);
  const layers: AncestorLayer[] = overflow.length > 0
    ? [...direct, { kind: 'overflow', sessions: overflow, depth: 2 }]
    : direct;

  return (
    <nav
      aria-label="会话分支路径"
      className="session-ancestor-stack pointer-events-none absolute inset-0 z-10 hidden @min-[720px]/session-stack:block"
    >
      {[...layers].reverse().map((layer) => {
        const distance = 11 + layer.depth * 27;
        const expandedDistance = 17 + layer.depth * 34;
        const style = {
          '--stack-x': `${-distance}px`,
          '--stack-y': `${-distance}px`,
          '--stack-expanded-x': `${-expandedDistance}px`,
          '--stack-expanded-y': `${-expandedDistance}px`,
          '--stack-rotation': `${-(layer.depth + 1) * 0.2}deg`,
          '--stack-scale': `${1 - layer.depth * 0.004}`,
          '--stack-opacity': `${1 - layer.depth * 0.055}`,
          zIndex: 20 - layer.depth,
        } as CSSProperties;
        const visualProps = {
          style,
          className: `session-stack-layer session-stack-layer--ancestor group pointer-events-none absolute left-12 right-12 top-24 overflow-hidden rounded-[2px] border border-border bg-card text-left ${
            hasBranches ? 'bottom-24' : 'bottom-0'
          }`,
        };

        if (layer.kind === 'overflow') {
          return (
            <div key="ancestor-overflow" {...visualProps}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`查看 ${layer.sessions.length} 个更早的父级会话`}
                    className="session-stack-edge pointer-events-auto absolute inset-x-0 top-0 flex h-7 items-center gap-2 px-4 text-[11px] font-medium text-muted"
                  >
                    <span aria-hidden="true" className="session-stack-index">+{layer.sessions.length}</span>
                    <Layers3 aria-hidden="true" className="size-3" />
                    <span>更早路径</span>
                    <span className="ml-auto text-[10px] text-muted">展开全部</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={8} className="w-64 p-2">
                  <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted">更早的父级会话</p>
                  {layer.sessions.map((session, index) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="doodle-row flex min-h-9 w-full items-center gap-2 rounded-[2px] border border-dashed border-transparent px-2 text-left text-xs text-card-foreground hover:bg-highlight/15"
                    >
                      <span className="text-[10px] font-bold text-muted">↑{index + 3}</span>
                      <span className="min-w-0 flex-1 truncate">{session.title}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          );
        }

        return (
          <div
            key={layer.session.id}
            {...visualProps}
          >
            <button
              type="button"
              title={`回到：${layer.session.title}`}
              aria-label={`回到父级会话：${layer.session.title}`}
              onClick={() => onSelect(layer.session.id)}
              className="session-stack-edge pointer-events-auto absolute inset-x-0 top-0 flex h-7 items-center gap-2 px-4 text-[11px] font-medium text-muted"
            >
              <span aria-hidden="true" className="session-stack-index">{layer.depth + 1}</span>
              <CornerUpLeft aria-hidden="true" className="size-3 text-primary" />
              <span className="shrink-0 text-muted">{layer.depth === 0 ? '父会话' : `上游 ${layer.depth + 1}`}</span>
              <span className="truncate font-semibold text-card-foreground">{layer.session.title}</span>
              <span className="ml-auto shrink-0 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">回到此层</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
