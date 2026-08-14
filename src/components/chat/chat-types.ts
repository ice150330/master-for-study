/**
 * 聊天模块的共享轻量类型（仅前端形状，与服务端 Session 行对应）。
 */

export type ChatSession = {
  id: string;
  parentId: string | null;
  rootSessionId?: string | null;
  forkedFromMessageId?: string | null;
  title: string;
  pinnedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string | null;
  createdAt?: string;
  sources?: ChatResource[];
};

export type ChatResource = {
  id: string;
  title: string;
  url: string;
  type: string;
};

export type HistoricalTerm = {
  name: string;
  definition: string;
  sources: Array<{ messageId: string; sessionId: string }>;
};

export type ChatModel = 'fast' | 'pro';
