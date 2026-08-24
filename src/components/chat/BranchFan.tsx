'use client';

import type { CSSProperties } from 'react';
import { CornerDownRight, Layers3 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import type { ChatSession } from './chat-types';

type BranchLayer =
  | { kind: 'session'; session: ChatSession; order: number }
  | { kind: 'overflow'; sessions: ChatSession[]; order: number };

/**
 * 子级实体卡堆：与当前会话同尺寸，向右下紧密叠放。
 * 悬停或聚焦卡沿时整叠展开，点击后将目标分支提到前景。
 */
export function BranchFan({
  branches,
  hasAncestors,
  onSelect,
}: {
  branches: ChatSession[];
  hasAncestors: boolean;
  onSelect: (id: string) => void;
}) {
  if (branches.length === 0) return null;

  const direct = branches.slice(0, 2).map<BranchLayer>((session, index) => ({
    kind: 'session',
    session,
    order: index,
  }));
  const overflow = branches.slice(2);
  const layers: BranchLayer[] = overflow.length > 0
    ? [...direct, { kind: 'overflow', sessions: overflow, order: 2 }]
    : direct;

  return (
    <aside
      aria-label="后续分支"
      className="session-branch-stack pointer-events-none absolute inset-0 z-0 hidden @min-[720px]/session-stack:block"
    >
      {[...layers].reverse().map((layer) => {
        const distance = 11 + layer.order * 27;
        const expandedDistance = 17 + layer.order * 34;
        const style = {
          '--stack-x': `${distance}px`,
          '--stack-y': `${distance}px`,
          '--stack-expanded-x': `${expandedDistance}px`,
          '--stack-expanded-y': `${expandedDistance}px`,
          '--stack-rotation': `${(layer.order + 1) * 0.2}deg`,
          '--stack-scale': `${1 - layer.order * 0.004}`,
          '--stack-opacity': `${1 - layer.order * 0.055}`,
          zIndex: 16 - layer.order,
        } as CSSProperties;
        const visualProps = {
          style,
          className: `session-stack-layer session-stack-layer--branch group pointer-events-none absolute bottom-24 left-12 right-12 overflow-hidden rounded-[2px] border border-border bg-card text-left ${
            hasAncestors ? 'top-24' : 'top-0'
          }`,
        };

        if (layer.kind === 'overflow') {
          return (
            <div key="branch-overflow" {...visualProps}>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`查看其余 ${layer.sessions.length} 个后续分支`}
                    className="session-stack-edge pointer-events-auto absolute inset-x-0 bottom-0 flex h-7 items-center gap-2 px-4 text-[11px] font-medium text-muted"
                  >
                    <span className="text-[10px] text-muted">展开全部</span>
                    <span className="ml-auto">其余分支</span>
                    <Layers3 aria-hidden="true" className="size-3" />
                    <span aria-hidden="true" className="session-stack-index">+{layer.sessions.length}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-64 p-2">
                  <p className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted">其余后续分支</p>
                  {layer.sessions.map((session, index) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="doodle-row flex min-h-9 w-full items-center gap-2 rounded-[2px] border border-dashed border-transparent px-2 text-left text-xs text-card-foreground hover:bg-highlight/15"
                    >
                      <span className="text-[10px] font-bold text-muted">B{index + 3}</span>
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
              title={`切到分支：${layer.session.title}`}
              aria-label={`切到后续分支：${layer.session.title}`}
              onClick={() => onSelect(layer.session.id)}
              className="session-stack-edge pointer-events-auto absolute inset-x-0 bottom-0 flex h-7 items-center gap-2 px-4 text-[11px] font-medium text-muted"
            >
              <span className="shrink-0 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">打开此层</span>
              <span className="ml-auto truncate font-semibold text-card-foreground">{layer.session.title}</span>
              <span className="shrink-0 text-muted">分支 {layer.order + 1}</span>
              <CornerDownRight aria-hidden="true" className="size-3 text-primary" />
              <span aria-hidden="true" className="session-stack-index">{layer.order + 1}</span>
            </button>
          </div>
        );
      })}
    </aside>
  );
}
