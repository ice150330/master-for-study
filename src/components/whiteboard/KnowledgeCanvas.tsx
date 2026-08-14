'use client';

import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import { layoutLocalGraph } from '@/lib/knowledge/layout';
import { KNOWLEDGE_RELATION_LABELS, type KnowledgeGraph, type KnowledgeGraphEdge } from '@/lib/knowledge/types';
import { KnowledgeNodeCard, type KnowledgeFlowNode } from './KnowledgeNodeCard';

const nodeTypes = { knowledge: KnowledgeNodeCard };
const relationColor: Record<KnowledgeGraphEdge['relation'], string> = {
  part_of: 'var(--muted)',
  prerequisite: 'var(--warning)',
  related: 'var(--primary)',
  applied_in: 'var(--accent)',
  branch: 'var(--primary)',
};

export function KnowledgeCanvas({
  graph,
  selectedId,
  onSelect,
  onRecenter,
  onSavePosition,
}: {
  graph: KnowledgeGraph;
  selectedId: string | null;
  onSelect(id: string): void;
  onRecenter(id: string): void;
  onSavePosition(id: string, x: number, y: number): void;
}) {
  const positions = useMemo(() => layoutLocalGraph(graph.nodes, graph.edges, graph.centerId), [graph]);
  const nodes = useMemo<KnowledgeFlowNode[]>(() => graph.nodes.map((node) => ({
    id: node.id,
    type: 'knowledge',
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    width: 184,
    height: 68,
    data: { node, center: node.id === graph.centerId },
    selected: node.id === selectedId,
    draggable: graph.mode === 'knowledge',
    ariaLabel: `${node.label}，${node.kind === 'concept' ? '知识概念' : node.kind === 'domain' ? '知识领域' : '会话'}`,
  })), [graph, positions, selectedId]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'straight',
    label: edge.relation === 'branch' ? '分支' : KNOWLEDGE_RELATION_LABELS[edge.relation],
    labelStyle: { fill: 'var(--muted)', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.92 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 4,
    style: { stroke: relationColor[edge.relation], strokeWidth: Math.min(3, 1 + edge.weight * 0.35) },
  })), [graph.edges]);
  const handleClick: NodeMouseHandler<KnowledgeFlowNode> = (_event, node) => onSelect(node.id);
  const handleDoubleClick: NodeMouseHandler<KnowledgeFlowNode> = (_event, node) => {
    if (graph.mode === 'knowledge') onRecenter(node.id);
  };

  return (
    <div className="h-full min-h-0 w-full bg-card" data-testid="knowledge-canvas">
      <ReactFlow<KnowledgeFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleClick}
        onNodeDoubleClick={handleDoubleClick}
        onNodeDragStop={(_event, node) => onSavePosition(node.id, node.position.x, node.position.y)}
        nodesConnectable={false}
        deleteKeyCode={null}
        edgesFocusable
        nodesFocusable
        fitView
        fitViewOptions={{ padding: '10%', minZoom: 0.8, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={1.8}
        onlyRenderVisibleElements
        elevateNodesOnSelect
        colorMode="system"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls
          position="bottom-left"
          showInteractive={false}
          aria-label="画布缩放与适配控制"
          fitViewOptions={{ padding: '10%', minZoom: 0.8, maxZoom: 1.1, duration: 220 }}
        />
        {graph.nodes.length > 7 ? (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            ariaLabel="知识图缩略导航"
            nodeColor={(node) => node.id === graph.centerId ? '#6558d9' : '#8b91a0'}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={3}
            nodeBorderRadius={4}
            maskColor="rgba(101, 88, 217, 0.08)"
            style={{ background: 'var(--surface)' }}
          />
        ) : null}
        <AutoFit graphKey={`${graph.mode}:${graph.centerId}:${graph.nodes.length}:${graph.edges.length}`} />
      </ReactFlow>
    </div>
  );
}

function AutoFit({ graphKey }: { graphKey: string }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (initialized) void fitView({ padding: '10%', minZoom: 0.8, maxZoom: 1.1 });
  }, [fitView, graphKey, initialized]);
  return null;
}
