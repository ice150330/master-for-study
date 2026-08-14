import type { ReactNode } from 'react';

/**
 * 模块页统一壳：标题区 + 版心容器。
 * 顶栏导航由 AppShell 提供，这里只负责页面内标题、描述与内容宽度档位。
 * 无 hooks，服务端 / 客户端组件均可使用。
 */
export function PageShell({
  title,
  description,
  actions,
  contextRail,
  width = 'md',
  flush = false,
  children,
}: {
  title: string;
  description?: string;
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
    <div className={contextRail ? 'grid min-h-full min-[1180px]:grid-cols-[minmax(0,1fr)_18rem]' : 'min-h-full'}>
      <div
        className={`mx-auto flex min-h-full w-full ${maxWidth} flex-col ${
          flush ? 'px-0 py-0' : 'px-4 py-6 md:px-6'
        }`}
      >
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold text-foreground">{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
        {children}
      </div>
      {contextRail ? (
        <aside className="hidden border-l border-border bg-card p-5 min-[1180px]:block">
          {contextRail}
        </aside>
      ) : null}
    </div>
  );
}
