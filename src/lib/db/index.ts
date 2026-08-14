import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import {
  REVIEW_ALGORITHM_VERSION,
  createReviewCard,
  formatReviewInterval,
  previewReview,
  rollbackReview,
  scheduleReview,
  type ReviewGrade,
  type StoredReviewCard,
  type StoredReviewLog,
} from '../fsrs';
import {
  LEARNING_EVENT_SCHEMA_VERSION,
  type LearningEventAction,
  type LearningObjectType,
} from '../learning-events';
import {
  adaptInterviewDifficulty,
  type InterviewEvaluation,
  type InterviewQuestionDraft,
  type InterviewSettings,
} from '../interview/types';
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
export type ConceptMention = typeof schema.conceptMentions.$inferSelect;
export type Note = typeof schema.notes.$inferSelect;
export type NoteVersion = typeof schema.noteVersions.$inferSelect;
export type NoteSource = typeof schema.noteSources.$inferSelect;
export type Interview = typeof schema.interviews.$inferSelect;
export type InterviewSession = typeof schema.interviewSessions.$inferSelect;
export type InterviewAttempt = typeof schema.interviewAttempts.$inferSelect;
export type TermMastery = typeof schema.termMasteries.$inferSelect;
export type ReviewCard = typeof schema.reviewCards.$inferSelect;
export type ReviewLog = typeof schema.reviewLogs.$inferSelect;
export type ReviewUndo = typeof schema.reviewUndos.$inferSelect;
export type PracticeAttempt = typeof schema.practiceAttempts.$inferSelect;
export type LearningEvent = typeof schema.learningEvents.$inferSelect;
export type Resource = typeof schema.resources.$inferSelect;
export type ResourceType = Resource['type'];
export type ResourceStatus = Resource['status'];

export type InterviewQuestionWithAttempts = Interview & { attempts: InterviewAttempt[] };
export type InterviewSessionDetail = {
  session: InterviewSession;
  questions: InterviewQuestionWithAttempts[];
};

export type ConceptDetail = {
  concept: Term;
  mastery: TermMastery | null;
  mentions: Array<ConceptMention & { sourceTitle: string }>;
  relatedNotes: Array<Pick<Note, 'id' | 'title' | 'sessionId'>>;
  relatedResources: Array<Pick<Resource, 'id' | 'title' | 'url' | 'status'>>;
};

export type TodayLearningAction = {
  id: string;
  kind: 'continue' | 'review' | 'practice' | 'resource' | 'note';
  title: string;
  description: string;
  source: string;
  effort: string;
  href: string;
  actionLabel: string;
};

/** 待复习术语（术语表 + 掌握度合并）。 */
export type ReviewItem = {
  cardId: string;
  termId: string;
  name: string;
  definition: string;
  state: ReviewCard['state'];
  stability: number;
  difficulty: number;
  dueAt: string;
  isDifficult: boolean;
  sourceLabel: string;
  sourceHref: string;
  preview: Record<ReviewGrade, {
    dueAt: string;
    intervalMs: number;
    intervalLabel: string;
    scheduledDays: number;
  }>;
};

