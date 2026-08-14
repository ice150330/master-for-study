/**
 * 聊天模块的共享轻量类型（仅前端形状，与服务端 Session 行对应）。
 */

export type ChatSession = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
};

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export type ChatModel = 'fast' | 'pro';
