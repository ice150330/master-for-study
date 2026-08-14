'use client';

import { BookOpenText, ExternalLink, Highlighter, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Field';
import { RESOURCE_STATUSES, RESOURCE_STATUS_LABELS } from '@/lib/resources/types';
import type { ResourceDto } from './types';

export function ResourceDetailPanel({
  resource,
  onEdit,
  onDelete,
  onUpdateProgress,
  onAddHighlight,
  onDeleteHighlight,
  busy,
}: {
  resource: ResourceDto;
  onEdit(): void;
  onDelete(): void;
  onUpdateProgress(progress: number, status: ResourceDto['status']): void;
  onAddHighlight(input: { excerpt: string; note: string; locator: string }): Promise<boolean>;
  onDeleteHighlight(id: string): void;
  busy: boolean;
}) {
  const [progress, setProgress] = useState(resource.progress);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [note, setNote] = useState('');
  const [locator, setLocator] = useState('');
  const status = progress >= 100 ? '已读' : resource.status;
  return (
    <section className="min-w-0" aria-labelledby="resource-detail-title">
      <header className="flex items-start justify-between gap-5 border-b border-border px-6 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{resource.type}</span>
            {resource.siteName ? <><span>·</span><span>{resource.siteName}</span></> : null}
          </div>
          <h2 id="resource-detail-title" className="mt-2 text-xl font-semibold leading-7 text-card-foreground">{resource.title}</h2>
          {resource.author ? <p className="mt-1 text-xs text-muted">{resource.author}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground" title="打开原文" aria-label="打开原文">
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          <button type="button" onClick={onEdit} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground" title="编辑资源" aria-label="编辑资源">
            <Pencil aria-hidden="true" className="size-4" />
          </button>
          <button type="button" onClick={onDelete} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" title="删除资源" aria-label="删除资源">
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-7 px-6 py-5 min-[1180px]:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {resource.description ? <p className="text-sm leading-6 text-muted">{resource.description}</p> : null}

          <section className="mt-6 border-y border-border py-5" aria-labelledby="resource-highlights-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 id="resource-highlights-title" className="text-sm font-semibold text-card-foreground">摘录与注释</h3>
                <p className="mt-1 text-xs text-muted">{resource.highlights.length} 条，保留原文定位</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAddingHighlight((value) => !value)}>
                <Plus aria-hidden="true" className="size-4" />
                添加摘录
              </Button>
            </div>

            {addingHighlight ? (
              <div className="mt-4 grid gap-3 rounded-md bg-surface p-4">
                <Textarea aria-label="摘录原文" className="min-h-28" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="粘贴原文片段…" />
                <div className="grid gap-3 min-[900px]:grid-cols-2">
                  <Input aria-label="来源定位" value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="章节、页码或段落" />
                  <Input aria-label="摘录注释" value={note} onChange={(event) => setNote(event.target.value)} placeholder="这段内容说明了什么" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAddingHighlight(false)}>取消</Button>
                  <Button size="sm" disabled={!excerpt.trim()} loading={busy} onClick={async () => {
                    const saved = await onAddHighlight({ excerpt: excerpt.trim(), note: note.trim(), locator: locator.trim() });
                    if (saved) {
                      setExcerpt(''); setNote(''); setLocator(''); setAddingHighlight(false);
                    }
                  }}>保存摘录</Button>
                </div>
              </div>
            ) : null}

            {resource.highlights.length === 0 && !addingHighlight ? (
              <div className="py-10 text-center">
                <Highlighter aria-hidden="true" className="mx-auto size-5 text-muted" />
                <p className="mt-2 text-xs text-muted">阅读时把关键原文和你的判断留在这里</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                {resource.highlights.map((highlight) => (
                  <blockquote key={highlight.id} className="group border-l-2 border-primary pl-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-card-foreground">{highlight.excerpt}</p>
                        {highlight.note ? <p className="mt-2 text-xs leading-5 text-muted">注释：{highlight.note}</p> : null}
                        {highlight.locator ? <p className="mt-1 text-[11px] text-primary">来源：{highlight.locator}</p> : null}
                      </div>
                      <button type="button" aria-label="删除摘录" title="删除摘录" onClick={() => onDeleteHighlight(highlight.id)} className="opacity-0 text-muted transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100">
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </blockquote>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6" aria-labelledby="resource-note-title">
            <h3 id="resource-note-title" className="text-sm font-semibold text-card-foreground">文档笔记</h3>
            {resource.note ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{resource.note}</p> : <p className="mt-3 text-xs text-muted">尚未记录这份资源的学习目的或总结。</p>}
          </section>
        </div>

        <aside className="border-l border-border pl-5" aria-label="资源学习状态">
          <h3 className="text-xs font-semibold text-card-foreground">阅读进度</h3>
          <div className="mt-3 flex items-end justify-between">
            <strong className="font-mono text-2xl tabular-nums text-card-foreground">{progress}%</strong>
            <span className="text-xs text-muted">{RESOURCE_STATUS_LABELS[status]}</span>
          </div>
          <input aria-label="阅读进度" className="mt-3 w-full accent-primary" type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          <Button className="mt-3 w-full" size="sm" variant="outline" disabled={progress === resource.progress} onClick={() => onUpdateProgress(progress, status)}>
            <Save aria-hidden="true" className="size-3.5" />
            保存进度
          </Button>

          <div className="mt-6 border-y border-border py-5">
            <p className="text-xs font-semibold text-card-foreground">队列位置</p>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-surface p-1">
              {RESOURCE_STATUSES.map((item) => (
                <button key={item} type="button" onClick={() => {
                  const nextProgress = item === '已读' ? 100 : item === '在读' && progress === 0 ? 5 : progress;
                  setProgress(nextProgress);
                  onUpdateProgress(nextProgress, item);
                }} className={`h-8 rounded-[5px] text-[11px] font-medium ${resource.status === item ? 'bg-card text-card-foreground shadow-sm' : 'text-muted'}`}>
                  {RESOURCE_STATUS_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold text-card-foreground">关联 Concept</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {resource.concepts.length ? resource.concepts.map((concept) => (
                <Link key={concept.id} href={`/?concept=${concept.id}`} className="rounded-md bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/15">{concept.name}</Link>
              )) : <span className="text-xs text-muted">未关联</span>}
            </div>
          </div>

          {resource.tags.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold text-card-foreground">标签</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{resource.tags.map((tag) => <span key={tag} className="rounded-md bg-surface px-2 py-1 text-[11px] text-muted">{tag}</span>)}</div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted">
            <BookOpenText aria-hidden="true" className="size-4" />
            保存于 {new Date(resource.createdAt).toLocaleDateString('zh-CN')}
          </div>
        </aside>
      </div>
    </section>
  );
}
