'use client';

import { Check, Filter, LoaderCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { KNOWLEDGE_RELATIONS, KNOWLEDGE_RELATION_LABELS, type KnowledgeGraph, type KnowledgeRelation } from '@/lib/knowledge/types';
import { KnowledgeCanvas } from './KnowledgeCanvas';
import { KnowledgeNodeRail } from './KnowledgeNodeRail';

export function WhiteboardView({
  initialKnowledgeGraph,
  initialSessionGraph,
}: {
  initialKnowledgeGraph: KnowledgeGraph;
  initialSessionGraph: KnowledgeGraph;
}) {
  const [graph, setGraph] = useState(initialKnowledgeGraph);
  const [sessionGraph] = useState(initialSessionGraph);
  const [mode, setMode] = useState<'knowledge' | 'session'>('knowledge');
  const [depth, setDepth] = useState<1 | 2>(initialKnowledgeGraph.depth);
  const [relations, setRelations] = useState<KnowledgeRelation[]>([...KNOWLEDGE_RELATIONS]);
  const [selectedId, setSelectedId] = useState<string | null>(initialKnowledgeGraph.centerId);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const activeGraph = mode === 'knowledge' ? graph : sessionGraph;
  const selected = activeGraph.nodes.find((node) => node.id === selectedId) ?? null;
  const searchResults = useMemo(() => activeGraph.searchOptions.filter((node) => node.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 10), [activeGraph.searchOptions, query]);

  async function loadKnowledge(next: { centerId?: string; depth?: 1 | 2; relations?: KnowledgeRelation[] }) {
    const centerId = next.centerId ?? graph.centerId ?? undefined;
    const nextDepth = next.depth ?? depth;
    const nextRelations = next.relations ?? relations;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ depth: String(nextDepth) });
      if (centerId) params.set('center', centerId);
      nextRelations.forEach((relation) => params.append('relation', relation));
      const data = await requestJson<{ graph: KnowledgeGraph }>(`/api/knowledge-graph?${params}`);
      setGraph(data.graph);
      setDepth(nextDepth);
      setRelations(nextRelations);
      setSelectedId(data.graph.centerId);
      setCanvasVersion((value) => value + 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '知识图加载失败'));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: 'knowledge' | 'session') {
    setMode(nextMode);
    const target = nextMode === 'knowledge' ? graph : sessionGraph;
    setSelectedId(target.centerId);
    setQuery('');
    setCanvasVersion((value) => value + 1);
  }

  async function savePosition(id: string, x: number, y: number) {
    if (mode !== 'knowledge') return;
    try {
      await requestJson('/api/knowledge-graph', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: id, x, y, viewKey: 'knowledge', idempotencyKey: createIdempotencyKey('knowledge-layout') }),
      });
      setGraph((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { x, y } } : node) }));
    } catch (requestError) {
      setError(getErrorMessage(requestError, '节点位置保存失败'));
    }
  }

  function selectSearchResult(id: string) {
    setQuery(activeGraph.searchOptions.find((node) => node.id === id)?.label ?? '');
    setSearchOpen(false);
    if (mode === 'knowledge') void loadKnowledge({ centerId: id });
    else setSelectedId(id);
  }

  return (
    <PageShell title="知识白板" description="围绕当前知识对象查看关系、证据与下一步" width="xl">
      {error ? <InlineNotice className="mb-4" tone="error" title="白板操作未完成" description={error} actionLabel="重试" onAction={() => mode === 'knowledge' && void loadKnowledge({})} /> : null}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-3">
          <div className="flex rounded-md bg-surface p-1" role="tablist" aria-label="白板视图">
            <button role="tab" aria-selected={mode === 'knowledge'} type="button" onClick={() => switchMode('knowledge')} className={`h-8 rounded-[5px] px-3 text-xs font-medium ${mode === 'knowledge' ? 'bg-card text-card-foreground shadow-sm' : 'text-muted'}`}>知识关系</button>
            <button role="tab" aria-selected={mode === 'session'} type="button" onClick={() => switchMode('session')} className={`h-8 rounded-[5px] px-3 text-xs font-medium ${mode === 'session' ? 'bg-card text-card-foreground shadow-sm' : 'text-muted'}`}>会话分支</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-muted" />
              <Input aria-label="搜索白板节点" className="w-64 pl-9" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="搜索知识对象" />
              {searchOpen && query.trim() ? <div className="absolute right-0 top-11 z-30 w-80 rounded-md border border-border bg-card p-1 shadow-lg">
                {searchResults.length ? searchResults.map((result) => <button key={result.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSearchResult(result.id)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-surface"><span className="truncate text-xs text-card-foreground">{result.label}</span><span className="text-[10px] text-muted">{result.kind === 'domain' ? '领域' : result.kind === 'session' ? '会话' : 'Concept'}</span></button>) : <p className="px-3 py-4 text-center text-xs text-muted">没有匹配节点</p>}
              </div> : null}
            </div>
            {mode === 'knowledge' ? <>
              <div className="flex rounded-md border border-border p-0.5" aria-label="关系深度">
                {([1, 2] as const).map((value) => <button key={value} type="button" aria-pressed={depth === value} onClick={() => void loadKnowledge({ depth: value })} className={`h-8 rounded-[4px] px-2.5 text-xs ${depth === value ? 'bg-primary text-primary-foreground' : 'text-muted'}`}>{value} 跳</button>)}
              </div>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm"><Filter aria-hidden="true" className="size-3.5" />关系 {relations.length}</Button></PopoverTrigger>
                <PopoverContent align="end" className="w-44 p-2">
                  {KNOWLEDGE_RELATIONS.map((relation) => {
                    const checked = relations.includes(relation);
                    return <button key={relation} type="button" onClick={() => {
                      const next = checked ? relations.filter((item) => item !== relation) : [...relations, relation];
                      if (next.length) void loadKnowledge({ relations: next });
                    }} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-surface"><span className={`flex size-4 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{checked ? <Check aria-hidden="true" className="size-3" /> : null}</span>{KNOWLEDGE_RELATION_LABELS[relation]}</button>;
                  })}
                </PopoverContent>
              </Popover>
            </> : null}
          </div>
        </div>

        <div className={`grid h-[calc(100vh-14.25rem)] min-h-[600px] max-h-[720px] ${selected ? 'grid-cols-[minmax(0,1fr)_19rem]' : 'grid-cols-1'}`}>
          <div className="relative min-w-0">
            {loading ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/70 text-sm text-muted"><LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" />正在更新局部图</div> : null}
            <div className="absolute left-4 top-4 z-10 rounded-md border border-border bg-card/90 px-3 py-2 text-[11px] text-muted shadow-sm">{activeGraph.nodes.length} / {activeGraph.totalNodes} 个节点 · {activeGraph.edges.length} 条关系</div>
            <KnowledgeCanvas
              key={`${mode}:${activeGraph.centerId}:${depth}:${relations.join('-')}:${canvasVersion}`}
              graph={activeGraph}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRecenter={(id) => mode === 'knowledge' ? void loadKnowledge({ centerId: id }) : setSelectedId(id)}
              onSavePosition={(id, x, y) => void savePosition(id, x, y)}
            />
          </div>
          {selected ? <KnowledgeNodeRail node={selected} graph={activeGraph} onClose={() => setSelectedId(null)} onRecenter={(id) => mode === 'knowledge' ? void loadKnowledge({ centerId: id }) : setSelectedId(id)} /> : null}
        </div>
      </div>
    </PageShell>
  );
}
