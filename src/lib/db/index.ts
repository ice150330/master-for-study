import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { scheduleReview, type ReviewGrade } from '../fsrs';
import {
  LEARNING_EVENT_SCHEMA_VERSION,
  type LearningEventAction,
  type LearningObjectType,
} from '../learning-events';
import { DEFAULT_TITLE, deriveSessionTitle } from '../session-title';
import { parseTermMarkers } from '../term-parse';

/**
 * SQLite 连接与仓库层（服务端 only，勿在客户端引用）。
 * 数据文件落 data/mentor.db，迁移文件落 drizzle/。
 *
 * 连接与迁移采用懒加载单例：延迟到首次真实查询时才初始化，
 * 避免 next build 多 worker 并发打开 SQLite 造成 SQLITE_BUSY。
 */

export type Workspace = typeof schema.workspaces.$inferSelect;
export type Session = typeof schema.sessions.$inferSelect;
export type Message = typeof schema.messages.$inferSelect;
export type Term = typeof schema.terms.$inferSelect;
export type Note = typeof schema.notes.$inferSelect;
export type Interview = typeof schema.interviews.$inferSelect;
export type TermMastery = typeof schema.termMasteries.$inferSelect;
export type LearningEvent = typeof schema.learningEvents.$inferSelect;
export type Resource = typeof schema.resources.$inferSelect;
export type ResourceType = Resource['type'];
export type ResourceStatus = Resource['status'];

/** 待复习术语（术语表 + 掌握度合并）。 */
export type ReviewItem = {
  termId: string;
  name: string;
  definition: string;
  state: TermMastery['state'];
  stability: number | null;
  difficulty: number | null;
};

function createDb() {
  const dbPath = process.env.MENTOR_DB_PATH ?? path.join(process.cwd(), 'data', 'mentor.db');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

let _db: ReturnType<typeof createDb> | null = null;

function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

/** 测试进程切换临时数据库时关闭懒加载连接。 */
export function resetDbForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetDbForTests 只能在测试环境调用');
  }
  const client = (_db as unknown as { $client?: { close: () => void } } | null)?.$client;
  client?.close();
  _db = null;
}

export const DEFAULT_WORKSPACE_TITLE = '默认工作区';

/** 获取或创建默认工作区。 */
export function ensureWorkspace(): Workspace {
  const db = getDb();
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

/** 按 id 查询单个会话。 */
export function getSession(id: string): Session | undefined {
  return getDb().select().from(schema.sessions).where(eq(schema.sessions.id, id)).limit(1).get();
}

/** 按幂等键查询消息，供流式重试复用已经完成的回答。 */
export function findMessageByIdempotencyKey(idempotencyKey: string): Message | undefined {
  return getDb()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.idempotencyKey, idempotencyKey))
    .limit(1)
    .get();
}

/** 按 id 查询消息，供分支接口由锚点反推父会话。 */
export function getMessage(id: string): Message | undefined {
  return getDb().select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1).get();
}

/** 按 id 查询单条面试记录。 */
export function getInterview(id: string): Interview | undefined {
  return getDb()
    .select()
    .from(schema.interviews)
    .where(eq(schema.interviews.id, id))
    .limit(1)
    .get();
}

/** 按 id 查询笔记。 */
export function getNote(id: string): Note | undefined {
  return getDb().select().from(schema.notes).where(eq(schema.notes.id, id)).limit(1).get();
}

/** 按 id 查询术语。 */
export function getTerm(id: string): Term | undefined {
  return getDb().select().from(schema.terms).where(eq(schema.terms.id, id)).limit(1).get();
}

/** 按 id 查询资源。 */
export function getResource(id: string): Resource | undefined {
  return getDb().select().from(schema.resources).where(eq(schema.resources.id, id)).limit(1).get();
}

/** 按幂等键读取已经完成的事件。 */
export function findEventByIdempotencyKey(idempotencyKey: string): LearningEvent | undefined {
  return getDb()
    .select()
    .from(schema.learningEvents)
    .where(eq(schema.learningEvents.idempotencyKey, idempotencyKey))
    .limit(1)
    .get();
}

