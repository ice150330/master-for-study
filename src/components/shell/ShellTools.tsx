'use client';

import { Search, Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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

export function ShellTools() {
  const router = useRouter();
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
      <WorkspaceSwitcher />

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogTrigger asChild>
          <IconButton label="搜索页面" className="hidden sm:inline-flex">
            <Search />
          </IconButton>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogTitle className="sr-only">搜索页面</DialogTitle>
          <DialogDescription className="sr-only">按页面或区域名称快速跳转</DialogDescription>
          <div className="border-b border-dashed border-border/70 p-3">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                autoFocus
                aria-label="搜索页面"
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
                    className="flex min-h-9 w-full items-center gap-3 rounded-[2px] border border-dashed border-transparent px-2.5 text-left transition-[transform,background-color,border-color] hover:translate-x-0.5 hover:border-accent/60 hover:bg-highlight/20"
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
        <PopoverContent align="end" className="w-[22rem]">
          <SettingsPanel />
        </PopoverContent>
      </Popover>

      <ThemeToggle />
    </div>
  );
}
