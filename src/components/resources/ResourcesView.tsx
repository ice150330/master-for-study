'use client';

import { BookOpenText, Filter, Inbox, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { RESOURCE_STATUS_LABELS, RESOURCE_STATUSES, RESOURCE_TYPES } from '@/lib/resources/types';
import { ResourceDetailPanel } from './ResourceDetailPanel';
import { ResourceFormDialog } from './ResourceFormDialog';
import type { ResourceDto, ResourceFormValue, ResourceMetadataDto } from './types';

export function ResourcesView({
  initialResources,
  initialTerms,
  initialResourceId,
}: {
  initialResources: ResourceDto[];
  initialTerms: Array<{ id: string; name: string }>;
  initialResourceId?: string | null;
}) {
  const toast = useToast();
  const initialSelected = initialResources.find((resource) => resource.id === initialResourceId)
    ?? initialResources[0]
    ?? null;
  const [resources, setResources] = useState(initialResources);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected?.id ?? null);
  const [status, setStatus] = useState<ResourceDto['status']>(initialSelected?.status ?? '想读');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'全部' | ResourceDto['type']>('全部');
  const [tag, setTag] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);

  const tags = useMemo(() => [...new Set(resources.flatMap((resource) => resource.tags))].sort(), [resources]);
  const visible = useMemo(() => resources.filter((resource) => {
    const haystack = [resource.title, resource.description, resource.siteName, ...resource.tags, ...resource.concepts.map((concept) => concept.name)].filter(Boolean).join(' ').toLocaleLowerCase();
    return resource.status === status
      && (type === '全部' || resource.type === type)
      && (!tag || resource.tags.includes(tag))
      && (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase()));
  }), [query, resources, status, tag, type]);
  const selected = visible.find((resource) => resource.id === selectedId)
    ?? visible[0]
    ?? null;
  const counts = Object.fromEntries(RESOURCE_STATUSES.map((item) => [item, resources.filter((resource) => resource.status === item).length])) as Record<ResourceDto['status'], number>;

  async function saveResource(input: { url: string; metadata: ResourceMetadataDto; form: ResourceFormValue }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (formMode === 'edit' && selected) {
        const data = await requestJson<{ resource: ResourceDto }>('/api/resources', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update', id: selected.id, title: input.form.title, type: input.form.type,
            status: selected.status, progress: selected.progress, tags: input.form.tags,
            note: input.form.note || null, conceptIds: input.form.conceptIds,
            idempotencyKey: createIdempotencyKey('resource-update'),
          }),
        });
        replaceResource(data.resource);
        toast({ title: '资源已更新', tone: 'success' });
      } else {
        const data = await requestJson<{ resource: ResourceDto; duplicate: boolean }>('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: input.url,
            canonicalUrl: input.metadata.canonicalUrl ?? undefined,
            title: input.form.title,
            type: input.form.type,
            siteName: input.metadata.siteName,
            author: input.metadata.author,
            description: input.metadata.description,
            faviconUrl: input.metadata.faviconUrl,
            conceptIds: input.form.conceptIds,
            tags: input.form.tags,
            note: input.form.note || null,
            idempotencyKey: createIdempotencyKey('resource-create'),
          }),
        });
        setResources((items) => [data.resource, ...items.filter((resource) => resource.id !== data.resource.id)]);
        setSelectedId(data.resource.id);
        setStatus(data.resource.status);
        toast({ title: data.duplicate ? '已合并重复链接' : '资源已加入收件箱', description: data.resource.title, tone: 'success' });
      }
      setFormMode(null);
    } catch (requestError) {
      setError({ message: getErrorMessage(requestError, '资源保存失败'), retry: () => void saveResource(input) });
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(progress: number, nextStatus: ResourceDto['status']) {
    if (!selected || busy) return;
    await updateSelected({ progress, status: nextStatus });
  }

  async function updateSelected(change: Partial<Pick<ResourceDto, 'progress' | 'status'>>) {
    if (!selected) return false;
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{ resource: ResourceDto }>('/api/resources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update', id: selected.id, title: selected.title, type: selected.type,
          status: change.status ?? selected.status, progress: change.progress ?? selected.progress,
          tags: selected.tags, note: selected.note, conceptIds: selected.concepts.map((concept) => concept.id),
          idempotencyKey: createIdempotencyKey('resource-progress'),
        }),
      });
      replaceResource(data.resource);
      setStatus(data.resource.status);
      toast({ title: '阅读进度已更新', tone: 'success' });
      return true;
    } catch (requestError) {
      setError({ message: getErrorMessage(requestError, '阅读进度更新失败'), retry: () => void updateSelected(change) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addHighlight(input: { excerpt: string; note: string; locator: string }) {
    if (!selected || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const data = await requestJson<{ highlight: ResourceDto['highlights'][number] }>('/api/resources/highlights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', resourceId: selected.id, ...input, tags: [], idempotencyKey: createIdempotencyKey('resource-highlight') }),
      });
      replaceResource({ ...selected, highlights: [data.highlight, ...selected.highlights] });
      toast({ title: '摘录已保存', tone: 'success' });
      return true;
    } catch (requestError) {
      setError({ message: getErrorMessage(requestError, '摘录保存失败'), retry: () => void addHighlight(input) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeHighlight(id: string) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await requestJson('/api/resources/highlights', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id, idempotencyKey: createIdempotencyKey('resource-highlight-delete') }),
      });
      replaceResource({ ...selected, highlights: selected.highlights.filter((highlight) => highlight.id !== id) });
      toast({ title: '摘录已删除', tone: 'success' });
    } catch (requestError) {
      setError({ message: getErrorMessage(requestError, '摘录删除失败'), retry: () => void removeHighlight(id) });
    } finally {
      setBusy(false);
    }
  }

  async function removeResource() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await requestJson('/api/resources', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, idempotencyKey: createIdempotencyKey('resource-delete') }),
      });
      const remaining = resources.filter((resource) => resource.id !== selected.id);
      setResources(remaining);
      setSelectedId(remaining.find((resource) => resource.status === status)?.id ?? remaining[0]?.id ?? null);
      setDeleteOpen(false);
      toast({ title: '资源已删除', tone: 'success' });
    } catch (requestError) {
      setError({ message: getErrorMessage(requestError, '资源删除失败'), retry: () => void removeResource() });
    } finally {
      setBusy(false);
    }
  }

  function replaceResource(resource: ResourceDto) {
    setResources((items) => items.map((item) => item.id === resource.id ? resource : item));
  }

  return (
    <PageShell
      title="资源库"
      description="把输入先收进队列，再通过摘录、Concept 和对话变成可用知识"
      width="xl"
      actions={<Button onClick={() => setFormMode('add')}><Plus aria-hidden="true" className="size-4" />添加资源</Button>}
    >
      {error ? <InlineNotice className="mb-4" tone="error" title="资源操作未完成" description={`${error.message}。当前输入和选择均已保留。`} actionLabel={error.retry ? '重试' : undefined} onAction={error.retry} /> : null}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4">
          <div className="flex h-full items-center gap-1" role="tablist" aria-label="资源队列">
            {RESOURCE_STATUSES.map((item) => (
              <button key={item} role="tab" aria-selected={status === item} type="button" onClick={() => { setStatus(item); setSelectedId(resources.find((resource) => resource.status === item)?.id ?? null); }} className={`relative h-14 px-3 text-sm font-medium ${status === item ? 'text-primary' : 'text-muted hover:text-foreground'}`}>
                {RESOURCE_STATUS_LABELS[item]} <span className="ml-1 text-xs">{counts[item]}</span>
                {status === item ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-primary" /> : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-muted" />
              <Input aria-label="搜索资源" className="w-64 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、标签、Concept" />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2">
              <Filter aria-hidden="true" className="size-4 text-muted" />
              <select aria-label="资源类型" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-9 bg-transparent text-xs outline-none">
                <option>全部</option>{RESOURCE_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </div>

        {tags.length > 0 ? (
          <div className="flex min-h-10 items-center gap-1.5 overflow-x-auto border-b border-border px-4">
            <button type="button" onClick={() => setTag(null)} className={`rounded-md px-2 py-1 text-[11px] ${tag === null ? 'bg-primary/10 text-primary' : 'text-muted'}`}>全部标签</button>
            {tags.map((item) => <button key={item} type="button" onClick={() => setTag(tag === item ? null : item)} className={`rounded-md px-2 py-1 text-[11px] ${tag === item ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface'}`}>{item}</button>)}
          </div>
        ) : null}

        <div className="grid min-h-[620px] min-[1050px]:grid-cols-[21rem_minmax(0,1fr)]">
          <aside className="border-r border-border bg-surface/55" aria-label={`${RESOURCE_STATUS_LABELS[status]}资源列表`}>
            {visible.length === 0 ? (
              <div className="px-6 py-20 text-center">
                {status === '想读' ? <Inbox aria-hidden="true" className="mx-auto size-6 text-muted" /> : <BookOpenText aria-hidden="true" className="mx-auto size-6 text-muted" />}
                <p className="mt-3 text-sm font-medium text-foreground">当前视图没有资源</p>
                <p className="mt-1 text-xs text-muted">调整筛选，或添加一个新链接。</p>
              </div>
            ) : visible.map((resource) => (
              <button key={resource.id} type="button" onClick={() => setSelectedId(resource.id)} className={`block w-full border-b border-border px-4 py-4 text-left transition-colors ${selected?.id === resource.id ? 'bg-card' : 'hover:bg-card/65'}`}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="line-clamp-2 text-sm leading-5 text-card-foreground">{resource.title}</strong>
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">{resource.type}</span>
                </div>
                <p className="mt-1.5 truncate text-xs text-muted">{resource.siteName ?? new URL(resource.url).hostname}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-sm bg-border"><span className="block h-full bg-primary" style={{ width: `${resource.progress}%` }} /></div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>{resource.concepts.slice(0, 2).map((concept) => concept.name).join(' · ') || '未关联 Concept'}</span><span>{resource.progress}%</span></div>
              </button>
            ))}
          </aside>

          {selected ? (
            <ResourceDetailPanel
              key={`${selected.id}:${selected.progress}:${selected.highlights.length}`}
              resource={selected}
              onEdit={() => setFormMode('edit')}
              onDelete={() => setDeleteOpen(true)}
              onUpdateProgress={(progress, nextStatus) => void updateProgress(progress, nextStatus)}
              onAddHighlight={addHighlight}
              onDeleteHighlight={(id) => void removeHighlight(id)}
              busy={busy}
            />
          ) : (
            <div className="flex items-center justify-center text-sm text-muted">选择左侧资源查看详情</div>
          )}
        </div>
      </div>

      {formMode ? (
        <ResourceFormDialog
          key={`${formMode}:${selected?.id ?? 'new'}`}
          resource={formMode === 'edit' ? selected : null}
          terms={initialTerms}
          busy={busy}
          onOpenChange={(open) => { if (!open) setFormMode(null); }}
          onSave={(input) => void saveResource(input)}
        />
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold">删除资源</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted">将删除该资源、全部摘录和聊天来源关联；此操作不可撤销。</DialogDescription>
          <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteOpen(false)}>取消</Button><Button variant="danger" loading={busy} onClick={() => void removeResource()}>确认删除</Button></div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
