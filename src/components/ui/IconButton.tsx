'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'primary' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, tone = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type={type}
          aria-label={label}
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-dashed border-transparent transition-[transform,box-shadow,background-color,color,border-color] duration-150 hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-x-0 disabled:hover:translate-y-0 [&>svg]:size-4',
            tone === 'default' && 'text-muted hover:border-foreground/45 hover:bg-highlight/20 hover:text-foreground hover:shadow-[2px_2px_0_rgba(78,205,196,0.42)]',
            tone === 'primary' && 'doodle-action border-2 border-foreground bg-card text-foreground',
            tone === 'danger' && 'text-danger hover:border-danger/70 hover:bg-danger/10 hover:shadow-[2px_2px_0_rgba(255,107,107,0.42)]',
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
});
