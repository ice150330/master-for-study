import { describe, expect, it } from 'vitest';
import { layoutTree } from '../src/lib/tree-layout';

describe('layoutTree 树布局', () => {
  it('单节点：位于原点，无边', () => {
    const l = layoutTree({ id: 'a', label: 'A', children: [] });
    expect(l.nodes).toHaveLength(1);
    expect(l.edges).toHaveLength(0);
    expect(l.nodes[0]).toMatchObject({ id: 'a', x: 0, y: 0, depth: 0 });
  });

  it('父子：父在左，父纵向居中于两子，叶子按顺序排布', () => {
    const l = layoutTree({
      id: 'a',
      label: 'A',
      children: [
        { id: 'b', label: 'B', children: [] },
        { id: 'c', label: 'C', children: [] },
      ],
    });
    const a = l.nodes.find((n) => n.id === 'a')!;
    const b = l.nodes.find((n) => n.id === 'b')!;
    const c = l.nodes.find((n) => n.id === 'c')!;

    expect(a.depth).toBe(0);
    expect(b.depth).toBe(1);
    expect(c.depth).toBe(1);
    expect(b.y).toBe(0);
    expect(c.y).toBe(1);
    expect(a.y).toBeCloseTo(0.5);
    expect(l.edges).toEqual([
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ]);
  });

  it('三层嵌套：深度递增，边连接父子', () => {
    const l = layoutTree({
      id: 'a',
      label: 'A',
      children: [
        {
          id: 'b',
          label: 'B',
          children: [{ id: 'd', label: 'D', children: [] }],
        },
        { id: 'c', label: 'C', children: [] },
      ],
    });
    const d = l.nodes.find((n) => n.id === 'd')!;
    expect(d.depth).toBe(2);
    expect(l.edges).toContainEqual({ from: 'b', to: 'd' });
  });
});
