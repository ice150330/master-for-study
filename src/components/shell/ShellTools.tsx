'use client';

import { Database, Search, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { NAV_SECTIONS, type AppRoute } from '@/lib/nav';
import { setThemeMode, useThemeMode } from '@/lib/theme-client';
import { ThemeToggle } from './ThemeToggle';

const pages = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label })),
);

export function ShellTools() {
  const router = useRouter();
  const mode = useThemeMode();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return pages;
    return pages.filter((page) =>
      `${page.section} ${page.label} ${page.shortLabel}`.toLocaleLowerCase('zh-CN').includes(normalized),
    );
  }, [query]);

  function navigate(href: AppRoute) {
    router.push(href);
    setSearchOpen(false);
    setQuery('');
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-1 hidden items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-xs text-muted sm:inline-flex">
        <Database aria-hidden="true" className="size-3.5 text-accent" />
        本地工作区
      </span>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogTrigger asChild>
          <IconButton label="搜索页面" className="hidden sm:inline-flex">
            <Search />
          </IconButton>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">搜索页面</DialogTitle>
          <DialogDescription className="sr-only">按页面或区域名称快速跳转</DialogDescription>
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索页面"
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length > 0 ? (
              results.map((page) => (
                <button
                  key={page.href}
                  type="button"
                  onClick={() => navigate(page.href)}
                  className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{page.label}</span>
                  <span className="text-xs text-muted">{page.section}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted">没有匹配页面</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="工作台设置">
            <Settings2 />
          </IconButton>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <p className="text-sm font-semibold text-foreground">工作台设置</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">界面主题</p>
              <p className="mt-0.5 text-[11px] text-muted">跟随当前设备上的选择</p>
            </div>
            <SegmentedControl
              ariaLabel="界面主题"
              value={mode}
              items={[
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]}
              onValueChange={(value) => setThemeMode(value === 'dark' ? 'dark' : 'light')}
            />
          </div>
          <div className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
            学习记录保存在本地 SQLite；发送给老师的内容会用于 DeepSeek 在线推理。
          </div>
        </PopoverContent>
      </Popover>

      <ThemeToggle />
    </div>
  );
}
