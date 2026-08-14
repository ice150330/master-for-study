import { describe, expect, it } from 'vitest';
import { layoutLocalGraph } from '../src/lib/knowledge/layout';
import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '../src/lib/knowledge/types';

const evidence = { messages: 0, notes: 0, resources: 0, interviews: 0, practice: 0, reviews: 0 };
const nodes: KnowledgeGraphNode[] = ['center', 'alpha', 'beta', 'gamma'].map((id) => ({
  id,
  label: id,
  kind: 'concept',
  termId: id,
  description: null,
  masteryState: null,
  evidence,
  href: null,
  position: null,
}));
const edges: KnowledgeGraphEdge[] = [
  { id: '1', source: 'center', target: 'alpha', relation: 'related', weight: 1, evidenceType: 'mention' },
  { id: '2', source: 'alpha', target: 'beta', relation: 'related', weight: 1, evidenceType: 'mention' },
  { id: '3', source: 'center', target: 'gamma', relation: 'related', weight: 1, evidenceType: 'mention' },
];

describe('局部知识图布局', () => {
  it('按一跳和二跳分环并保持节点坐标互异', () => {
    const result = layoutLocalGraph(nodes, edges, 'center');
    expect(result.get('center')).toEqual({ x: -92, y: -34 });
    expect(result.get('alpha')).not.toEqual(result.get('gamma'));
    expect(Math.abs(result.get('beta')?.y ?? 0)).toBeGreaterThan(300);
  });

  it('优先使用用户保存的位置', () => {
    const withSaved = nodes.map((node) => node.id === 'alpha' ? { ...node, position: { x: 88, y: 66 } } : node);
    expect(layoutLocalGraph(withSaved, edges, 'center').get('alpha')).toEqual({ x: 88, y: 66 });
  });
});
