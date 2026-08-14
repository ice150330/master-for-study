'use client';

import { useState } from 'react';
import type { ChatSession } from './chat-types';

/**
 * 祖先卡片堆：当前会话的父级链（父、祖父…）以竖条卡片的形式
 * 在主卡片左侧向左后方堆叠，点击任意竖条回跳到该会话。
 * 最近显示 3 张，更深的祖先折叠为「⋯」竖条，点开列出完整链。
 */
export function AncestorStack({
  ancestors,
  onSelect,
}: {
  /** 由近到远：[父, 祖父, 曾祖, …] */
  ancestors: ChatSession[];
  onSelect: (id: string) => void;
}) {
  const shown = ancestors.slice(0, 3);
  const hidden = ancestors.slice(3);
  const columns = shown.length + (hidden.length > 0 ? 1 : 0);
  if (columns === 0) return null;

  // 列位从左到右：⋯（若有）→ 最深祖先 → … → 父（最贴近主卡片）
  const leftOf = (arrayIndex: number) => (columns - 1 - arrayIndex) * 44;

  return (
    <div className="relative shrink-0" style={{ width: columns * 44 }}>
      {hidden.length > 0 && (
        <HiddenChain
          items={hidden}
          left={0}
          onSelect={(id) => {
            onSelect(id);
          }}
        />
      )}
      {shown.map((a, i) => (
        <button
          key={a.id}
          type="button"
          title={`回到：${a.title}`}
          onClick={() => onSelect(a.id)}
          style={{ left: leftOf(i), opacity: 1 - i * 0.18 }}
          className="absolute top-1/2 flex h-[64%] w-9 -translate-y-1/2 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card-soft px-1 py-2 shadow-md transition-all duration-200 hover:bg-card hover:shadow-lg hover:opacity-100"
        >
          <span className="max-h-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-card-foreground [writing-mode:vertical-rl]">
            {a.title}
          </span>
        </button>
      ))}
    </div>
  );
}

/** 更深祖先的折叠竖条：点开列出被折叠的链（由远到近）。 */
function HiddenChain({
  items,
  left,
  onSelect,
}: {
  items: ChatSession[];
  left: number;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        // 透明背板：点击任意处关闭
        <button
          type="button"
          aria-label="关闭"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setOpen(false)}
        />
      )}
      <button
        type="button"
        title={`还有 ${items.length} 个更早的祖先会话`}
        onClick={() => setOpen((v) => !v)}
        style={{ left }}
        className="absolute top-1/2 z-40 flex h-[64%] w-9 -translate-y-1/2 items-center justify-center rounded-2xl border border-dashed border-border bg-card-soft/60 text-muted shadow-sm transition-colors hover:bg-card"
      >
        <span className="text-sm">⋯</span>
      </button>
      {open && (
        <div className="absolute left-12 top-1/2 z-40 w-56 -translate-y-1/2 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <p className="mb-1 px-2 text-[11px] text-muted">更早的祖先（由远到近）</p>
          {items
            .slice()
            .reverse()
            .map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(s.id);
                }}
                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-xs text-card-foreground transition-colors hover:bg-card-soft"
              >
                {s.title}
              </button>
            ))}
        </div>
      )}
    </>
  );
}
