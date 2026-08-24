'use client';

/**
 * 会话树路径追踪（底部状态条数据通道）：
 * Chat 持有会话状态，壳层状态条在组件树之外——用轻量模块级 store 解耦。
 * 快照为整对象替换（引用稳定），符合 useSyncExternalStore 的缓存要求。
 */

export type SessionTrailItem = {
  id: string;
  title: string;
  /** 从根会话起的深度（D0 = 根） */
  depth: number;
};

export type SessionTrail = {
  /** 根 → … → 当前 的完整路径 */
  path: SessionTrailItem[];
  branchCount: number;
  currentId: string;
};

let snapshot: SessionTrail | null = null;
let selector: ((id: string) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSessionTrail(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getSessionTrail(): SessionTrail | null {
  return snapshot;
}

/** Chat 在会话 / 当前会话变化时写入路径；null = 离开会话页。 */
export function setSessionTrail(next: SessionTrail | null) {
  snapshot = next;
  emit();
}

/** 注册"点击路径段切换会话"的处理器（Chat 的 openSession）。 */
export function setSessionTrailSelector(select: ((id: string) => void) | null) {
  selector = select;
}

/** 状态条点击路径段时调用：会话页内直接切换（不重载），其他页面跳转。 */
export function selectTrailSession(id: string): boolean {
  if (!selector) return false;
  selector(id);
  return true;
}
