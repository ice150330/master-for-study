'use client';

import { Check, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import {
  THEME_MODES,
  setThemeMode,
  useThemeMode,
  type ThemeMode,
} from '@/lib/theme-client';

/**
 * 全局主题选择器：四种内置纸张主题（纸白 / 暖纸 / 青蓝 / 夜墨）。
 * 真相源是 <html> 上的 data-theme 属性（首帧由 layout 防闪脚本写入）。
 */
export function ThemeToggle({ tape = false }: { /** 左缘纸签轨工具段用胶带样式 */ tape?: boolean }) {
  const mode = useThemeMode();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`全局主题：${labelOf(mode)}，点按更换纸张`}
          className={
            tape
              ? 'rail-tape rail-tape--tool'
              : 'inline-flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-dashed border-transparent text-muted transition-[transform,background-color,color,border-color] hover:-translate-x-px hover:-translate-y-px hover:border-foreground/45 hover:bg-highlight/20 hover:text-foreground active:translate-x-0.5 active:translate-y-0.5'
          }
        >
          <Palette aria-hidden="true" className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-40 p-1.5">
        <p className="px-1.5 pb-1 text-[11px] font-semibold text-muted">纸张主题</p>
        {THEME_MODES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setThemeMode(item.value)}
            aria-pressed={mode === item.value}
            className="doodle-row flex w-full items-center gap-2 rounded-[2px] border border-dashed border-transparent px-1.5 py-1.5 text-left text-xs text-card-foreground hover:bg-highlight/15"
          >
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 rotate-[-3deg] rounded-[2px] border border-dashed border-border"
              style={{ background: item.swatch }}
            />
            <span className="min-w-0 flex-1">{item.label}</span>
            {mode === item.value ? (
              <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function labelOf(mode: ThemeMode): string {
  return THEME_MODES.find((item) => item.value === mode)?.label ?? '纸白';
}
