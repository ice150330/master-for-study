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
  width = 'md',
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const maxWidth = width === 'sm' ? 'max-w-2xl' : width === 'lg' ? 'max-w-5xl' : 'max-w-3xl';
  return (
    <div className={`mx-auto flex min-h-full w-full ${maxWidth} flex-col px-4 py-6`}>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}
