import type { KnowledgeGraphEdge, KnowledgeGraphNode } from './types';

const LEVEL_RADIUS = [0, 240, 440];

/**
 * 局部图确定性布局：中心节点固定，邻居按跳数分环；用户保存过的位置优先。
 * 返回的是节点左上角坐标，方便直接交给 React Flow。
 */
export function layoutLocalGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  centerId: string | null,
) {
  if (nodes.length === 0) return new Map<string, { x: number; y: number }>();
  const center = centerId && nodes.some((node) => node.id === centerId) ? centerId : nodes[0].id;
  const distances = graphDistances(nodes, edges, center);
  const positions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    if (node.position) positions.set(node.id, node.position);
  }
  const levels = new Map<number, KnowledgeGraphNode[]>();
  for (const node of nodes) {
    if (positions.has(node.id)) continue;
    const level = Math.min(2, distances.get(node.id) ?? 2);
    levels.set(level, [...(levels.get(level) ?? []), node]);
  }
  for (const [level, levelNodes] of levels) {
    const ordered = [...levelNodes].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
    if (level === 0) {
      positions.set(ordered[0].id, { x: -92, y: -34 });
      continue;
    }
    ordered.forEach((node, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / ordered.length;
      const radius = LEVEL_RADIUS[level];
      positions.set(node.id, {
        x: Math.round(Math.cos(angle) * radius - 92),
        y: Math.round(Math.sin(angle) * radius - 34),
      });
    });
  }
  return positions;
}

function graphDistances(nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[], centerId: string) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const distances = new Map<string, number>([[centerId, 0]]);
  const queue = [centerId];
  while (queue.length) {
    const current = queue.shift() as string;
    const nextDistance = (distances.get(current) ?? 0) + 1;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
    }
  }
  return distances;
}
