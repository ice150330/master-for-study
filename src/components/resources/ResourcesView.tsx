'use client';

import { useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';

type Resource = {
  id: string;
  termId: string | null;
  title: string;
  type: string;
  url: string;
  status: string;
  note: string | null;
  createdAt: string;
};

type Term = { id: string; name: string };

const RESOURCE_TYPES = ['教程', '文档', '书籍', '视频', '博客', 'GitHub'];
const STATUSES = ['想读', '在读', '已读'] as const;

export function ResourcesView({
  initialResources,
  initialTerms,
}: {
  initialResources: Resource[];
  initialTerms: Term[];
}) {
  const [resources, setResources] = useState<Resource[]>(initialResources);
  const [filter, setFilter] = useState<'全部' | (typeof STATUSES)[number]>('全部');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('教程');
  const [url, setUrl] = useState('');
  const [termId, setTermId] = useState('');
  const [busy, setBusy] = useState(false);

  const termName = new Map(initialTerms.map((t) => [t.id, t.name]));

  async function loadResources() {
    const res = await fetch('/api/resources');
    if (res.ok) setResources(((await res.json()) as { resources: Resource[] }).resources);
  }

  async function add() {
    if (!title.trim() || !url.trim() || busy) return;
    setBusy(true);
    try {
      await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, url, termId: termId || null }),
      });
      setTitle('');
      setUrl('');
      setTermId('');
      await loadResources();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    await fetch('/api/resources', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadResources();
  }

  const visible = filter === '全部' ? resources : resources.filter((r) => r.status === filter);

  return (
    <PageShell title="资源库" description="学什么料，按术语组织">

      {/* 添加资源 */}
      <div className="mb-6 rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-card-foreground">添加资源</h2>
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题，如「MDN HTTP 缓存」"
            className="rounded-xl border border-border bg-card-soft px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-card-foreground/50 focus:border-primary"
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-border bg-card-soft px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="链接 URL"
              className="flex-1 rounded-xl border border-border bg-card-soft px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-card-foreground/50 focus:border-primary"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-card-soft px-3 py-2 text-sm text-card-foreground outline-none focus:border-primary"
            >
              <option value="">（不关联术语）</option>
              {initialTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={add}
              disabled={!title.trim() || !url.trim() || busy}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? '添加中…' : '添加'}
            </button>
          </div>
        </div>
      </div>

      {/* 状态过滤 */}
      <div className="mb-4 flex gap-2">
        {(['全部', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === s ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 资源列表 */}
      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">暂无资源，添加一个试试</p>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
              <div className="min-w-0">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-medium text-foreground hover:text-accent"
                >
                  {r.title}
                </a>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded bg-card-soft px-1.5 py-0.5">{r.type}</span>
                  {r.termId && (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-accent">
                      {termName.get(r.termId) ?? ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeStatus(r.id, s)}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      r.status === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground/60'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
