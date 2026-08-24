'use client';

import { Archive, ArchiveRestore, Check, Database, FolderCog, FolderPlus, Pencil, Trash2 } from 'lucide-react';
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
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Field';

type WorkspaceItem = {
  id: string;
  title: string;
  goal: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
};

/**
 * 工作区切换器（蓝图 4.1：一个工作区 = 一个学习主题）——AI 会话界面独有（会话卡头部）。
 * 列表 / 切换 / 新建 / 重命名；管理工作区对话框提供归档与删除（C4）。
 * 切换后整页刷新，让服务端直调页面与客户端数据全部重载。
 */
export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = workspaces.find((item) => item.id === activeId)
    ?? workspaces.find((item) => item.isActive);
  const switchable = workspaces.filter((item) => item.archivedAt === null);

  async function fetchWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await fetch('/api/workspaces');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { workspaces?: WorkspaceItem[] };
    return data.workspaces ?? [];
  }

  async function reloadList() {
    const list = await fetchWorkspaces();
    setWorkspaces(list);
    setActiveId(list.find((item) => item.isActive)?.id ?? null);
  }

  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchWorkspaces();
        if (!cancelled) {
          setWorkspaces(list);
          setActiveId(list.find((item) => item.isActive)?.id ?? null);
        }
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

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={(open) => {
        setMenuOpen(open);
        if (open) setError(null);
      }}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label={`学习工作区：${active?.title ?? '本地工作区'}，点按切换`}
            className="size-8 shrink-0"
          >
            <Database aria-hidden="true" className="text-accent" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {switchable.map((item) => (
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
          <DropdownMenuItem
            onSelect={() => {
              setError(null);
              setManageOpen(true);
            }}
          >
            <FolderCog aria-hidden="true" className="size-3.5" />
            管理工作区…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && !createOpen && !renameOpen && !manageOpen ? (
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

      <ManageDialog
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) setError(null);
        }}
        workspaces={workspaces}
        onReload={reloadList}
      />
    </>
  );
}

/** 管理工作区（C4）：归档 / 恢复 / 删除（非当前工作区），删除需二次确认。 */
function ManageDialog({
  open,
  onOpenChange,
  workspaces,
  onReload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: WorkspaceItem[];
  onReload: () => Promise<void>;
}) {
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时刷新一次列表；关闭时的状态清理由 onOpenChange 调用方完成
  useEffect(() => {
    if (!open) return;
    void onReload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function patchWorkspace(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `操作失败（HTTP ${res.status}）`);
      }
      await onReload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `删除失败（HTTP ${res.status}）`);
      }
      setDeleteTarget(null);
      await onReload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open && !deleteTarget} onOpenChange={(next) => {
        if (!next) setDeleteTarget(null);
        onOpenChange(next);
      }}>
        <DialogContent className="w-[26rem]">
          <DialogTitle>管理工作区</DialogTitle>
          <DialogDescription>归档的工作区不再出现在切换列表，学习记录保留、可随时恢复；删除不可恢复。</DialogDescription>
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {workspaces.map((item) => (
              <li
                key={item.id}
                className="doodle-row flex items-center justify-between gap-2 rounded-[2px] border border-dashed px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{item.title}</span>
                    {item.isActive ? (
                      <span className="shrink-0 rounded-[2px] border border-dashed border-primary px-1 text-[10px] text-primary">当前</span>
                    ) : null}
                    {item.archivedAt ? (
                      <span className="shrink-0 rounded-[2px] border border-dashed border-border px-1 text-[10px] text-muted">已归档</span>
                    ) : null}
                  </span>
                  {item.goal ? <span className="mt-0.5 block truncate text-[11px] text-muted">{item.goal}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {item.archivedAt ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchWorkspace(item.id, { archived: false })}
                      className="rounded-[2px] border border-dashed border-border px-1.5 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-foreground disabled:opacity-50"
                      aria-label={`恢复工作区 ${item.title}`}
                    >
                      <ArchiveRestore aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : !item.isActive ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patchWorkspace(item.id, { archived: true })}
                      className="rounded-[2px] border border-dashed border-border px-1.5 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-foreground disabled:opacity-50"
                      aria-label={`归档工作区 ${item.title}`}
                    >
                      <Archive aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                  {!item.isActive ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteTarget(item)}
                      className="rounded-[2px] border border-dashed border-border px-1.5 py-1 text-[11px] text-danger hover:border-danger/60 disabled:opacity-50"
                      aria-label={`删除工作区 ${item.title}`}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {error ? <p role="alert" className="mt-2 text-xs text-primary">{error}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(next) => {
        if (!next) setDeleteTarget(null);
      }}>
        <DialogContent className="w-96">
          <DialogTitle>删除工作区「{deleteTarget?.title}」？</DialogTitle>
          <DialogDescription>
            将删除该工作区的全部会话、消息、笔记、资源、面试与复习记录，
            <strong className="text-foreground">不可恢复</strong>。概念库（术语与掌握度）为全局共享，会保留。
            建议先在设置中导出备份。
          </DialogDescription>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>取消</Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={busy}>
              {busy ? '删除中…' : '确认删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
