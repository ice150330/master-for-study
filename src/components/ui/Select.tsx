'use client';

import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';

export interface SelectItem {
  value: string;
  label: string;
}

/**
 * 统一下拉选择器：基于 DropdownMenu 封装（不引入新依赖），
 * 触发钮与 Input 同款纸面虚线框，弹层与全局下拉同源。
 * modal={false}——modal 下拉冻结 body 指针事件，与悬停类交互相邻时会互相干扰（见 SessionOpsMenu 教训）。
 */
export function Select({
  value,
  onValueChange,
  items,
  ariaLabel,
  id,
  size = 'md',
  placeholder = '请选择',
  disabled = false,
  className,
}: {
  /** 受控值；找不到对应项时显示 placeholder */
  value: string;
  onValueChange: (value: string) => void;
  items: SelectItem[];
  /** 触发钮的可访问名（弹层自身由 Radix 管理） */
  ariaLabel: string;
  /** 供 Field 的 htmlFor 关联 */
  id?: string;
  size?: 'sm' | 'md';
  placeholder?: string;
  disabled?: boolean;
  /** 附加到触发钮（宽度等） */
  className?: string;
}) {
  const selected = items.find((item) => item.value === value) ?? null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        id={id}
        disabled={disabled}
        className={cn(
          'paper-subtle inline-flex items-center justify-between gap-1.5 rounded-[2px] border-2 border-dashed px-2.5 text-card-foreground outline-none transition-[transform,border-color,box-shadow,background-color] duration-150 hover:border-foreground/50 hover:bg-card data-[state=open]:-translate-x-px data-[state=open]:-translate-y-px data-[state=open]:border-accent data-[state=open]:bg-card data-[state=open]:shadow-[4px_4px_0_rgba(78,205,196,0.38)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0',
          size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // 弹层宽度跟随触发钮，避免窄过滤器的选项被截断
        className="max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <DropdownMenuItem
              key={item.value}
              aria-checked={active}
              onSelect={() => onValueChange(item.value)}
              className={active ? 'font-semibold' : undefined}
            >
              <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center">
                {active ? <Check className="size-3.5 text-accent" /> : null}
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
