'use client';

import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';

/**
 * 主按钮样式的链接：doodle-action 视觉（墨边纸底黄影）+ next/link 跳转。
 * 点击时若当前页带学习上下文（工作区 / 概念 / 来源 / 尝试），透传到目标页——
 * 与 AppShell 导航的 contextualHref 行为一致，不覆盖链接自身已有的选择参数。
 */
export const LinkButton = forwardRef<
  HTMLAnchorElement,
  {
    href: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    'aria-label'?: string;
  }
>(function LinkButton({ href, children, size = 'md', className, ...rest }, ref) {
  const router = useRouter();

  const sizeClass = size === 'sm' ? 'h-7 px-2.5 text-xs' : size === 'lg' ? 'h-9 px-4 text-sm' : 'h-8 px-3.5 text-sm';

  return (
    <Link
      ref={ref}
      href={href}
      onClick={(event) => {
        const context = parseLearningContext(new URLSearchParams(window.location.search));
        if (!context.conceptId && !context.source && !context.attempt && !context.workspaceId) return;
        event.preventDefault();
        router.push(withLearningContext(href, context));
      }}
      className={cn(
        'doodle-action inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[2px] border-2 border-dashed border-foreground bg-card font-semibold text-foreground transition-[transform,box-shadow,background-color] duration-150 hover:-translate-x-px hover:-translate-y-px hover:bg-highlight/15 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        sizeClass,
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  );
});
