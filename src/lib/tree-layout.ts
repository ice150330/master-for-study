/**
 * 树布局引擎（纯函数）：把一棵树展开成「按层 + 叶子序号」的二维坐标。
 * 叶子节点按遍历顺序纵向排布，内部节点取其子节点纵向中心，横向按深度递增。
 * 供白板（会话关系图 / 成长地图）做 SVG 渲染。
 */

export type TreeInput<T = unknown> = {
  id: string;
  label: string;
  data?: T;
  children: TreeInput<T>[];
};

export type LaidOutNode<T = unknown> = {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
  data?: T;
};

export type TreeLayout<T = unknown> = {
  nodes: LaidOutNode<T>[];
  edges: Array<{ from: string; to: string }>;
  maxDepth: number;
  maxLeaf: number;
};

export function layoutTree<T>(root: TreeInput<T>): TreeLayout<T> {
  const nodes: LaidOutNode<T>[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const leafY = new Map<string, number>();
  let leafIndex = 0;

  // 第一遍：叶子按遍历顺序分配纵向序号
  function assignLeaves(node: TreeInput<T>): void {
    if (node.children.length === 0) {
      leafY.set(node.id, leafIndex++);
    } else {
      for (const c of node.children) assignLeaves(c);
    }
  }
  assignLeaves(root);

  // 第二遍：计算每个节点纵向位置（叶子=自身序号，内部=子节点中心），并收集节点与边
  function place(node: TreeInput<T>, depth: number): number {
    let y: number;
    if (node.children.length === 0) {
      y = leafY.get(node.id) ?? 0;
    } else {
      const ys = node.children.map((c) => place(c, depth + 1));
      y = ys.reduce((a, b) => a + b, 0) / ys.length;
    }
    nodes.push({ id: node.id, label: node.label, x: depth, y, depth, data: node.data });
    for (const c of node.children) edges.push({ from: node.id, to: c.id });
    return y;
  }
  place(root, 0);

  return {
    nodes,
    edges,
    maxDepth: nodes.reduce((m, n) => Math.max(m, n.depth), 0),
    maxLeaf: Math.max(0, leafIndex - 1),
  };
}
