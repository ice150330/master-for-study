/**
 * 会话树：由扁平的会话列表按 parent_id 组装成树。
 * 孤儿节点（parentId 指向不存在会话）按根节点处理。
 */

export type SessionNodeLike = {
  id: string;
  parentId: string | null;
};

export type SessionTreeNode<T extends SessionNodeLike> = T & {
  children: Array<SessionTreeNode<T>>;
};

export function buildSessionTree<T extends SessionNodeLike>(
  sessions: T[],
): Array<SessionTreeNode<T>> {
  const map = new Map<string, SessionTreeNode<T>>();
  for (const s of sessions) map.set(s.id, { ...s, children: [] });

  const roots: Array<SessionTreeNode<T>> = [];
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
