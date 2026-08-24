import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-[2px] border border-dashed border-border bg-[repeating-linear-gradient(180deg,var(--surface)_0_7px,var(--card)_7px_14px)]', className)}
      {...props}
    />
  );
}
