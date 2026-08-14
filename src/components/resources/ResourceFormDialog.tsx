'use client';

import { Check, Link2, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { RESOURCE_TYPES } from '@/lib/resources/types';
import type { ResourceDto, ResourceFormValue, ResourceMetadataDto } from './types';

export function ResourceFormDialog({
  resource,
  terms,
  busy,
  onOpenChange,
  onSave,
}: {
  resource?: ResourceDto | null;
  terms: Array<{ id: string; name: string }>;
  busy: boolean;
  onOpenChange(open: boolean): void;
  onSave(input: { url: string; metadata: ResourceMetadataDto; form: ResourceFormValue }): void;
}) {
  const editing = Boolean(resource);
  const [url, setUrl] = useState(resource?.url ?? '');
  const [metadata, setMetadata] = useState<ResourceMetadataDto | null>(resource ? {
    title: resource.title,
    canonicalUrl: resource.canonicalUrl,
    siteName: resource.siteName,
    author: resource.author,
    description: resource.description,
    faviconUrl: resource.faviconUrl,
    type: resource.type,
  } : null);
  const [form, setForm] = useState<ResourceFormValue>({
    title: resource?.title ?? '',
    type: resource?.type ?? '教程',
    conceptIds: resource?.concepts.map((concept) => concept.id) ?? [],
    tags: resource?.tags ?? [],
    note: resource?.note ?? '',
  });
  const [tagInput, setTagInput] = useState(resource?.tags.join(', ') ?? '');
  const [conceptSearch, setConceptSearch] = useState('');
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  async function inspect() {
    if (!url.trim() || metadataBusy) return;
    setMetadataBusy(true);
    setMetadataError(null);
    try {
      const data = await requestJson<{ metadata: ResourceMetadataDto }>('/api/resources/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      setMetadata(data.metadata);
      setForm((value) => ({ ...value, title: data.metadata.title, type: data.metadata.type }));
    } catch (error) {
      setMetadataError(getErrorMessage(error, '无法自动读取网页信息'));
      setMetadata({
        title: '',
        canonicalUrl: null,
        siteName: null,
        author: null,
        description: null,
        faviconUrl: null,
        type: '教程',
      });
    } finally {
      setMetadataBusy(false);
    }
  }

  const visibleTerms = terms.filter((term) => term.name.toLocaleLowerCase().includes(conceptSearch.toLocaleLowerCase()));
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,44rem)] max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-base font-semibold">{editing ? '编辑资源' : '添加到资源收件箱'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted">
          {editing ? '修改阅读状态、标签、Concept 和文档笔记。' : '先读取链接元数据，再确认资源的学习归属。'}
        </DialogDescription>

        {!editing ? (
          <div className="mt-5 flex gap-2">
            <Input aria-label="资源链接" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" disabled={Boolean(metadata)} />
            <Button variant="outline" loading={metadataBusy} disabled={!url.trim() || Boolean(metadata)} onClick={() => void inspect()}>
              <Link2 aria-hidden="true" className="size-4" />
              读取信息
            </Button>
          </div>
        ) : null}

        {metadataError ? (
          <InlineNotice className="mt-3" tone="error" title="自动提取失败，可手动填写" description={metadataError} />
        ) : null}

        {metadata ? (
          <div className="mt-5 grid gap-5">
            <div className="grid gap-4 min-[680px]:grid-cols-[minmax(0,1fr)_11rem]">
              <Field label="标题" htmlFor="resource-title">
                <Input id="resource-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field label="类型" htmlFor="resource-type">
                <select id="resource-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ResourceDto['type'] })} className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm">
                  {RESOURCE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
            </div>

            {metadata.description || metadata.siteName ? (
              <div className="rounded-md bg-surface px-3 py-2.5 text-xs leading-5 text-muted">
                <strong className="text-card-foreground">{metadata.siteName ?? new URL(url).hostname}</strong>
                {metadata.author ? ` · ${metadata.author}` : ''}
                {metadata.description ? <p className="mt-1 line-clamp-2">{metadata.description}</p> : null}
              </div>
            ) : null}

            <Field label="关联 Concept" htmlFor="concept-search" hint="可多选，资源会出现在每个知识对象的来源轨道中。">
              <div className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center gap-2 border-b border-border px-3">
                  <Search aria-hidden="true" className="size-4 text-muted" />
                  <input id="concept-search" value={conceptSearch} onChange={(event) => setConceptSearch(event.target.value)} placeholder="搜索 Concept" className="h-9 flex-1 bg-transparent text-sm outline-none" />
                </div>
                <div className="grid max-h-36 grid-cols-2 gap-1 overflow-y-auto p-2">
                  {visibleTerms.map((term) => {
                    const selected = form.conceptIds.includes(term.id);
                    return (
                      <button key={term.id} type="button" onClick={() => setForm({ ...form, conceptIds: selected ? form.conceptIds.filter((id) => id !== term.id) : [...form.conceptIds, term.id] })} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface">
                        <span className={`flex size-4 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{selected ? <Check aria-hidden="true" className="size-3" /> : null}</span>
                        <span className="truncate">{term.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Field>

            <Field label="标签" htmlFor="resource-tags" hint="用逗号分隔，标签仅作为次级过滤条件。">
              <Input id="resource-tags" value={tagInput} onChange={(event) => {
                const value = event.target.value;
                setTagInput(value);
                setForm({ ...form, tags: value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) });
              }} placeholder="后端, 数据库" />
            </Field>
            <Field label="文档笔记" htmlFor="resource-note">
              <Textarea id="resource-note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="为什么保存、准备从中解决什么问题…" />
            </Field>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!metadata || !form.title.trim()} loading={busy} onClick={() => metadata && onSave({ url: url.trim(), metadata, form })}>
            {editing ? '保存修改' : '加入收件箱'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
