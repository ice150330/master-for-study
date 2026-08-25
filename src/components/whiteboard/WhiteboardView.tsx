'use client';

import { Check, Filter, Flag, GitBranch, LoaderCircle, Network, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { MetaChip } from '@/components/ui/MetaChip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { KNOWLEDGE_RELATIONS, KNOWLEDGE_RELATION_LABELS, type KnowledgeGraph, type KnowledgeRelation } from '@/lib/knowledge/types';
import { KnowledgeCanvas } from './KnowledgeCanvas';
import { KnowledgeNodeRail } from './KnowledgeNodeRail';

export function WhiteboardView({
  initialKnowledgeGraph,
  initialSessionGraph,
  growthGoal,
}: {
  initialKnowledgeGraph: KnowledgeGraph;
  initialSessionGraph: KnowledgeGraph;
  /** B3 目标主线：展示当前成长目标，命中节点已在服务端打 mainline 标 */
  growthGoal?: string | null;
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
    <PageShell
      pageKey="whiteboard"
      width="xl"
      meta={growthGoal ? (
        <MetaChip icon={<Flag aria-hidden="true" />} tone="accent">目标主线 · {growthGoal}</MetaChip>
      ) : undefined}
      filters={(
        <>
          <SegmentedControl
            value={mode}
            onValueChange={(value) => switchMode(value as 'knowledge' | 'session')}
            ariaLabel="白板视图"
            items={[
              { value: 'knowledge', label: '知识关系', icon: <Network aria-hidden="true" /> },
              { value: 'session', label: '会话分支', icon: <GitBranch aria-hidden="true" /> },
            ]}
          />
          {mode === 'knowledge' ? (
            <SegmentedControl
              value={String(depth)}
              onValueChange={(value) => void loadKnowledge({ depth: Number(value) as 1 | 2 })}
              ariaLabel="关系深度"
              items={[{ value: '1', label: '1 跳' }, { value: '2', label: '2 跳' }]}
            />
          ) : null}
          {mode === 'knowledge' ? (
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm"><Filter aria-hidden="true" className="size-3.5" />关系 {relations.length}</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-2">
                {KNOWLEDGE_RELATIONS.map((relation) => {
                  const checked = relations.includes(relation);
                  return <button key={relation} type="button" onClick={() => {
                    const next = checked ? relations.filter((item) => item !== relation) : [...relations, relation];
                    if (next.length) void loadKnowledge({ relations: next });
                  }} className="doodle-row flex w-full items-center gap-2 rounded-[2px] border border-dashed border-transparent px-2 py-2 text-left text-xs hover:bg-highlight/15"><span className={`flex size-4 rotate-[-1deg] items-center justify-center rounded-[2px] border border-dashed ${checked ? 'border-foreground bg-highlight text-foreground' : 'border-border'}`}>{checked ? <Check aria-hidden="true" className="size-3" /> : null}</span>{KNOWLEDGE_RELATION_LABELS[relation]}</button>;
                })}
              </PopoverContent>
            </Popover>
          ) : null}
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-2 size-4 text-muted" />
            <Input aria-label="搜索白板节点" className="w-52 pl-9" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="搜索知识对象" />
            {searchOpen && query.trim() ? <div className="paper-popover absolute right-0 top-10 z-30 w-80 rounded-[2px] border-2 border-dashed p-1">
              {searchResults.length ? searchResults.map((result) => <button key={result.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSearchResult(result.id)} className="doodle-row flex w-full items-center justify-between rounded-[2px] border border-dashed border-transparent px-3 py-2 text-left hover:bg-highlight/15"><span className="truncate text-xs text-card-foreground">{result.label}</span><span className="text-[10px] text-muted">{result.kind === 'domain' ? '领域' : result.kind === 'session' ? '会话' : 'Concept'}</span></button>) : <p className="px-3 py-4 text-center text-xs text-muted">没有匹配节点</p>}
            </div> : null}
          </div>
        </>
      )}
    >
      {error ? <InlineNotice className="mb-4" tone="error" title="白板操作未完成" description={error} actionLabel="重试" onAction={() => mode === 'knowledge' && void loadKnowledge({})} /> : null}
      <div className="paper-panel overflow-hidden rounded-[2px] border-2 border-dashed">
        <div className={`grid h-[calc(100vh-13.5rem)] min-h-[600px] max-h-[720px] ${selected ? 'grid-cols-[minmax(0,1fr)_19rem]' : 'grid-cols-1'}`}>
          <div className="relative min-w-0">
            {loading ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-card/70 text-sm text-muted"><LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" />正在更新局部图</div> : null}
            <div className="paper-control absolute left-4 top-4 z-10 rotate-[-0.4deg] rounded-[2px] border border-dashed px-3 py-2 text-[11px] text-muted">{activeGraph.nodes.length} / {activeGraph.totalNodes} 个节点 · {activeGraph.edges.length} 条关系</div>
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
