'use client';

import { useState } from 'react';
import type { ChatSession } from './chat-types';

/**
 * 分支扇：当前会话的子会话（派生分支）以小卡片的形式
 * 叠在主卡片右上角（逐张轻微下沉 + 旋转，形成扇形）。
 * 最多显示 3 张，更多折叠为「+N」，点开列出全部分支。
 */
export function BranchFan({
  branches,
  onSelect,
}: {
  branches: ChatSession[];
  onSelect: (id: string) => void;
}) {
  const [openMore, setOpenMore] = useState(false);
  if (branches.length === 0) return null;

  const shown = branches.slice(0, 3);
  const hidden = branches.slice(3);

  return (
    <div className="absolute right-4 top-3 z-30 flex items-start gap-1.5">
      {shown.map((b, i) => (
        <button
          key={b.id}
          type="button"
          title={`切到分支：${b.title}`}
          onClick={() => onSelect(b.id)}
          style={{ transform: `translateY(${i * 5}px) rotate(${(i + 1) * 1.2}deg)` }}
          className="w-36 rounded-xl border border-border bg-card-soft px-3 py-1.5 text-left shadow-md transition-transform duration-200 hover:-translate-y-1 hover:rotate-0"
        >
          <span className="block truncate text-xs font-medium text-card-foreground">
            {b.title}
          </span>
          <span className="text-[10px] text-muted">分支会话</span>
        </button>
      ))}

      {hidden.length > 0 && (
        <>
          {openMore && (
            <button
              type="button"
              aria-label="关闭"
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpenMore(false)}
            />
          )}
          <button
            type="button"
            onClick={() => setOpenMore((v) => !v)}
            className="rounded-xl border border-dashed border-border bg-card-soft/60 px-2.5 py-2 text-xs font-medium text-muted shadow-sm transition-colors hover:bg-card"
          >
            +{hidden.length}
          </button>
          {openMore && (
            <div className="absolute right-0 top-11 z-40 w-60 rounded-2xl border border-border bg-card p-2 shadow-xl">
              <p className="mb-1 px-2 text-[11px] text-muted">其余分支</p>
              <div className="max-h-56 overflow-y-auto">
                {hidden.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setOpenMore(false);
                      onSelect(b.id);
                    }}
                    className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-card-foreground transition-colors hover:bg-card-soft"
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
