import { describe, expect, it } from 'vitest';
import { buildSessionTree } from '../src/lib/session-tree';

describe('buildSessionTree 会话树组装', () => {
  it('空列表返回空树', () => {
    expect(buildSessionTree([])).toEqual([]);
  });

  it('单个根会话', () => {
    const tree = buildSessionTree([{ id: 'a', parentId: null, title: '根' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children).toEqual([]);
  });

  it('父子层级组装', () => {
    const tree = buildSessionTree([
      { id: 'a', parentId: null, title: '根' },
      { id: 'b', parentId: 'a', title: '子1' },
      { id: 'c', parentId: 'a', title: '子2' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('多级嵌套', () => {
    const tree = buildSessionTree([
      { id: 'a', parentId: null, title: '根' },
      { id: 'b', parentId: 'a', title: '子' },
      { id: 'c', parentId: 'b', title: '孙' },
    ]);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });

  it('孤儿节点（parentId 不存在）视为根', () => {
    const tree = buildSessionTree([{ id: 'x', parentId: 'nonexistent', title: '孤儿' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('x');
  });
});
