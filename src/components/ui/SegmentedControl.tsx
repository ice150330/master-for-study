'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export function SegmentedControl({
  value,
  items,
  onValueChange,
  ariaLabel,
  className,
}: {
  value: string;
  items: SegmentItem[];
  onValueChange(value: string): void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('paper-subtle inline-flex min-h-8 items-center gap-0.5 rounded-[2px] border border-dashed p-0.5', className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex h-7 items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-transparent px-2.5 text-xs font-semibold transition-[transform,box-shadow,background-color,color,border-color] duration-150 active:translate-x-0.5 active:translate-y-0.5 [&>svg]:size-3.5',
              active
                ? 'border-foreground bg-foreground text-background shadow-[3px_3px_0_var(--marker-yellow)]'
                : 'text-muted hover:border-accent/60 hover:bg-accent/10 hover:text-foreground',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
