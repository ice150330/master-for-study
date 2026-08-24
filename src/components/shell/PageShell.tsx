import type { ReactNode } from 'react';

/**
 * 模块页统一壳：紧凑标题区 + 版心容器。
 * 顶栏导航由 AppShell 提供，页面标题不再重复解释模块用途。
 * 无 hooks，服务端 / 客户端组件均可使用。
 */
export function PageShell({
  title,
  actions,
  contextRail,
  width = 'md',
  flush = false,
  children,
}: {
  title: string;
  actions?: ReactNode;
  contextRail?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  flush?: boolean;
  children: ReactNode;
}) {
  const maxWidth =
    width === 'sm'
      ? 'max-w-2xl'
      : width === 'lg'
        ? 'max-w-5xl'
        : width === 'xl'
          ? 'max-w-7xl'
          : 'max-w-3xl';
  return (
    <div className={contextRail ? 'grid min-h-full min-[1180px]:grid-cols-[minmax(0,1fr)_17rem]' : 'min-h-full'}>
      <div
        className={`animate-page-enter mx-auto flex min-h-full w-full ${maxWidth} flex-col ${
          flush ? 'px-0 py-0' : 'px-4 py-4 md:px-6 md:py-5'
        }`}
      >
        <header className="mb-4 flex min-h-8 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="size-2.5 rotate-12 border-2 border-dashed border-primary bg-primary/15" />
            <h1 className="doodle-heading truncate text-xl font-extrabold text-foreground">{title}</h1>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
        {children}
      </div>
      {contextRail ? (
        <aside className="paper-control hidden border-l border-dashed p-4 min-[1180px]:block">
          {contextRail}
        </aside>
      ) : null}
    </div>
  );
}
