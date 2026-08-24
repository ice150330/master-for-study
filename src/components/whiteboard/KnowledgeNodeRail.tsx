'use client';

import { BookOpenText, Brain, ExternalLink, FileText, Highlighter, MessageCircleMore, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { KNOWLEDGE_RELATION_LABELS, type KnowledgeGraph, type KnowledgeGraphNode } from '@/lib/knowledge/types';

const masteryLabel = { new: '新发现', learning: '学习中', reviewing: '复习中', relearning: '再学习' };

export function KnowledgeNodeRail({
  node,
  graph,
  onClose,
  onRecenter,
}: {
  node: KnowledgeGraphNode;
  graph: KnowledgeGraph;
  onClose(): void;
  onRecenter(id: string): void;
}) {
  const neighbors = graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id).map((edge) => {
    const id = edge.source === node.id ? edge.target : edge.source;
    return { edge, node: graph.nodes.find((item) => item.id === id) };
  }).filter((item): item is { edge: KnowledgeGraph['edges'][number]; node: KnowledgeGraphNode } => Boolean(item.node));
  const evidence = [
    ['对话', node.evidence.messages, MessageCircleMore],
    ['笔记', node.evidence.notes, FileText],
    ['资源', node.evidence.resources, BookOpenText],
    ['面试', node.evidence.interviews, Brain],
    ['实践', node.evidence.practice, Highlighter],
    ['复习', node.evidence.reviews, RotateCw],
  ] as const;
  return (
    <aside className="paper-subtle flex h-full min-h-0 flex-col border-l border-dashed border-border" aria-label="知识节点详情">
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted">{node.kind === 'domain' ? '知识领域' : node.kind === 'session' ? '会话节点' : '知识对象'}</p>
          <h2 className="doodle-heading mt-1 truncate text-base font-extrabold text-card-foreground">{node.label}</h2>
        </div>
        <IconButton label="关闭节点详情" onClick={onClose}><X aria-hidden="true" /></IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {node.masteryState ? <span className="rotate-[-1deg] rounded-[2px] border border-dashed border-primary bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground shadow-[2px_2px_0_rgba(255,107,107,0.24)]">{masteryLabel[node.masteryState]}</span> : null}
        {node.description ? <p className="mt-3 text-sm leading-6 text-card-foreground">{node.description}</p> : null}

        {node.kind === 'concept' ? (
          <section className="mt-5 border-t border-dashed border-border pt-4">
            <h3 className="text-xs font-semibold text-card-foreground">掌握依据</h3>
            <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4">
              {evidence.map(([label, value, Icon]) => (
                <div key={label}>
                  <span className="flex items-center gap-1 text-[10px] text-muted"><Icon aria-hidden="true" className="size-3" />{label}</span>
                  <strong className="mt-1 block text-base font-extrabold tabular-nums text-card-foreground">{value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 border-t border-dashed border-border pt-4">
          <h3 className="text-xs font-semibold text-card-foreground">直接关系</h3>
          {neighbors.length ? <div className="mt-2 space-y-1">
            {neighbors.map(({ edge, node: related }) => (
              <button key={edge.id} type="button" onClick={() => onRecenter(related.id)} className="doodle-row flex w-full items-center justify-between gap-3 rounded-[2px] border border-dashed border-transparent px-2 py-2 text-left hover:bg-highlight/15">
                <span className="truncate text-xs text-card-foreground">{related.label}</span>
                <span className="shrink-0 text-[10px] text-muted">{edge.relation === 'branch' ? '分支' : KNOWLEDGE_RELATION_LABELS[edge.relation]}</span>
              </button>
            ))}
          </div> : <p className="mt-2 text-xs text-muted">当前筛选下没有直接关系。</p>}
        </section>
      </div>
      <div className="shrink-0 border-t border-dashed border-border p-4">
        {graph.mode === 'knowledge' ? <Button className="w-full" variant="outline" onClick={() => onRecenter(node.id)}>以此为中心</Button> : null}
        {node.href ? (
          <a href={node.href} className="doodle-action mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-[2px] border-2 border-dashed border-foreground bg-card px-3 text-sm font-semibold text-foreground hover:-translate-x-px hover:-translate-y-px">
            {node.kind === 'session' ? '返回会话' : '打开知识对象'}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
        {node.termId ? <div className="mt-2 grid grid-cols-3 gap-1">
          <RailLink href={`/notes?concept=${node.termId}`} label="笔记" />
          <RailLink href={`/interview?concept=${node.termId}`} label="测验" />
          <RailLink href={`/review?concept=${node.termId}`} label="复习" />
        </div> : null}
      </div>
    </aside>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return <a href={href} className="doodle-row flex h-8 items-center justify-center rounded-[2px] border border-dashed border-border bg-surface text-[11px] font-semibold text-card-foreground hover:bg-highlight/15">{label}</a>;
}
