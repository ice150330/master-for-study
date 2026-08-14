import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { asc, count, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { scheduleReview, type ReviewGrade } from '../fsrs';

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
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite = new Database(path.join(dataDir, 'mentor.db'));
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

/** 按 id 查询单条面试记录。 */
export function getInterview(id: string): Interview | undefined {
  return getDb()
    .select()
    .from(schema.interviews)
    .where(eq(schema.interviews.id, id))
    .limit(1)
    .get();
}

/** 列出默认工作区下的全部会话（按创建时间升序）。 */
export function listSessions(): Session[] {
  const ws = ensureWorkspace();
  return getDb()
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.workspaceId, ws.id))
    .orderBy(asc(schema.sessions.createdAt))
    .all();
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
  getDb().insert(schema.sessions).values(session).run();
  return session;
}

/** 保存一条消息，并更新会话 updatedAt。 */
export function saveMessage(input: {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}): void {
  const db = getDb();
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
  return getDb()
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
  getDb()
    .insert(schema.learningEvents)
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
  const db = getDb();
  const existing = db
    .select()
    .from(schema.terms)
    .where(eq(schema.terms.name, input.name))
    .limit(1)
    .get();
  if (existing) return;

  const termId = randomUUID();
  db.insert(schema.terms)
    .values({
      id: termId,
      name: input.name,
      definition: input.definition,
      createdAt: new Date(),
    })
    .run();

  // 新术语加入复习队列
  ensureMastery(termId);
}

/** 新建一条学习笔记。 */
export function createNote(input: {
  sessionId?: string | null;
  title: string;
  content: Record<string, unknown>;
  markdown: string;
}): Note {
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
  getDb().insert(schema.notes).values(note).run();
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
export function createInterview(input: { question: string; sessionId?: string | null }): Interview {
  const interview = {
    id: randomUUID(),
    sessionId: input.sessionId ?? null,
    question: input.question,
    answer: null,
    feedback: null,
    correct: null,
    createdAt: new Date(),
  };
  getDb().insert(schema.interviews).values(interview).run();
  return interview;
}

/** 回填面试问答的作答与判分。 */
export function finishInterview(
  id: string,
  input: { answer: string; feedback: string; correct: boolean },
): void {
  getDb()
    .update(schema.interviews)
    .set({ answer: input.answer, feedback: input.feedback, correct: input.correct })
    .where(eq(schema.interviews.id, id))
    .run();
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
export function reviewTerm(termId: string, grade: ReviewGrade) {
  const db = getDb();
  const mastery = db
    .select()
    .from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, termId))
    .limit(1)
    .get();
  if (!mastery) {
    ensureMastery(termId);
  }
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
    grade,
  );

  db.update(schema.termMasteries)
    .set({
      state: result.state,
      stability: result.stability,
      difficulty: result.difficulty,
      dueAt: new Date(Date.now() + result.dueDays * 24 * 3600 * 1000),
      lastReviewedAt: new Date(),
    })
    .where(eq(schema.termMasteries.termId, termId))
    .run();

  recordEvent({ type: 'reviewed', entityId: termId, metadata: { grade } });
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
}): Resource {
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
  getDb().insert(schema.resources).values(resource).run();
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
export function updateResourceStatus(id: string, status: ResourceStatus): void {
  getDb()
    .update(schema.resources)
    .set({ status })
    .where(eq(schema.resources.id, id))
    .run();
}