export type ReviewQueue = {
  reviews: ReviewItem[];
  summary: {
    due: number;
    overdue: number;
    estimatedMinutes: number;
  };
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

export function getInterviewSession(id: string): InterviewSession | undefined {
  return getDb()
    .select()
    .from(schema.interviewSessions)
    .where(eq(schema.interviewSessions.id, id))
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

/** 实践运行与事件同事务写入，结果正确与否都形成技能证据。 */
export function createPracticeAttempt(input: {
  conceptId?: string | null;
  challengeId: string;
  status: PracticeAttempt['status'];
  errorType?: PracticeAttempt['errorType'];
  runCount: number;
  hintCount: number;
  durationMs: number;
  sql: string;
  result: Record<string, unknown>;
  skills: string[];
  idempotencyKey: string;
}): PracticeAttempt {
  const db = getDb();
  const existing = db.select().from(schema.practiceAttempts)
    .where(eq(schema.practiceAttempts.idempotencyKey, input.idempotencyKey))
    .limit(1).get();
  if (existing) return existing;
  const ws = ensureWorkspace();
  const attempt = {
    id: randomUUID(),
    workspaceId: ws.id,
    conceptId: input.conceptId ?? null,
    challengeId: input.challengeId,
    status: input.status,
    errorType: input.errorType ?? null,
    runCount: input.runCount,
    hintCount: input.hintCount,
    durationMs: input.durationMs,
    sql: input.sql,
    result: input.result,
    skills: input.skills,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date(),
  } satisfies PracticeAttempt;
  db.transaction((tx) => {
    tx.insert(schema.practiceAttempts).values(attempt).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: ws.id,
      action: 'practice_attempted',
      objectType: 'practice_attempt',
      objectId: attempt.id,
      result: {
        status: attempt.status,
        errorType: attempt.errorType,
        challengeId: attempt.challengeId,
      },
      context: {
        conceptId: attempt.conceptId,
        runCount: attempt.runCount,
        hintCount: attempt.hintCount,
        durationMs: attempt.durationMs,
        skills: attempt.skills,
      },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return attempt;
}

export function listPracticeAttempts(challengeId?: string): PracticeAttempt[] {
  const query = getDb().select().from(schema.practiceAttempts);
  return challengeId
    ? query.where(eq(schema.practiceAttempts.challengeId, challengeId))
      .orderBy(desc(schema.practiceAttempts.createdAt)).all()
    : query.orderBy(desc(schema.practiceAttempts.createdAt)).all();
}

/** Concept 不存在则插入，存在则合并更可信的解释与别名。 */
export function upsertTerm(input: {
  name: string;
  canonicalName?: string;
  aliases?: string[];
  definition: string;
  example?: string | null;
  confidence?: number;
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
  const canonicalName = input.canonicalName?.trim() || input.name.trim();
  const lookupNames = new Set(
    [input.name, canonicalName, ...(input.aliases ?? [])].map((name) => name.trim().toLocaleLowerCase()),
  );
  const existing = db
    .select()
    .from(schema.terms)
    .all()
    .find((term) =>
      [term.name, term.canonicalName, ...term.aliases]
        .map((name) => name.toLocaleLowerCase())
        .some((name) => lookupNames.has(name)),
    );
  const confidence = Math.min(1, Math.max(0, input.confidence ?? 0.8));
  const resolvedCanonicalName =
    existing && confidence < existing.confidence
      ? (existing.canonicalName || canonicalName)
      : canonicalName;
  const aliases = [
    ...new Set([
      ...(existing?.aliases ?? []),
      ...(input.aliases ?? []),
      ...(existing?.canonicalName && existing.canonicalName !== resolvedCanonicalName
        ? [existing.canonicalName]
        : []),
    ]),
  ].filter(
    (alias) => alias && alias.toLocaleLowerCase() !== resolvedCanonicalName.toLocaleLowerCase(),
  );
  const term =
    existing
      ? {
          ...existing,
          canonicalName: resolvedCanonicalName,
          aliases,
          definition:
            confidence >= existing.confidence ? input.definition : existing.definition,
          example: confidence >= existing.confidence ? (input.example ?? existing.example) : existing.example,
          confidence: Math.max(existing.confidence, confidence),
        }
      : ({
          id: randomUUID(),
          name: input.name.trim(),
          canonicalName,
          aliases,
          definition: input.definition,
          example: input.example ?? null,
          confidence,
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
      tx.insert(schema.reviewCards)
        .values(reviewCardValues(ws.id, term.id, term.createdAt))
        .run();
    } else {
      tx.update(schema.terms).set(term).where(eq(schema.terms.id, term.id)).run();
    }
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: ws.id,
          action: 'term_seen',
          objectType: 'term',
          objectId: term.id,
          result: { created: !existing },
          context: { name: term.name, canonicalName: term.canonicalName, confidence },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return term;
}

/** 记录 Concept 在消息、笔记或资源中的一次可回溯出现。 */
export function recordConceptMention(input: {
  termId: string;
  sourceType: ConceptMention['sourceType'];
  sourceId: string;
  sessionId?: string | null;
  locator?: string | null;
  excerpt?: string | null;
  idempotencyKey: string;
}): ConceptMention {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.conceptMentions)
    .where(eq(schema.conceptMentions.idempotencyKey, input.idempotencyKey))
    .limit(1)
    .get();
  if (existing) return existing;
  const mention = {
    id: randomUUID(),
    termId: input.termId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sessionId: input.sessionId ?? null,
    locator: input.locator ?? null,
    excerpt: input.excerpt ?? null,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date(),
  };
  db.insert(schema.conceptMentions).values(mention).run();
  return mention;
}

/** 读取跨模块共享的 Concept 详情和来源关系。 */
export function getConceptDetail(input: { id?: string; name?: string }): ConceptDetail | undefined {
  const db = getDb();
  const normalized = input.name?.trim().toLocaleLowerCase();
  const concept = input.id
    ? getTerm(input.id)
    : db
        .select()
        .from(schema.terms)
        .all()
        .find((term) =>
          [term.name, term.canonicalName, ...term.aliases]
            .map((name) => name.toLocaleLowerCase())
            .includes(normalized ?? ''),
        );
  if (!concept) return undefined;

  const mastery =
    db
      .select()
      .from(schema.termMasteries)
      .where(eq(schema.termMasteries.termId, concept.id))
      .limit(1)
      .get() ?? null;
  const mentions = db
    .select()
    .from(schema.conceptMentions)
    .where(eq(schema.conceptMentions.termId, concept.id))
    .orderBy(desc(schema.conceptMentions.createdAt))
    .all()
    .map((mention) => ({
      ...mention,
      sourceTitle:
        mention.sourceType === 'message'
          ? (mention.sessionId ? getSession(mention.sessionId)?.title : null) ?? '对话消息'
          : mention.sourceType === 'note'
            ? getNote(mention.sourceId)?.title ?? '学习笔记'
            : getResource(mention.sourceId)?.title ?? '学习资源',
    }));
  const names = new Set(
    [concept.name, concept.canonicalName, ...concept.aliases].map((name) => name.toLocaleLowerCase()),
  );
  const relatedNotes = listNotes()
    .filter((note) => noteContainsConcept(note.content, names))
    .map(({ id, title, sessionId }) => ({ id, title, sessionId }));
  const relatedResources = listResources()
    .filter((resource) => resource.termId === concept.id)
    .map(({ id, title, url, status }) => ({ id, title, url, status }));
  return { concept, mastery, mentions, relatedNotes, relatedResources };
}

function noteContainsConcept(content: Record<string, unknown>, names: Set<string>) {
  return [...extractConceptNames(content)].some((name) => names.has(name));
}

function extractConceptNames(content: Record<string, unknown>) {
  const candidates = new Set<string>();
  for (const key of ['coreConcepts', 'terms']) {
    const entries = content[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') {
        candidates.add(entry.name.toLocaleLowerCase());
      }
    }
  }
  return candidates;
}

function extractConceptLabels(content: Record<string, unknown>) {
  const labels: string[] = [];
  for (const key of ['coreConcepts', 'terms']) {
    const entries = content[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') {
        labels.push(entry.name);
      }
    }
  }
  return [...new Set(labels)];
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
  const conceptNames = extractConceptNames(input.content);
  const tags = extractConceptLabels(input.content).slice(0, 12);
  const sourceMessages = input.sessionId ? listMessages(input.sessionId) : [];
  const noteConcepts = getDb()
    .select()
    .from(schema.terms)
    .all()
    .filter((term) =>
      [term.name, term.canonicalName, ...term.aliases]
        .map((name) => name.toLocaleLowerCase())
        .some((name) => conceptNames.has(name)),
    );
  const note = {
    id: randomUUID(),
    workspaceId: ws.id,
    sessionId: input.sessionId ?? null,
    title: input.title,
    content: input.content,
    aiSnapshot: input.content,
    userContent: null,
    tags,
    version: 1,
    markdown: input.markdown,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  getDb().transaction((tx) => {
    tx.insert(schema.notes).values(note).run();
    tx.insert(schema.noteVersions)
      .values({
        id: randomUUID(),
        noteId: note.id,
        version: 1,
        origin: 'ai',
        title: note.title,
        markdown: note.markdown,
        tags: note.tags,
        createdAt: note.createdAt,
      })
      .run();
    if (sourceMessages.length > 0) {
      tx.insert(schema.noteSources)
        .values({
          id: randomUUID(),
          noteId: note.id,
          blockKey: 'document',
          sessionId: note.sessionId,
          startMessageId: sourceMessages[0].id,
          endMessageId: sourceMessages.at(-1)?.id ?? sourceMessages[0].id,
          excerpt: sourceMessages[0].content.slice(0, 240),
          createdAt: note.createdAt,
        })
        .run();
    }
    for (const [index, concept] of noteConcepts.entries()) {
      tx.insert(schema.conceptMentions)
        .values({
          id: randomUUID(),
          termId: concept.id,
          sourceType: 'note',
          sourceId: note.id,
          sessionId: note.sessionId,
          locator: `note:${note.id}:concept:${concept.id}`,
          excerpt: note.title,
          idempotencyKey: `${input.idempotencyKey}:mention:${index}`,
          createdAt: new Date(),
        })
        .run();
    }
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

/** 保存用户编辑并追加不可变版本；AI 初始快照保持不变。 */
export function updateNote(input: {
  id: string;
  title: string;
  markdown: string;
  tags: string[];
  idempotencyKey: string;
}): Note {
  const db = getDb();
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent) {
    const existing = getNote(input.id);
    if (existing) return existing;
  }
  const note = getNote(input.id);
  if (!note) throw new Error(`笔记不存在：${input.id}`);
  const version = note.version + 1;
  const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
  const updatedAt = new Date();

  db.transaction((tx) => {
    tx.update(schema.notes)
      .set({
        title: input.title,
        markdown: input.markdown,
        userContent: { title: input.title, markdown: input.markdown, tags },
        tags,
        version,
        updatedAt,
      })
      .where(eq(schema.notes.id, input.id))
      .run();
    tx.insert(schema.noteVersions)
      .values({
        id: randomUUID(),
        noteId: input.id,
        version,
        origin: 'user',
        title: input.title,
        markdown: input.markdown,
        tags,
        createdAt: updatedAt,
      })
      .run();
    tx.insert(schema.learningEvents)
      .values(
        eventValues({
          workspaceId: note.workspaceId,
          sessionId: note.sessionId,
          action: 'note_updated',
          objectType: 'note',
          objectId: note.id,
          result: { version, title: input.title },
          idempotencyKey: input.idempotencyKey,
        }),
      )
      .run();
  });
  return getNote(input.id)!;
}

export function listNoteVersions(noteId: string): NoteVersion[] {
  return getDb()
    .select()
    .from(schema.noteVersions)
    .where(eq(schema.noteVersions.noteId, noteId))
    .orderBy(desc(schema.noteVersions.version))
    .all();
}

export function listNoteSources(
  noteId: string,
): Array<NoteSource & { valid: boolean; sessionTitle: string | null }> {
  return getDb()
    .select()
    .from(schema.noteSources)
    .where(eq(schema.noteSources.noteId, noteId))
    .all()
    .map((source) => ({
      ...source,
      valid: Boolean(
        source.sessionId &&
          source.startMessageId &&
          source.endMessageId &&
          getSession(source.sessionId) &&
          getMessage(source.startMessageId) &&
          getMessage(source.endMessageId),
      ),
      sessionTitle: source.sessionId ? getSession(source.sessionId)?.title ?? null : null,
    }));
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

/** 开始一次结构化面试，并在同一事务中建立第一题。 */
export function startInterviewSession(input: {
  settings: InterviewSettings;
  question: InterviewQuestionDraft;
  termId?: string | null;
  idempotencyKey: string;
}): InterviewSessionDetail {
  const existing = getDb().select().from(schema.interviewSessions)
    .where(eq(schema.interviewSessions.idempotencyKey, input.idempotencyKey)).limit(1).get();
  if (existing) return getInterviewSessionDetail(existing.id) as InterviewSessionDetail;
  const ws = ensureWorkspace();
  const now = new Date();
  const session = {
    id: randomUUID(),
    workspaceId: ws.id,
    role: input.settings.role,
    topic: input.settings.topic,
    initialDifficulty: input.settings.difficulty,
    currentDifficulty: input.settings.difficulty,
    totalRounds: input.settings.totalRounds,
    currentRound: 1,
    teacherStyle: input.settings.teacherStyle,
    status: 'active' as const,
    lastStrategy: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  } satisfies InterviewSession;
  const interview = questionValues({
    workspaceId: ws.id,
    interviewSessionId: session.id,
    termId: input.termId,
    roundIndex: 1,
    difficulty: input.settings.difficulty,
    question: input.question,
  });
  getDb().transaction((tx) => {
    tx.insert(schema.interviewSessions).values(session).run();
    tx.insert(schema.interviews).values(interview).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: ws.id,
      action: 'interview_session_started',
      objectType: 'interview_session',
      objectId: session.id,
      result: { questionId: interview.id },
      context: { ...input.settings, skill: input.question.skill },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return { session, questions: [{ ...interview, attempts: [] }] };
}

/** 根据已持久化的难度策略创建下一题。 */
export function createNextInterviewQuestion(input: {
  interviewSessionId: string;
  question: InterviewQuestionDraft;
  termId?: string | null;
  idempotencyKey: string;
}): InterviewSessionDetail {
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous?.objectId) {
    const interview = getInterview(previous.objectId);
    if (interview?.interviewSessionId) {
      return getInterviewSessionDetail(interview.interviewSessionId) as InterviewSessionDetail;
    }
  }
  const session = getInterviewSession(input.interviewSessionId);
  if (!session) throw new Error(`面试场次不存在：${input.interviewSessionId}`);
  if (session.status === 'completed' || session.currentRound >= session.totalRounds) {
    throw new Error('当前面试已经完成');
  }
  const now = new Date();
  const interview = questionValues({
    workspaceId: session.workspaceId,
    interviewSessionId: session.id,
    termId: input.termId,
    roundIndex: session.currentRound + 1,
    difficulty: session.currentDifficulty,
    question: input.question,
  });
  getDb().transaction((tx) => {
    tx.insert(schema.interviews).values(interview).run();
    tx.update(schema.interviewSessions)
      .set({ currentRound: interview.roundIndex, updatedAt: now })
      .where(eq(schema.interviewSessions.id, session.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: session.workspaceId,
      action: 'interview_question_created',
      objectType: 'interview',
      objectId: interview.id,
      result: { roundIndex: interview.roundIndex, difficulty: interview.difficulty },
      context: { interviewSessionId: session.id, skill: interview.skill },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return getInterviewSessionDetail(session.id) as InterviewSessionDetail;
}

/** 追问只补充题面，不泄漏评分结果，并单独留下事件。 */
export function saveInterviewFollowUp(input: {
  interviewId: string;
  followUp: string;
  idempotencyKey: string;
}): Interview {
  const interview = getInterview(input.interviewId);
  if (!interview) throw new Error(`面试记录不存在：${input.interviewId}`);
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous) return interview.followUp ? interview : { ...interview, followUp: input.followUp };
  const workspaceId = interview.workspaceId ?? ensureWorkspace().id;
  getDb().transaction((tx) => {
    tx.update(schema.interviews).set({ followUp: input.followUp })
      .where(eq(schema.interviews.id, interview.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId,
      action: 'interview_followup_created',
      objectType: 'interview',
      objectId: interview.id,
      context: { interviewSessionId: interview.interviewSessionId },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return { ...interview, followUp: input.followUp };
}

/** 追加一次作答版本，同时更新题目兼容投影和场次难度。 */
export function finishInterview(
  id: string,
  input: {
    answer: string;
    durationMs: number;
    evaluation: InterviewEvaluation;
    prerequisiteTermId?: string | null;
    idempotencyKey: string;
  },
): { session: InterviewSession | null; interview: Interview; attempt: InterviewAttempt; attempts: InterviewAttempt[] } {
  const existingAttempt = getDb().select().from(schema.interviewAttempts)
    .where(eq(schema.interviewAttempts.idempotencyKey, input.idempotencyKey)).limit(1).get();
  if (existingAttempt) {
    const existingInterview = getInterview(id);
    if (!existingInterview) throw new Error(`面试记录不存在：${id}`);
    return {
      session: existingInterview.interviewSessionId
        ? getInterviewSession(existingInterview.interviewSessionId) ?? null
        : null,
      interview: existingInterview,
      attempt: existingAttempt,
      attempts: listInterviewAttempts(id),
    };
  }
  const interview = getInterview(id);
  if (!interview) throw new Error(`面试记录不存在：${id}`);
  const session = interview.interviewSessionId ? getInterviewSession(interview.interviewSessionId) : undefined;
  const existingAttempts = listInterviewAttempts(id);
  const now = new Date();
  const attempt = {
    id: randomUUID(),
    interviewId: id,
    version: existingAttempts.length + 1,
    answer: input.answer,
    durationMs: input.durationMs,
    scores: input.evaluation.scores,
    evidence: input.evaluation.evidence,
    summary: input.evaluation.summary,
    strengths: input.evaluation.strengths,
    improvements: input.evaluation.improvements,
    modelAnswer: input.evaluation.modelAnswer,
    correct: input.evaluation.correct,
    nextStrategy: input.evaluation.nextStrategy,
    prerequisite: input.evaluation.prerequisite,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
  } satisfies InterviewAttempt;
  const nextDifficulty = session
    ? adaptInterviewDifficulty(session.currentDifficulty, input.evaluation.nextStrategy)
    : interview.difficulty;
  const completed = Boolean(session && session.currentRound >= session.totalRounds);
  const workspaceId = interview.workspaceId ?? session?.workspaceId ?? ensureWorkspace().id;
  getDb().transaction((tx) => {
    tx.insert(schema.interviewAttempts).values(attempt).run();
    tx.update(schema.interviews).set({
      answer: input.answer,
      feedback: input.evaluation.summary,
      correct: input.evaluation.correct,
      termId: input.prerequisiteTermId ?? interview.termId,
    }).where(eq(schema.interviews.id, id)).run();
    if (session) {
      tx.update(schema.interviewSessions).set({
        currentDifficulty: nextDifficulty,
        lastStrategy: input.evaluation.nextStrategy,
        status: completed ? 'completed' : 'active',
        updatedAt: now,
        completedAt: completed ? now : null,
      }).where(eq(schema.interviewSessions.id, session.id)).run();
    }
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId,
      action: 'interview_answered',
      objectType: 'interview_attempt',
      objectId: attempt.id,
      result: {
        correct: attempt.correct,
        level: attempt.nextStrategy,
        scores: attempt.scores,
        version: attempt.version,
      },
      context: {
        interviewId: id,
        interviewSessionId: interview.interviewSessionId,
        termId: input.prerequisiteTermId ?? interview.termId,
        difficulty: interview.difficulty,
        durationMs: attempt.durationMs,
      },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  const updatedInterview = {
    ...interview,
    answer: input.answer,
    feedback: input.evaluation.summary,
    correct: input.evaluation.correct,
    termId: input.prerequisiteTermId ?? interview.termId,
  };
  return {
    session: session ? {
      ...session,
      currentDifficulty: nextDifficulty,
      lastStrategy: input.evaluation.nextStrategy,
      status: completed ? 'completed' : 'active',
      updatedAt: now,
      completedAt: completed ? now : null,
    } : null,
    interview: updatedInterview,
    attempt,
    attempts: [...existingAttempts, attempt],
  };
}

export function listInterviewAttempts(interviewId: string): InterviewAttempt[] {
  return getDb().select().from(schema.interviewAttempts)
    .where(eq(schema.interviewAttempts.interviewId, interviewId))
    .orderBy(asc(schema.interviewAttempts.version)).all();
}

export function getInterviewSessionDetail(id: string): InterviewSessionDetail | undefined {
  const session = getInterviewSession(id);
  if (!session) return undefined;
  const questions = getDb().select().from(schema.interviews)
    .where(eq(schema.interviews.interviewSessionId, id))
    .orderBy(asc(schema.interviews.roundIndex)).all()
    .map((question) => ({ ...question, attempts: listInterviewAttempts(question.id) }));
  return { session, questions };
}

export function listInterviewSessionDetails(limit = 12): InterviewSessionDetail[] {
  const ws = ensureWorkspace();
  return getDb().select().from(schema.interviewSessions)
    .where(eq(schema.interviewSessions.workspaceId, ws.id))
    .orderBy(desc(schema.interviewSessions.updatedAt)).limit(limit).all()
    .map((session) => getInterviewSessionDetail(session.id))
    .filter((detail): detail is InterviewSessionDetail => Boolean(detail));
}

/** 列出全部面试题目（按时间倒序），保留给现有分析投影。 */
export function listInterviews(): Interview[] {
  return getDb().select().from(schema.interviews).orderBy(desc(schema.interviews.createdAt)).all();
}

function questionValues(input: {
  workspaceId: string;
  interviewSessionId: string;
  termId?: string | null;
  roundIndex: number;
  difficulty: Interview['difficulty'];
  question: InterviewQuestionDraft;
}): Interview {
  return {
    id: randomUUID(),
    sessionId: null,
    workspaceId: input.workspaceId,
    interviewSessionId: input.interviewSessionId,
    termId: input.termId ?? null,
    roundIndex: input.roundIndex,
    skill: input.question.skill,
    difficulty: input.difficulty,
    rubric: input.question.rubric,
    followUp: null,
    question: input.question.question,
    answer: null,
    feedback: null,
    correct: null,
    createdAt: new Date(),
  };
}

function reviewCardValues(
  workspaceId: string,
  termId: string,
  now: Date,
  legacy?: TermMastery,
): typeof schema.reviewCards.$inferInsert {
  const initial = createReviewCard(now);
  const stability = legacy?.stability ?? initial.stability;
  return {
    id: randomUUID(),
    workspaceId,
    termId,
    state: legacy?.state ?? initial.state,
    dueAt: legacy?.dueAt ?? initial.dueAt,
    stability,
    difficulty: legacy?.difficulty ?? initial.difficulty,
    scheduledDays: legacy ? Math.max(0, Math.round(stability)) : initial.scheduledDays,
    learningSteps: initial.learningSteps,
    reps: legacy?.lastReviewedAt ? 1 : initial.reps,
    lapses: legacy?.state === 'relearning' ? 1 : initial.lapses,
    lastReviewAt: legacy?.lastReviewedAt ?? initial.lastReviewAt,
    isDifficult: false,
    createdAt: now,
    updatedAt: now,
  };
}

function toStoredReviewCard(card: ReviewCard): StoredReviewCard {
  return {
    dueAt: card.dueAt,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReviewAt: card.lastReviewAt,
  };
}

function ensureReviewCard(termId: string, now = new Date()): ReviewCard {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.reviewCards)
    .where(eq(schema.reviewCards.termId, termId))
    .limit(1)
    .get();
  if (existing) return existing;
  const ws = ensureWorkspace();
  const mastery = db
    .select()
    .from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, termId))
    .limit(1)
    .get();
  const values = reviewCardValues(ws.id, termId, now, mastery);
  db.insert(schema.reviewCards).values(values).run();
  return values as ReviewCard;
}

/** 为术语创建掌握度与正式 FSRS 卡片（不存在时立即到期）。 */
export function ensureMastery(termId: string): void {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, termId))
    .limit(1)
    .get();
  if (!existing) {
    db.insert(schema.termMasteries)
      .values({
        id: randomUUID(),
        termId,
        state: 'new',
        stability: 0,
        difficulty: 0,
        dueAt: new Date(),
        lastReviewedAt: null,
      })
      .run();
  }
  ensureReviewCard(termId);
}

function previewValues(card: StoredReviewCard, now: Date): ReviewItem['preview'] {
  const preview = previewReview(card, now);
  return Object.fromEntries(
    (Object.keys(preview) as ReviewGrade[]).map((grade) => {
      const next = preview[grade];
      return [grade, {
        dueAt: next.dueAt.toISOString(),
        intervalMs: Math.max(0, next.dueAt.getTime() - now.getTime()),
        intervalLabel: formatReviewInterval(now, next.dueAt),
        scheduledDays: next.scheduledDays,
      }];
    }),
  ) as ReviewItem['preview'];
}

/** 到期队列投影：卡片、来源、四档预计间隔与今日工作量。 */
export function getReviewQueue(now = new Date(), limit = 20): ReviewQueue {
  const db = getDb();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const due = db
    .select({ c: count() })
    .from(schema.reviewCards)
    .where(lte(schema.reviewCards.dueAt, now))
    .get()?.c ?? 0;
  const overdue = db
    .select({ c: count() })
    .from(schema.reviewCards)
    .where(lte(schema.reviewCards.dueAt, startOfDay))
    .get()?.c ?? 0;
  const rows = db
    .select({
      card: schema.reviewCards,
      name: schema.terms.name,
      definition: schema.terms.definition,
    })
    .from(schema.reviewCards)
    .innerJoin(schema.terms, eq(schema.reviewCards.termId, schema.terms.id))
    .where(lte(schema.reviewCards.dueAt, now))
    .orderBy(asc(schema.reviewCards.dueAt))
    .limit(limit)
    .all();

  const reviews = rows.map(({ card, name, definition }) => {
    const source = db
      .select()
      .from(schema.conceptMentions)
      .where(and(
        eq(schema.conceptMentions.termId, card.termId),
        eq(schema.conceptMentions.sourceType, 'message'),
      ))
      .orderBy(desc(schema.conceptMentions.createdAt))
      .limit(1)
      .get();
    const session = source?.sessionId ? getSession(source.sessionId) : null;
    return {
      cardId: card.id,
      termId: card.termId,
      name,
      definition,
      state: card.state,
      stability: card.stability,
      difficulty: card.difficulty,
      dueAt: card.dueAt.toISOString(),
      isDifficult: card.isDifficult,
      sourceLabel: session ? `来源：${session.title}` : '来源：概念卡',
      sourceHref: source?.sessionId
        ? `/?session=${source.sessionId}&message=${source.sourceId}&concept=${card.termId}`
        : `/?concept=${card.termId}`,
      preview: previewValues(toStoredReviewCard(card), now),
    } satisfies ReviewItem;
  });

  return {
    reviews,
    summary: {
      due,
      overdue,
      estimatedMinutes: due === 0 ? 0 : Math.max(1, Math.ceil(due * 0.75)),
    },
  };
}

export function getDueReviews(limit = 20): ReviewItem[] {
  return getReviewQueue(new Date(), limit).reviews;
}

export type ReviewSubmissionResult = {
  logId: string;
  termId: string;
  grade: ReviewGrade;
  dueAt: Date;
  state: ReviewCard['state'];
  stability: number;
  difficulty: number;
  scheduledDays: number;
  intervalMs: number;
  intervalLabel: string;
};

function submissionFromLog(log: ReviewLog): ReviewSubmissionResult {
  return {
    logId: log.id,
    termId: log.termId,
    grade: log.rating,
    dueAt: log.dueAfter,
    state: log.stateAfter,
    stability: log.stabilityAfter,
    difficulty: log.difficultyAfter,
    scheduledDays: log.scheduledDaysAfter,
    intervalMs: Math.max(0, log.dueAfter.getTime() - log.reviewAt.getTime()),
    intervalLabel: formatReviewInterval(log.reviewAt, log.dueAfter),
  };
}

/** 应用一次正式 FSRS 评级，并在同一事务写卡片、投影、ReviewLog 与事件。 */
export function reviewTerm(input: {
  termId: string;
  grade: ReviewGrade;
  answerMode?: ReviewLog['answerMode'];
  recallText?: string | null;
  durationMs?: number;
  idempotencyKey: string;
  reviewedAt?: Date;
}): ReviewSubmissionResult {
  const db = getDb();
  const existingLog = db
    .select()
    .from(schema.reviewLogs)
    .where(eq(schema.reviewLogs.idempotencyKey, input.idempotencyKey))
    .limit(1)
    .get();
  if (existingLog) return submissionFromLog(existingLog);

  const reviewedAt = input.reviewedAt ?? new Date();
  const card = ensureReviewCard(input.termId, reviewedAt);
  const outcome = scheduleReview(toStoredReviewCard(card), input.grade, reviewedAt);
  const logId = randomUUID();
  const ws = ensureWorkspace();
  const logValues = {
    id: logId,
    workspaceId: ws.id,
    cardId: card.id,
    termId: input.termId,
    rating: input.grade,
    state: outcome.log.state,
    dueAt: outcome.log.dueAt,
    stability: outcome.log.stability,
    difficulty: outcome.log.difficulty,
    elapsedDays: outcome.log.elapsedDays,
    lastElapsedDays: outcome.log.lastElapsedDays,
    scheduledDays: outcome.log.scheduledDays,
    learningSteps: outcome.log.learningSteps,
    reviewAt: outcome.log.reviewAt,
    stateAfter: outcome.card.state,
    dueAfter: outcome.card.dueAt,
    stabilityAfter: outcome.card.stability,
    difficultyAfter: outcome.card.difficulty,
    scheduledDaysAfter: outcome.card.scheduledDays,
    learningStepsAfter: outcome.card.learningSteps,
    repsAfter: outcome.card.reps,
    lapsesAfter: outcome.card.lapses,
    durationMs: input.durationMs ?? 0,
    answerMode: input.answerMode ?? 'oral' as const,
    recallText: input.recallText ?? null,
    algorithmVersion: REVIEW_ALGORITHM_VERSION,
    idempotencyKey: input.idempotencyKey,
    createdAt: reviewedAt,
  } satisfies typeof schema.reviewLogs.$inferInsert;

  db.transaction((tx) => {
    tx.update(schema.reviewCards)
      .set({
        state: outcome.card.state,
        dueAt: outcome.card.dueAt,
        stability: outcome.card.stability,
        difficulty: outcome.card.difficulty,
        scheduledDays: outcome.card.scheduledDays,
        learningSteps: outcome.card.learningSteps,
        reps: outcome.card.reps,
        lapses: outcome.card.lapses,
        lastReviewAt: outcome.card.lastReviewAt,
        updatedAt: reviewedAt,
      })
      .where(eq(schema.reviewCards.id, card.id))
      .run();
    tx.update(schema.termMasteries)
      .set({
        state: outcome.card.state,
        stability: outcome.card.stability,
        difficulty: outcome.card.difficulty,
        dueAt: outcome.card.dueAt,
        lastReviewedAt: outcome.card.lastReviewAt,
      })
      .where(eq(schema.termMasteries.termId, input.termId))
      .run();
    tx.insert(schema.reviewLogs).values(logValues).run();
    tx.insert(schema.learningEvents)
      .values(eventValues({
        workspaceId: ws.id,
        action: 'reviewed',
        objectType: 'review_log',
        objectId: logId,
        result: {
          grade: input.grade,
          dueAt: outcome.card.dueAt.toISOString(),
          state: outcome.card.state,
          stability: outcome.card.stability,
          difficulty: outcome.card.difficulty,
          scheduledDays: outcome.card.scheduledDays,
          algorithmVersion: REVIEW_ALGORITHM_VERSION,
        },
        context: {
          termId: input.termId,
          answerMode: input.answerMode ?? 'oral',
          recallProvided: Boolean(input.recallText),
          durationMs: input.durationMs ?? 0,
        },
        idempotencyKey: input.idempotencyKey,
      })).run();
  });
  return submissionFromLog(logValues as ReviewLog);
}

export function listReviewLogs(termId?: string): ReviewLog[] {
  const query = getDb().select().from(schema.reviewLogs);
  return termId
    ? query.where(eq(schema.reviewLogs.termId, termId)).orderBy(desc(schema.reviewLogs.reviewAt)).all()
    : query.orderBy(desc(schema.reviewLogs.reviewAt)).all();
}

export class ReviewUndoConflictError extends Error {}

export function undoReview(input: {
  reviewLogId: string;
  idempotencyKey: string;
}) {
  const db = getDb();
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.result) return existingEvent.result;
  const log = db.select().from(schema.reviewLogs)
    .where(eq(schema.reviewLogs.id, input.reviewLogId)).limit(1).get();
  if (!log) throw new ReviewUndoConflictError('复习记录不存在');
  const priorUndo = db.select().from(schema.reviewUndos)
    .where(eq(schema.reviewUndos.reviewLogId, log.id)).limit(1).get();
  if (priorUndo) throw new ReviewUndoConflictError('这次评级已经撤销');
  const card = db.select().from(schema.reviewCards)
    .where(eq(schema.reviewCards.id, log.cardId)).limit(1).get();
  if (!card) throw new ReviewUndoConflictError('复习卡片不存在');
  if (card.reps !== log.repsAfter || card.lastReviewAt?.getTime() !== log.reviewAt.getTime()) {
    throw new ReviewUndoConflictError('只能撤销最近一次评级');
  }
  const storedLog: StoredReviewLog = {
    rating: log.rating,
    state: log.state,
    dueAt: log.dueAt,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsedDays: log.elapsedDays,
    lastElapsedDays: log.lastElapsedDays,
    scheduledDays: log.scheduledDays,
    learningSteps: log.learningSteps,
    reviewAt: log.reviewAt,
  };
  const restored = rollbackReview(toStoredReviewCard(card), storedLog);
  const ws = ensureWorkspace();
  const result = {
    reviewLogId: log.id,
    termId: log.termId,
    restoredDueAt: restored.dueAt.toISOString(),
    restoredState: restored.state,
  };
  db.transaction((tx) => {
    tx.update(schema.reviewCards).set({
      state: restored.state,
      dueAt: restored.dueAt,
      stability: restored.stability,
      difficulty: restored.difficulty,
      scheduledDays: restored.scheduledDays,
      learningSteps: restored.learningSteps,
      reps: restored.reps,
      lapses: restored.lapses,
      lastReviewAt: restored.lastReviewAt,
      updatedAt: new Date(),
    }).where(eq(schema.reviewCards.id, card.id)).run();
    tx.update(schema.termMasteries).set({
      state: restored.state,
      dueAt: restored.dueAt,
      stability: restored.stability,
      difficulty: restored.difficulty,
      lastReviewedAt: restored.lastReviewAt,
    }).where(eq(schema.termMasteries.termId, log.termId)).run();
    tx.insert(schema.reviewUndos).values({
      id: randomUUID(),
      workspaceId: ws.id,
      cardId: card.id,
      reviewLogId: log.id,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date(),
    }).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: ws.id,
      action: 'review_undone',
      objectType: 'review_log',
      objectId: log.id,
      result,
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return result;
}

export function setReviewCardDifficult(input: {
  termId: string;
  difficult: boolean;
  idempotencyKey: string;
}) {
  const existingEvent = findEventByIdempotencyKey(input.idempotencyKey);
  if (existingEvent?.result) return existingEvent.result;
  const db = getDb();
  const card = ensureReviewCard(input.termId);
  const ws = ensureWorkspace();
  const result = { termId: input.termId, difficult: input.difficult };
  db.transaction((tx) => {
    tx.update(schema.reviewCards)
      .set({ isDifficult: input.difficult, updatedAt: new Date() })
      .where(eq(schema.reviewCards.id, card.id))
      .run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: ws.id,
      action: 'review_card_flagged',
      objectType: 'review_card',
      objectId: card.id,
      result,
      idempotencyKey: input.idempotencyKey,
    })).run();
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

/**
 * 今日行动投影：只从已有状态表和事件构建，不生成虚假的日程或精确时长。
 * 每一类最多一个动作，供“今日学习”页直接渲染。
 */
export function getTodayLearningActions(): TodayLearningAction[] {
  const actions: TodayLearningAction[] = [];
  const recentEvent = getRecentEvents(1)[0];
  const recentSession = listSessions().find((session) => listMessages(session.id).length > 0);
  if (recentSession) {
    const latestMessage = listMessages(recentSession.id).at(-1);
    actions.push({
      id: `continue:${recentSession.id}`,
      kind: 'continue',
      title: `继续：${recentSession.title}`,
      description: latestMessage?.content.slice(0, 96) || '回到最近一次对话上下文。',
      source:
        recentEvent?.sessionId === recentSession.id
          ? `来自最近一次 ${recentEvent.action} 事件`
          : '来自最近活动会话',
      effort: '约 5–15 分钟',
      href: `/?session=${recentSession.id}`,
      actionLabel: '继续学习',
    });
  }

  const due = getDueReviews(20);
  if (due.length > 0) {
    actions.push({
      id: 'review:due',
      kind: 'review',
      title: `${due.length} 个概念已到期`,
      description: `从「${due[0].name}」开始主动回忆，完成后自动排定下次复习。`,
      source: `来自 term_masteries 到期时间`,
      effort: due.length > 5 ? '约 10–20 分钟' : '约 5–10 分钟',
      href: '/review',
      actionLabel: '开始复习',
    });
  }

  const weakConcept = getDb()
    .select({
      id: schema.terms.id,
      name: schema.terms.canonicalName,
      difficulty: schema.termMasteries.difficulty,
      state: schema.termMasteries.state,
    })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .all()
    .sort((left, right) => (right.difficulty ?? 0) - (left.difficulty ?? 0))[0];
  if (weakConcept) {
    actions.push({
      id: `practice:${weakConcept.id}`,
      kind: 'practice',
      title: `练习：${weakConcept.name}`,
      description: '用一个可运行任务检查是否能把概念应用到具体问题。',
      source: `来自掌握状态 ${weakConcept.state} 与难度记录`,
      effort: '约 10–20 分钟',
      href: `/practice?concept=${weakConcept.id}`,
      actionLabel: '进入练习',
    });
  }

  const resource = listResources().find((item) => item.status !== '已读');
  if (resource) {
    actions.push({
      id: `resource:${resource.id}`,
      kind: 'resource',
      title: `继续资源：${resource.title}`,
      description: resource.note || `${resource.type} · 当前状态「${resource.status}」`,
      source: `来自资源库 ${resource.status} 队列`,
      effort: '按内容自行安排',
      href: `/resources?resource=${resource.id}`,
      actionLabel: '打开资源',
    });
  }
  const note = listNotes()[0];
  if (note) {
    actions.push({
      id: `note:${note.id}`,
      kind: 'note',
      title: `回看笔记：${note.title}`,
      description: '从最近沉淀的知识文档恢复上下文。',
      source: '来自最近生成的学习笔记',
      effort: '约 5–10 分钟',
      href: `/notes?note=${note.id}`,
      actionLabel: '查看笔记',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'continue:first-chat',
      kind: 'continue',
      title: '从一个真实问题开始',
      description: '提出你当前最想弄懂的问题，Mentor 会从对话中建立概念、笔记和复习队列。',
      source: '当前工作区尚无学习记录',
      effort: '没有固定时长',
      href: '/',
      actionLabel: '开始对话',
    });
  }
  return actions;
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
    if (resource.termId) {
      tx.insert(schema.conceptMentions)
        .values({
          id: randomUUID(),
          termId: resource.termId,
          sourceType: 'resource',
          sourceId: resource.id,
          sessionId: null,
          locator: resource.url,
          excerpt: resource.note ?? resource.title,
          idempotencyKey: `${input.idempotencyKey}:mention`,
          createdAt: new Date(),
        })
        .run();
    }
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