function eventValues(input: {
  workspaceId: string;
  sessionId?: string | null;
  action: LearningEventAction;
  objectType: LearningObjectType;
  objectId?: string | null;
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    sessionId: input.sessionId ?? null,
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId ?? null,
    result: input.result ?? {},
    context: input.context ?? {},
    schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
    idempotencyKey: input.idempotencyKey,
    // 兼容旧分析投影：type/action 与 entityId/objectId 同步写入。
    type: input.action,
    entityId: input.objectId ?? null,
    metadata: input.context ?? {},
    createdAt: new Date(),
  };
}

/** 列出默认工作区会话，默认只返回活跃会话并按最近活动倒序。 */
export function listSessions(options: { archived?: boolean } = {}): Session[] {
  const ws = ensureWorkspace();
  return getDb()
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.workspaceId, ws.id),
        options.archived
          ? isNotNull(schema.sessions.archivedAt)
          : isNull(schema.sessions.archivedAt),
      ),
    )
    .orderBy(desc(schema.sessions.updatedAt))
    .all();
}

/** 新建会话（parentId 为空则为根会话）。 */
export function createSession(input: {
  parentId?: string | null;
  forkedFromMessageId?: string | null;
  title?: string;
  idempotencyKey: string;
}): Session {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.objectId) {
    const existingSession = getSession(existingEvent.objectId);
    if (existingSession) return existingSession;
  }

  const ws = ensureWorkspace();
  const now = new Date();
  const id = randomUUID();
  const parent = input.parentId ? getSession(input.parentId) : undefined;
  const forkMessage = input.forkedFromMessageId
    ? getDb()
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, input.forkedFromMessageId))
        .limit(1)
        .get()
    : undefined;
  if (input.parentId && !parent) throw new Error(`父会话不存在：${input.parentId}`);
  if (input.forkedFromMessageId && forkMessage?.sessionId !== input.parentId) {
    throw new Error('分支锚点不属于父会话');
  }
  const session = {
    id,
    workspaceId: ws.id,
    parentId: input.parentId ?? null,
    rootSessionId: parent ? (parent.rootSessionId ?? parent.id) : id,
    forkedFromMessageId: input.forkedFromMessageId ?? null,
    title: input.title?.trim() || DEFAULT_TITLE,
    teacherStyle: null,
    pinnedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  getDb().transaction((tx) => {
    tx.insert(schema.sessions).values(session).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          sessionId: session.id,
          action: 'session_created',
          objectType: 'session',
          objectId: session.id,
          result: { title: session.title },
          context: {
            parentId: session.parentId,
            rootSessionId: session.rootSessionId,
            forkedFromMessageId: session.forkedFromMessageId,
          },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return session;
}

export type SessionUpdate =
  | { action: 'rename'; title: string; idempotencyKey: string }
  | { action: 'pin'; pinned: boolean; idempotencyKey: string }
  | { action: 'archive'; archived: boolean; idempotencyKey: string };

/** 更新会话元数据，并把操作和事件放进同一事务。 */
export function updateSession(id: string, input: SessionUpdate): Session | undefined {
  const session = getSession(id);
  if (!session) return undefined;
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent) return getSession(id);

  const now = new Date();
  const patch =
    input.action === 'rename'
      ? { title: input.title, updatedAt: now }
      : input.action === 'pin'
        ? { pinnedAt: input.pinned ? now : null }
        : { archivedAt: input.archived ? now : null };
  const action =
    input.action === 'rename'
      ? 'session_renamed'
      : input.action === 'pin'
        ? 'session_pinned'
        : input.archived
          ? 'session_archived'
          : 'session_restored';

  getDb().transaction((tx) => {
    tx.update(schema.sessions).set(patch).where(eq(schema.sessions.id, id)).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: session.workspaceId,
          sessionId: id,
          action,
          objectType: 'session',
          objectId: id,
          result:
            input.action === 'rename'
              ? { title: input.title }
              : input.action === 'pin'
                ? { pinned: input.pinned }
                : { archived: input.archived },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return getSession(id);
}

/** 删除会话内容，分支提升为根会话，笔记和面试保留但解除会话引用。 */
export function deleteSession(id: string, idempotencyKey: string): boolean {
  const existingEvent = findEventByIdempotencyKey(idempotencyKey);
  if (existingEvent) return true;
  const session = getSession(id);
  if (!session) return false;

  getDb().transaction((tx) => {
    tx.update(schema.sessions)
      .set({ parentId: null, forkedFromMessageId: null })
      .where(eq(schema.sessions.parentId, id))
      .run();
    tx.update(schema.notes).set({ sessionId: null }).where(eq(schema.notes.sessionId, id)).run();
    tx.update(schema.interviews)
      .set({ sessionId: null })
      .where(eq(schema.interviews.sessionId, id))
      .run();
    tx.update(schema.learningEvents)
      .set({ sessionId: null })
      .where(eq(schema.learningEvents.sessionId, id))
      .run();
    tx.delete(schema.messages).where(eq(schema.messages.sessionId, id)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: session.workspaceId,
          action: 'session_deleted',
          objectType: 'session',
          objectId: id,
          result: { title: session.title },
          idempotencyKey,
        }),
      )
      .run();
  });
  return true;
}

/** 保存一条消息，并更新会话 updatedAt。 */
export function saveMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  idempotencyKey: string;
}): Message {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.idempotencyKey, input.idempotencyKey))
    .limit(1)
    .get();
  if (existing) return existing;

  const session = getSession(input.sessionId);
  if (!session) throw new Error(`会话不存在：${input.sessionId}`);
  const message = {
    id: randomUUID(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    status: 'complete' as const,
    error: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date(),
  };

  db.transaction((tx) => {
    tx.insert(schema.messages).values(message).run();
    const title =
      input.role === 'user' && session.title === DEFAULT_TITLE
        ? deriveSessionTitle(input.content)
        : session.title;
    tx.update(schema.sessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.sessions.id, input.sessionId))
      .run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: session.workspaceId,
          sessionId: input.sessionId,
          action: 'message_sent',
          objectType: 'message',
          objectId: message.id,
          result: { role: input.role, length: input.content.length },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return message;
}

/** 读取某会话的历史消息（按时间升序）。 */
export function listMessages(sessionId: string): Message[] {
  return getDb()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(asc(schema.messages.createdAt))
    .all();
}

/**
 * 沿会话祖先链组装模型上下文：祖先只取到下一层分支锚点，当前会话取完整消息。
 * 数据仍只存一份，分支不会复制父会话消息。
 */
export function listSessionContextMessages(sessionId: string): Message[] {
  const current = getSession(sessionId);
  if (!current) return [];

  const lineage: Session[] = [];
  const visited = new Set<string>();
  let cursor: Session | undefined = current;
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    lineage.unshift(cursor);
    cursor = cursor.parentId ? getSession(cursor.parentId) : undefined;
  }

  const context: Message[] = [];
  for (let index = 0; index < lineage.length; index += 1) {
    const session = lineage[index];
    const child = lineage[index + 1];
    const ownMessages = listMessages(session.id);
    if (!child?.forkedFromMessageId) {
      context.push(...ownMessages);
      continue;
    }
    const anchorIndex = ownMessages.findIndex(
      (message) => message.id === child.forkedFromMessageId,
    );
    context.push(...ownMessages.slice(0, anchorIndex >= 0 ? anchorIndex + 1 : ownMessages.length));
  }
  return context;
}

