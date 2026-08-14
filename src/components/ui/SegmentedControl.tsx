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
      className={cn('inline-flex min-h-9 items-center gap-0.5 rounded-md bg-surface p-0.5', className)}
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
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-[5px] px-3 text-xs font-medium transition-colors duration-150 [&>svg]:size-4',
              active
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted hover:text-foreground',
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
