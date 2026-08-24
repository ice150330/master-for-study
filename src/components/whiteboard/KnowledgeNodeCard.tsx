'use client';

import { BookOpenText, FolderTree, MessageCircleMore } from 'lucide-react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { KnowledgeGraphNode } from '@/lib/knowledge/types';

export type KnowledgeFlowNode = Node<{
  node: KnowledgeGraphNode;
  center: boolean;
}, 'knowledge'>;

const masteryDot = {
  new: 'bg-primary',
  learning: 'bg-warning',
  reviewing: 'bg-accent',
  relearning: 'bg-danger',
};

export function KnowledgeNodeCard({ data, selected }: NodeProps<KnowledgeFlowNode>) {
  const item = data.node;
  const evidenceCount = Object.values(item.evidence).reduce((sum, value) => sum + value, 0);
  const Icon = item.kind === 'session' ? MessageCircleMore : item.kind === 'domain' ? FolderTree : BookOpenText;
  return (
    <div className={`paper-control h-[68px] w-[184px] rounded-[2px] border-2 border-dashed px-3 py-2.5 transition-[border-color,box-shadow,transform] ${selected ? '-translate-x-px -translate-y-px rotate-[-0.35deg] border-primary shadow-[var(--shadow-marker)]' : data.center ? 'rotate-[0.25deg] border-primary/70 shadow-[3px_3px_0_var(--marker-yellow)]' : 'hover:-translate-y-px hover:border-accent hover:shadow-[3px_3px_0_rgba(78,205,196,0.36)]'}`}>
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-card !bg-muted" />
      <div className="flex items-center gap-2">
        <span className={`flex size-7 shrink-0 rotate-[-1deg] items-center justify-center rounded-[2px] border border-dashed ${data.center ? 'border-foreground bg-highlight text-foreground' : 'border-border bg-surface text-muted'}`}>
          <Icon aria-hidden="true" className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs font-semibold text-card-foreground" title={item.label}>{item.label}</strong>
          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
            {item.masteryState ? <span className={`size-1.5 rounded-full ${masteryDot[item.masteryState]}`} /> : null}
            <span>{item.kind === 'domain' ? '领域' : item.kind === 'session' ? item.description : `${evidenceCount} 条证据`}</span>
          </span>
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-card !bg-muted" />
    </div>
  );
}
