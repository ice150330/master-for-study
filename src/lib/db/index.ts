import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

/**
 * SQLite 连接与仓库层（服务端 only，勿在客户端引用）。
 * 数据文件落 data/mentor.db，迁移文件落 drizzle/。
 */

export type Workspace = typeof schema.workspaces.$inferSelect;
export type Session = typeof schema.sessions.$inferSelect;
export type Message = typeof schema.messages.$inferSelect;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(path.join(dataDir, 'mentor.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

// 应用迁移（幂等，首次启动自动建表）。
migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

export const DEFAULT_WORKSPACE_TITLE = '默认工作区';

/** 获取或创建默认工作区。 */
export function ensureWorkspace(): Workspace {
  const existing = db.select().from(schema.workspaces).limit(1).get();
  if (existing) return existing;

  const ws = {
    id: randomUUID(),
    title: DEFAULT_WORKSPACE_TITLE,
    goal: null,
    createdAt: new Date(),
  };
  db.insert(schema.workspaces).values(ws).run();
  return ws;
}

/** 列出默认工作区下的全部会话（按创建时间升序）。 */
export function listSessions(): Session[] {
  const ws = ensureWorkspace();
  return db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.workspaceId, ws.id))
    .orderBy(asc(schema.sessions.createdAt))
    .all();
}

/** 按 id 查询单个会话。 */
export function getSession(id: string): Session | undefined {
  return db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).limit(1).get();
}

/** 新建会话（parentId 为空则为根会话）。 */
export function createSession(input: {
  parentId?: string | null;
  title?: string;
}): Session {
  const ws = ensureWorkspace();
  const now = new Date();
  const session = {
    id: randomUUID(),
    workspaceId: ws.id,
    parentId: input.parentId ?? null,
    title: input.title?.trim() || '新会话',
    teacherStyle: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.sessions).values(session).run();
  return session;
}

/** 保存一条消息，并更新会话 updatedAt。 */
export function saveMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}): void {
  db.insert(schema.messages)
    .values({
      id: randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      createdAt: new Date(),
    })
    .run();

  db.update(schema.sessions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.sessions.id, input.sessionId))
    .run();
}

/** 读取某会话的历史消息（按时间升序）。 */
export function listMessages(sessionId: string): Message[] {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(asc(schema.messages.createdAt))
    .all();
}

/** 记录一条学习事件。 */
export function recordEvent(input: {
  type: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  db.insert(schema.learningEvents)
    .values({
      id: randomUUID(),
      type: input.type,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    })
    .run();
}

/** 术语不存在则插入，存在则忽略（单源卡片）。 */
export function upsertTerm(input: { name: string; definition: string }): void {
  const existing = db
    .select()
    .from(schema.terms)
    .where(eq(schema.terms.name, input.name))
    .limit(1)
    .get();
  if (existing) return;

  db.insert(schema.terms)
    .values({
      id: randomUUID(),
      name: input.name,
      definition: input.definition,
      createdAt: new Date(),
    })
    .run();
}
