'use client';

import { Search, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { NAV_SECTIONS, type AppRoute } from '@/lib/nav';
import { SettingsPanel } from './SettingsPanel';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

const pages = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label })),
);

/** C1 内容搜索命中：type → 展示名与跳转目标。 */
type ContentHit = {
  type: 'session' | 'message' | 'concept' | 'note' | 'resource';
  id: string;
  title: string;
  excerpt: string;
  sessionId?: string;
};

const HIT_LABELS: Record<ContentHit['type'], string> = {
  session: '会话',
  message: '消息',
  concept: '概念',
  note: '笔记',
  resource: '资源',
};

function hitHref(hit: ContentHit): string {
  switch (hit.type) {
    case 'session':
      return `/?session=${hit.id}`;
    case 'message':
      return `/?session=${hit.sessionId ?? ''}&message=${hit.id}`;
    case 'concept':
      return `/?concept=${hit.id}`;
    case 'note':
      return `/notes?note=${hit.id}`;
    case 'resource':
      return `/resources?resource=${hit.id}`;
  }
}

export function ShellTools() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [contentHits, setContentHits] = useState<ContentHit[]>([]);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return pages;
    return pages.filter((page) =>
      `${page.section} ${page.label} ${page.shortLabel}`.toLocaleLowerCase('zh-CN').includes(normalized),
    );
  }, [query]);

  // C1 内容搜索：防抖 250ms，搜索框打开且有输入时才请求（清空在交互回调里做）
  useEffect(() => {
    const trimmed = query.trim();
    if (!searchOpen || !trimmed) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { hits?: ContentHit[] };
        if (!cancelled) setContentHits(data.hits ?? []);
      } catch {
        // 搜索失败保持空态
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
    setContentHits([]);
  }

  function navigate(href: AppRoute) {
    router.push(href);
    closeSearch();
  }

  function navigateToHit(href: string) {
    router.push(href);
    closeSearch();
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <WorkspaceSwitcher />

      <Dialog open={searchOpen} onOpenChange={(open) => {
        setSearchOpen(open);
        if (!open) closeSearch();
      }}>
        <DialogTrigger asChild>
          <IconButton label="搜索页面" className="hidden sm:inline-flex">
            <Search />
          </IconButton>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">搜索页面</DialogTitle>
          <DialogDescription className="sr-only">按页面、会话、概念、笔记与资源内容快速跳转</DialogDescription>
          <div className="border-b border-dashed border-border/70 p-3">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                aria-label="搜索页面与内容"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (!event.target.value.trim()) setContentHits([]);
                }}
                placeholder="搜索页面、会话、概念、笔记…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {results.length > 0 ? (
              results.map((page) => (
                <button
                  key={page.href}
                  type="button"
                  onClick={() => navigate(page.href)}
                    className="flex min-h-9 w-full items-center gap-3 rounded-[2px] border border-dashed border-transparent px-2.5 text-left transition-[transform,background-color,border-color] hover:translate-x-0.5 hover:border-accent/60 hover:bg-highlight/20"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{page.label}</span>
                  <span className="text-xs text-muted">{page.section}</span>
                </button>
              ))
            ) : null}

            {query.trim() ? (
              <>
                <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-muted">
                  {contentHits.length > 0 ? '内容命中' : '内容中没有匹配'}
                </p>
                {contentHits.map((hit) => (
                  <button
                    key={`${hit.type}:${hit.id}`}
                    type="button"
                    onClick={() => navigateToHit(hitHref(hit))}
                    className="flex min-h-11 w-full flex-col justify-center gap-0.5 rounded-[2px] border border-dashed border-transparent px-2.5 text-left transition-[transform,background-color,border-color] hover:translate-x-0.5 hover:border-accent/60 hover:bg-highlight/20"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded-[2px] border border-dashed border-border px-1 text-[10px] text-muted">
                        {HIT_LABELS[hit.type]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{hit.title}</span>
                    </span>
                    {hit.excerpt ? (
                      <span className="truncate text-[11px] text-muted">{hit.excerpt}</span>
                    ) : null}
                  </button>
                ))}
              </>
            ) : null}

            {results.length === 0 && !query.trim() ? (
              <p className="px-3 py-8 text-center text-sm text-muted">没有匹配页面</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="工作台设置">
            <Settings2 />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem]">
          <SettingsPanel />
        </PopoverContent>
      </Popover>

      <ThemeToggle />
    </div>
  );
}
