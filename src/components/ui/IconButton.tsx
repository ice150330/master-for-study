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
            'inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 [&>svg]:size-[18px]',
            tone === 'default' && 'text-muted hover:bg-surface hover:text-foreground',
            tone === 'primary' && 'bg-primary text-primary-foreground hover:brightness-95',
            tone === 'danger' && 'text-danger hover:bg-danger/10',
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
});