export type HistoricalTerm = {
  name: string;
  definition: string;
  sources: Array<{ messageId: string; sessionId: string }>;
};

/** 从历史消息的内联标记恢复术语定义与来源。 */
export function listHistoricalTerms(messages: Message[]): HistoricalTerm[] {
  const sourceMap = new Map<string, Array<{ messageId: string; sessionId: string }>>();
  for (const message of messages) {
    for (const segment of parseTermMarkers(message.content)) {
      if (segment.type !== 'term') continue;
      const sources = sourceMap.get(segment.value) ?? [];
      if (!sources.some((source) => source.messageId === message.id)) {
        sources.push({ messageId: message.id, sessionId: message.sessionId });
      }
      sourceMap.set(segment.value, sources);
    }
  }
  const names = [...sourceMap.keys()];
  if (names.length === 0) return [];
  return getDb()
    .select({ name: schema.terms.name, definition: schema.terms.definition })
    .from(schema.terms)
    .where(inArray(schema.terms.name, names))
    .all()
    .map((term) => ({ ...term, sources: sourceMap.get(term.name) ?? [] }));
}

/** 记录一条学习事件。 */
export function recordEvent(input: {
  action: LearningEventAction;
  objectType: LearningObjectType;
  objectId?: string | null;
  sessionId?: string | null;
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
  idempotencyKey: string;
}): LearningEvent {
  const existing = findEventByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;
  const ws = ensureWorkspace();
  const values = eventValues({ workspaceId: ws.id, ...input });
  getDb().insert(schema.learningEvents).values(values).run();
  return values;
}

