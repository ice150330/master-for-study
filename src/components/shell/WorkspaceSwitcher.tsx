'use client';

import { Check, ChevronDown, Database, FolderPlus, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Input } from '@/components/ui/Field';

type WorkspaceItem = {
  id: string;
  title: string;
  goal: string | null;
  isActive: boolean;
  createdAt: string;
};

/**
 * 工作区切换器（蓝图 4.1：一个工作区 = 一个学习主题）。
 * 列表 / 切换 / 新建 / 重命名当前；切换后整页刷新，让服务端直调页面与客户端数据全部重载。
 */
export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = workspaces.find((item) => item.id === activeId)
    ?? workspaces.find((item) => item.isActive);

  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/workspaces');
        if (!res.ok) return;
        const data: unknown = await res.json();
        const raw = (data as { workspaces?: WorkspaceItem[]; activeId?: string | null }) ?? {};
        if (cancelled) return;
        setWorkspaces(raw.workspaces ?? []);
        setActiveId(raw.activeId ?? null);
      } catch {
        // 打不开列表就保持空态
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  async function switchTo(id: string) {
    if (id === activeId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch {
      setError('切换工作区失败，请重试');
      setBusy(false);
    }
  }

  async function createWorkspace() {
    const title = titleDraft.trim();
    if (!title) {
      setError('请填写工作区主题');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, goal: goalDraft.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch {
      setError('新建工作区失败，请重试');
      setBusy(false);
    }
  }

  async function renameActive() {
    if (!active) return;
    const title = titleDraft.trim();
    if (!title) {
      setError('请填写工作区主题');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRenameOpen(false);
      setError(null);
      setBusy(false);
      setMenuOpen(true);
      await reloadList();
    } catch {
      setError('重命名失败，请重试');
      setBusy(false);
    }
  }

  async function reloadList() {
    const res = await fetch('/api/workspaces');
    if (!res.ok) return;
    const data: unknown = await res.json();
    const raw = (data as { workspaces?: WorkspaceItem[]; activeId?: string | null }) ?? {};
    setWorkspaces(raw.workspaces ?? []);
    setActiveId(raw.activeId ?? null);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={(open) => {
        setMenuOpen(open);
        if (open) setError(null);
      }}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`学习工作区：${active?.title ?? '本地工作区'}，点按切换`}
            className="paper-subtle mr-1 hidden h-7 rotate-[0.35deg] items-center gap-1.5 rounded-[2px] border border-dashed px-2 text-[11px] text-muted transition-[background-color,border-color] hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground sm:inline-flex"
          >
            <Database aria-hidden="true" className="size-3.5 text-accent" />
            <span className="max-w-24 truncate">{active?.title ?? '本地工作区'}</span>
            <ChevronDown aria-hidden="true" className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {workspaces.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => void switchTo(item.id)}>
              {item.isActive ? (
                <Check aria-hidden="true" className="size-3.5 text-primary" />
              ) : (
                <span aria-hidden className="size-3.5" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.goal ? <span className="text-[10px] text-muted">{item.goal}</span> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setTitleDraft('');
              setGoalDraft('');
              setError(null);
              setCreateOpen(true);
            }}
          >
            <FolderPlus aria-hidden="true" className="size-3.5" />
            新建工作区…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!active}
            onSelect={() => {
              setTitleDraft(active?.title ?? '');
              setError(null);
              setRenameOpen(true);
            }}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            重命名当前…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && !createOpen && !renameOpen ? (
        <span role="alert" className="text-[11px] text-primary">{error}</span>
      ) : null}

      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) setError(null);
      }}>
        <DialogContent className="w-88">
          <DialogTitle>新建工作区</DialogTitle>
          <DialogDescription>一个工作区对应一个学习主题，新建后立即切换到它。</DialogDescription>
          <div className="mt-3 space-y-2">
            <Input
              aria-label="工作区主题"
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="如：学 HTTP / 数据库入门"
            />
            <Input
              aria-label="学习目标（可选）"
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              placeholder="目标（可选），如：后端工程师"
            />
            {error ? <p role="alert" className="text-xs text-primary">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={() => void createWorkspace()} disabled={busy}>
                {busy ? '创建中…' : '新建并切换'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={(open) => {
        setRenameOpen(open);
        if (!open) setError(null);
      }}>
        <DialogContent className="w-80">
          <DialogTitle>重命名当前工作区</DialogTitle>
          <DialogDescription>只改名称，学习记录不受影响。</DialogDescription>
          <div className="mt-3 space-y-2">
            <Input
              aria-label="工作区主题"
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
            {error ? <p role="alert" className="text-xs text-primary">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setRenameOpen(false)}>取消</Button>
              <Button onClick={() => void renameActive()} disabled={busy}>
                {busy ? '保存中…' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