/** 术语不存在则插入，存在则忽略（单源卡片）。 */
export function upsertTerm(input: {
  name: string;
  definition: string;
  idempotencyKey: string;
}): Term {
  const db = getDb();
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.objectId) {
    const eventTerm = db
      .select()
      .from(schema.terms)
      .where(eq(schema.terms.id, existingEvent.objectId))
      .limit(1)
      .get();
    if (eventTerm) return eventTerm;
  }

  const ws = ensureWorkspace();
  const existing = db
    .select()
    .from(schema.terms)
    .where(eq(schema.terms.name, input.name))
    .limit(1)
    .get();
  const term =
    existing ??
    ({
      id: randomUUID(),
      name: input.name,
      definition: input.definition,
      createdAt: new Date(),
    } satisfies Term);

  db.transaction((tx) => {
    if (!existing) {
      tx.insert(schema.terms).values(term).run();
      tx.insert(schema.termMasteries)
        .values({
          id: randomUUID(),
          termId: term.id,
          state: 'new',
          stability: 0,
          difficulty: 5,
          dueAt: new Date(),
          lastReviewedAt: null,
        })
        .run();
    }
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          action: 'term_seen',
          objectType: 'term',
          objectId: term.id,
          result: { created: !existing },
          context: { name: term.name },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return term;
}

/** 新建一条学习笔记。 */
export function createNote(input: {
  sessionId?: string | null;
  title: string;
  content: Record<string, unknown>;
  markdown: string;
  idempotencyKey: string;
}): Note {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.objectId) {
    const existingNote = getDb()
      .select()
      .from(schema.notes)
      .where(eq(schema.notes.id, existingEvent.objectId))
      .limit(1)
      .get();
    if (existingNote) return existingNote;
  }
  const ws = ensureWorkspace();
  const note = {
    id: randomUUID(),
    workspaceId: ws.id,
    sessionId: input.sessionId ?? null,
    title: input.title,
    content: input.content,
    markdown: input.markdown,
    createdAt: new Date(),
  };
  getDb().transaction((tx) => {
    tx.insert(schema.notes).values(note).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          sessionId: note.sessionId,
          action: 'note_created',
          objectType: 'note',
          objectId: note.id,
          result: { title: note.title },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return note;
}

/** 列出默认工作区下的全部笔记（按时间倒序）。 */
export function listNotes(): Note[] {
  const ws = ensureWorkspace();
  return getDb()
    .select()
    .from(schema.notes)
    .where(eq(schema.notes.workspaceId, ws.id))
    .orderBy(desc(schema.notes.createdAt))
    .all();
}

/** 新建一条面试问答（只含问题）。 */
export function createInterview(input: {
  question: string;
  sessionId?: string | null;
  idempotencyKey: string;
}): Interview {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.objectId) {
    const existingInterview = getInterview(existingEvent.objectId);
    if (existingInterview) return existingInterview;
  }
  const ws = ensureWorkspace();
  const interview = {
    id: randomUUID(),
    sessionId: input.sessionId ?? null,
    question: input.question,
    answer: null,
    feedback: null,
    correct: null,
    createdAt: new Date(),
  };
  getDb().transaction((tx) => {
    tx.insert(schema.interviews).values(interview).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          sessionId: interview.sessionId,
          action: 'interview_question_created',
          objectType: 'interview',
          objectId: interview.id,
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return interview;
}

/** 回填面试问答的作答与判分。 */
export function finishInterview(
  id: string,
  input: {
    answer: string;
    feedback: string;
    correct: boolean;
    level: 'advance' | 'stay' | 'downgrade';
    idempotencyKey: string;
  },
): Interview {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent) {
    const existingInterview = getInterview(id);
    if (existingInterview) return existingInterview;
  }
  const interview = getInterview(id);
  if (!interview) throw new Error(`面试记录不存在：${id}`);
  const ws = ensureWorkspace();
  getDb().transaction((tx) => {
    tx.update(schema.interviews)
      .set({ answer: input.answer, feedback: input.feedback, correct: input.correct })
      .where(eq(schema.interviews.id, id))
      .run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          sessionId: interview.sessionId,
          action: 'interview_answered',
          objectType: 'interview',
          objectId: id,
          result: { correct: input.correct, level: input.level },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return { ...interview, answer: input.answer, feedback: input.feedback, correct: input.correct };
}

/** 列出全部面试记录（按时间倒序）。 */
export function listInterviews(): Interview[] {
  return getDb()
    .select()
    .from(schema.interviews)
    .orderBy(desc(schema.interviews.createdAt))
    .all();
}

/** 为术语创建掌握度记录（不存在时，state=new，立即到期）。 */
export function ensureMastery(termId: string): void {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, termId))
    .limit(1)
    .get();
  if (existing) return;

  db.insert(schema.termMasteries)
    .values({
      id: randomUUID(),
      termId,
      state: 'new',
      stability: 0,
      difficulty: 5,
      dueAt: new Date(),
      lastReviewedAt: null,
    })
    .run();
}

/** 取出到期待复习的术语（术语表 + 掌握度合并，按到期时间升序）。 */
export function getDueReviews(limit = 20): ReviewItem[] {
  return getDb()
    .select({
      termId: schema.termMasteries.termId,
      name: schema.terms.name,
      definition: schema.terms.definition,
      state: schema.termMasteries.state,
      stability: schema.termMasteries.stability,
      difficulty: schema.termMasteries.difficulty,
    })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .where(lte(schema.termMasteries.dueAt, new Date()))
    .orderBy(asc(schema.termMasteries.dueAt))
    .limit(limit)
    .all();
}

/** 复习一个术语：按评级更新掌握度，并记录 reviewed 事件。 */
export function reviewTerm(input: {
  termId: string;
  grade: ReviewGrade;
  idempotencyKey: string;
}) {
  const db = getDb();
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.result) {
    return existingEvent.result as ReturnType<typeof scheduleReview>;
  }
  const mastery = db
    .select()
    .from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, input.termId))
    .limit(1)
    .get();
  const current = mastery ?? {
    state: 'new' as const,
    stability: 0,
    difficulty: 5,
  };

  const result = scheduleReview(
    {
      state: current.state,
      stability: current.stability ?? 0,
      difficulty: current.difficulty ?? 5,
    },
    input.grade,
  );

  const ws = ensureWorkspace();
  db.transaction((tx) => {
    if (!mastery) {
      tx.insert(schema.termMasteries)
        .values({
          id: randomUUID(),
          termId: input.termId,
          state: 'new',
          stability: 0,
          difficulty: 5,
          dueAt: new Date(),
          lastReviewedAt: null,
        })
        .run();
    }
    tx.update(schema.termMasteries)
      .set({
        state: result.state,
        stability: result.stability,
        difficulty: result.difficulty,
        dueAt: new Date(Date.now() + result.dueDays * 24 * 3600 * 1000),
        lastReviewedAt: new Date(),
      })
      .where(eq(schema.termMasteries.termId, input.termId))
      .run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          action: 'reviewed',
          objectType: 'term_mastery',
          objectId: input.termId,
          result: { ...result },
          context: { grade: input.grade },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return result;
}

export type TermStats = {
  total: number;
  new: number;
  learning: number;
  reviewing: number;
  relearning: number;
  due: number;
};

/** 术语掌握度统计（按状态分布 + 待复习数）。 */
export function getTermStats(): TermStats {
  const db = getDb();
  const total = db.select({ c: count() }).from(schema.terms).get()?.c ?? 0;
  const byState = db
    .select({ state: schema.termMasteries.state, c: count() })
    .from(schema.termMasteries)
    .groupBy(schema.termMasteries.state)
    .all();

  const stats: TermStats = { total, new: 0, learning: 0, reviewing: 0, relearning: 0, due: 0 };
  for (const r of byState) stats[r.state] = r.c;
  stats.due =
    db
      .select({ c: count() })
      .from(schema.termMasteries)
      .where(lte(schema.termMasteries.dueAt, new Date()))
      .get()?.c ?? 0;
  return stats;
}

/** 学习事件类型分布（type → 计数）。 */
export function getEventBreakdown(): Record<string, number> {
  const rows = getDb()
    .select({ type: schema.learningEvents.type, c: count() })
    .from(schema.learningEvents)
    .groupBy(schema.learningEvents.type)
    .all();
  return Object.fromEntries(rows.map((r) => [r.type, r.c]));
}

/** 面试统计：出题数 / 已作答数 / 正确数。 */
export function getInterviewStats() {
  const db = getDb();
  const total = db.select({ c: count() }).from(schema.interviews).get()?.c ?? 0;
  const answered =
    db
      .select({ c: count() })
      .from(schema.interviews)
      .where(isNotNull(schema.interviews.answer))
      .get()?.c ?? 0;
  const correct =
    db
      .select({ c: count() })
      .from(schema.interviews)
      .where(eq(schema.interviews.correct, true))
      .get()?.c ?? 0;
  return { total, answered, correct };
}

/** 最近的学习事件流（按时间倒序）。 */
export function getRecentEvents(limit = 20): LearningEvent[] {
  return getDb()
    .select()
    .from(schema.learningEvents)
    .orderBy(desc(schema.learningEvents.createdAt))
    .limit(limit)
    .all();
}

/** 全部术语掌握度（名称 → 状态），供成长地图热力。 */
export function getAllMasteries(): Array<{ name: string; state: TermMastery['state'] }> {
  return getDb()
    .select({ name: schema.terms.name, state: schema.termMasteries.state })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .all();
}

/** 全部术语（id + 名称），供资源关联下拉。 */
export function listTerms(): Array<{ id: string; name: string }> {
  return getDb()
    .select({ id: schema.terms.id, name: schema.terms.name })
    .from(schema.terms)
    .orderBy(asc(schema.terms.name))
    .all();
}

/** 新建一条学习资源。 */
export function createResource(input: {
  title: string;
  type: ResourceType;
  url: string;
  termId?: string | null;
  note?: string | null;
  idempotencyKey: string;
}): Resource {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.objectId) {
    const existingResource = getDb()
      .select()
      .from(schema.resources)
      .where(eq(schema.resources.id, existingEvent.objectId))
      .limit(1)
      .get();
    if (existingResource) return existingResource;
  }
  const ws = ensureWorkspace();
  const resource = {
    id: randomUUID(),
    workspaceId: ws.id,
    termId: input.termId ?? null,
    title: input.title,
    type: input.type,
    url: input.url,
    status: '想读' as const,
    note: input.note ?? null,
    createdAt: new Date(),
  };
  getDb().transaction((tx) => {
    tx.insert(schema.resources).values(resource).run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          action: 'resource_created',
          objectType: 'resource',
          objectId: resource.id,
          result: { status: resource.status, type: resource.type },
          context: { termId: resource.termId },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return resource;
}

/** 列出默认工作区下的全部资源（按时间倒序）。 */
export function listResources(): Resource[] {
  const ws = ensureWorkspace();
  return getDb()
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.workspaceId, ws.id))
    .orderBy(desc(schema.resources.createdAt))
    .all();
}

/** 更新资源阅读状态。 */
export function updateResourceStatus(input: {
  id: string;
  status: ResourceStatus;
  idempotencyKey: string;
}): Resource {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  const db = getDb();
  const resource = db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.id, input.id))
    .limit(1)
    .get();
  if (!resource) throw new Error(`资源不存在：${input.id}`);
  if (existingEvent) return resource;

  db.transaction((tx) => {
    tx.update(schema.resources)
      .set({ status: input.status })
      .where(eq(schema.resources.id, input.id))
      .run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: resource.workspaceId,
          action: 'resource_status_changed',
          objectType: 'resource',
          objectId: input.id,
          result: { status: input.status },
          context: { previousStatus: resource.status },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return { ...resource, status: input.status };
}
