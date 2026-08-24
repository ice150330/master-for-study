import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { and, asc, count, desc, eq, getTableColumns, gt, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from 'drizzle-orm';
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
  interviewOverallScore,
  type InterviewEvaluation,
  type InterviewQuestionDraft,
  type InterviewSettings,
} from '../interview/types';
import { DEFAULT_TITLE, deriveSessionTitle } from '../session-title';
import { parseTermMarkers } from '../term-parse';
import { DEFAULT_TEACHER_STYLE } from '../ai/teacher-style';
import type { LearnerProfileSnapshot } from '../ai/learner-memory';
import { weaknessScore } from '../analytics/weakness';
import { KNOWLEDGE_SEED_EDGES, KNOWLEDGE_SEED_NODES } from '../knowledge/seed';
import type {
  KnowledgeEvidence,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeRelation,
} from '../knowledge/types';
import {
  analyticsCategory,
  buildActivityTrend,
  buildAnalyticsMetrics,
  localDateKey,
  rankWeakSkills,
} from '../analytics/projection';
import type {
  AnalyticsActivity,
  AnalyticsEventInput,
  AnalyticsInterviewInput,
  AnalyticsPracticeInput,
  AnalyticsProgress,
  AnalyticsRange,
  AnalyticsReviewInput,
  LearningAnalytics,
} from '../analytics/types';

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
export type ResourceTerm = typeof schema.resourceTerms.$inferSelect;
export type ResourceHighlight = typeof schema.resourceHighlights.$inferSelect;
export type MessageResource = typeof schema.messageResources.$inferSelect;
export type KnowledgeNode = typeof schema.knowledgeNodes.$inferSelect;
export type KnowledgeEdge = typeof schema.knowledgeEdges.$inferSelect;
export type KnowledgeNodeLayout = typeof schema.knowledgeNodeLayouts.$inferSelect;
export type ResourceType = Resource['type'];
export type ResourceStatus = Resource['status'];

export type ResourceDetail = Resource & {
  concepts: Array<{ id: string; name: string }>;
  highlights: ResourceHighlight[];
};

export type MessageWithResources = Message & {
  sources: Array<Pick<Resource, 'id' | 'title' | 'url' | 'type'>>;
};

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
  kind: 'continue' | 'review' | 'interview' | 'resource' | 'note';
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
  const active = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.isActive, true)).limit(1).get();
  if (active) return active;

  // 历史数据没有激活标记：激活最早的工作区，保证单工作区时代的数据无缝延续
  const existing = db.select().from(schema.workspaces)
    .orderBy(asc(schema.workspaces.createdAt)).limit(1).get();
  if (existing) {
    db.update(schema.workspaces).set({ isActive: true })
      .where(eq(schema.workspaces.id, existing.id)).run();
    return { ...existing, isActive: true };
  }

  const ws = {
    id: randomUUID(),
    title: DEFAULT_WORKSPACE_TITLE,
    goal: null,
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
  };
  db.insert(schema.workspaces).values(ws).run();
  return ws;
}

/** 工作区列表：激活的排最前，其余按创建时间倒序。 */
export function listWorkspaces(): Workspace[] {
  const db = getDb();
  return db.select().from(schema.workspaces)
    .orderBy(desc(schema.workspaces.isActive), desc(schema.workspaces.createdAt)).all();
}

/** 新建工作区并立即激活（新建即切换）。 */
export function createWorkspace(input: { title: string; goal?: string | null }): Workspace {
  const db = getDb();
  const ws = {
    id: randomUUID(),
    title: input.title.trim(),
    goal: input.goal?.trim() || null,
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
  } satisfies Workspace;
  db.transaction((tx) => {
    tx.update(schema.workspaces).set({ isActive: false }).run();
    tx.insert(schema.workspaces).values(ws).run();
  });
  return ws;
}

/** 编辑工作区元数据（标题 / 目标）。 */
export function renameWorkspace(
  id: string,
  input: { title?: string; goal?: string | null },
): Workspace | undefined {
  const db = getDb();
  const existing = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.id, id)).limit(1).get();
  if (!existing) return undefined;
  const patch: Partial<{ title: string; goal: string | null }> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.goal !== undefined) patch.goal = input.goal?.trim() || null;
  if (Object.keys(patch).length > 0) {
    db.update(schema.workspaces).set(patch).where(eq(schema.workspaces.id, id)).run();
  }
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).limit(1).get();
}

/** 切换当前工作区：事务内先全部去激活再激活目标，保证至多一个激活。 */
export function switchWorkspace(id: string): Workspace | undefined {
  const db = getDb();
  const target = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.id, id)).limit(1).get();
  if (!target) return undefined;
  db.transaction((tx) => {
    tx.update(schema.workspaces).set({ isActive: false }).run();
    tx.update(schema.workspaces).set({ isActive: true })
      .where(eq(schema.workspaces.id, id)).run();
  });
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).limit(1).get();
}

/** 归档 / 恢复工作区（C4）：归档后不再出现在切换列表；当前工作区不可归档。 */
export function setWorkspaceArchived(id: string, archived: boolean): Workspace | undefined {
  const db = getDb();
  const target = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.id, id)).limit(1).get();
  if (!target) return undefined;
  if (archived && target.isActive) {
    throw new Error('不能归档当前工作区，请先切换到别的工作区');
  }
  db.update(schema.workspaces)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(schema.workspaces.id, id)).run();
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).limit(1).get();
}

/**
 * 删除工作区及其全部学习过程数据（C4）。全局单源的概念（terms）与掌握度保留。
 * 事务内按依赖序清理：消息挂在会话上且无级联先删；其余工作区维度表直接删，
 * 子表（笔记版本/资源关联/复习日志等）由外键级联清理；当前工作区不可删除。
 */
export function deleteWorkspace(id: string): { deleted: boolean } {
  const db = getDb();
  const target = db.select().from(schema.workspaces)
    .where(eq(schema.workspaces.id, id)).limit(1).get();
  if (!target) return { deleted: false };
  if (target.isActive) {
    throw new Error('不能删除当前工作区，请先切换到别的工作区');
  }
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    const sessionIds = db.select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.workspaceId, id)).all()
      .map((row) => row.id);
    if (sessionIds.length > 0) {
      tx.delete(schema.messages)
        .where(inArray(schema.messages.sessionId, sessionIds)).run();
    }
    tx.delete(schema.workspaceSettings).where(eq(schema.workspaceSettings.workspaceId, id)).run();
    tx.delete(schema.reviewCards).where(eq(schema.reviewCards.workspaceId, id)).run();
    tx.delete(schema.practiceAttempts).where(eq(schema.practiceAttempts.workspaceId, id)).run();
    tx.delete(schema.learningEvents).where(eq(schema.learningEvents.workspaceId, id)).run();
    tx.delete(schema.notes).where(eq(schema.notes.workspaceId, id)).run();
    tx.delete(schema.resources).where(eq(schema.resources.workspaceId, id)).run();
    tx.delete(schema.interviews).where(eq(schema.interviews.workspaceId, id)).run();
    tx.delete(schema.interviewSessions).where(eq(schema.interviewSessions.workspaceId, id)).run();
    tx.delete(schema.knowledgeEdges).where(eq(schema.knowledgeEdges.workspaceId, id)).run();
    tx.delete(schema.knowledgeNodes).where(eq(schema.knowledgeNodes.workspaceId, id)).run();
    tx.delete(schema.sessions).where(eq(schema.sessions.workspaceId, id)).run();
    tx.delete(schema.workspaces).where(eq(schema.workspaces.id, id)).run();
  });
  return { deleted: true };
}

export type WorkspaceSettings = typeof schema.workspaceSettings.$inferSelect;

/** 可写入的设置字段（部分更新；场景覆盖列传 null 表示恢复跟随全局）。 */
export type WorkspaceSettingsPatch = Partial<{
  teacherStyle: string;
  interviewStyle: string | null;
  reviewStyle: string | null;
  growthGoal: string | null;
  dailyNewLimit: number;
  retentionTarget: number;
  answerDepth: string;
  memoryInjection: boolean;
}>;

/** 读取工作区设置，首次访问时落默认行。 */
export function getWorkspaceSettings(): WorkspaceSettings {
  const ws = ensureWorkspace();
  const existing = getDb().select().from(schema.workspaceSettings)
    .where(eq(schema.workspaceSettings.workspaceId, ws.id)).limit(1).get();
  if (existing) return existing;
  const defaults = {
    id: randomUUID(),
    workspaceId: ws.id,
    teacherStyle: DEFAULT_TEACHER_STYLE,
    interviewStyle: null,
    reviewStyle: null,
    growthGoal: null,
    dailyNewLimit: 10,
    retentionTarget: 0.85,
    answerDepth: 'standard',
    memoryInjection: true,
    updatedAt: new Date(),
  } satisfies WorkspaceSettings;
  getDb().insert(schema.workspaceSettings).values(defaults)
    .onConflictDoNothing({ target: schema.workspaceSettings.workspaceId }).run();
  return defaults;
}

/** 更新工作区设置（last-write-wins；设置变更不是学习行为，不写事件流）。 */
export function updateWorkspaceSettings(patch: WorkspaceSettingsPatch): WorkspaceSettings {
  const current = getWorkspaceSettings();
  getDb().update(schema.workspaceSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.workspaceSettings.id, current.id)).run();
  return getWorkspaceSettings();
}

/**
 * 学习者画像快照（A1 记忆注入）：近期学习主题 + 薄弱概念。
 * 薄弱概念只取「已确认入队且学过」的（排除 new 与待确认）；
 * 排序按薄弱度评分（B4：FSRS 难度 + 状态 + 回忆偏慢加权）。
 */
export function getLearnerProfileSnapshot(): LearnerProfileSnapshot {
  const db = getDb();
  const ws = ensureWorkspace();
  const recentTopics = db
    .select({ title: schema.sessions.title })
    .from(schema.sessions)
    .where(and(
      eq(schema.sessions.workspaceId, ws.id),
      isNull(schema.sessions.archivedAt),
    ))
    .orderBy(desc(schema.sessions.updatedAt))
    .limit(8)
    .all()
    .map((row) => row.title)
    .filter((title) => title !== DEFAULT_TITLE)
    .slice(0, 5);

  const candidates = db
    .select({
      termId: schema.termMasteries.termId,
      name: schema.terms.name,
      state: schema.termMasteries.state,
      difficulty: schema.termMasteries.difficulty,
    })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .where(and(
      eq(schema.termMasteries.queueStatus, 'active'),
      ne(schema.termMasteries.state, 'new'),
    ))
    .orderBy(desc(schema.termMasteries.difficulty))
    .limit(24)
    .all();
  const stats = recallDurationStats(ws.id);
  const weakConcepts = candidates
    .map((candidate) => ({
      candidate,
      score: weaknessScore({
        difficulty: candidate.difficulty,
        state: candidate.state,
        avgDurationMs: stats.perTerm.get(candidate.termId) ?? null,
        medianDurationMs: stats.median,
      }),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map(({ candidate }) => ({
      name: candidate.name,
      state: candidate.state,
      difficulty: candidate.difficulty,
    })) as LearnerProfileSnapshot['weakConcepts'];
  return { recentTopics, weakConcepts };
}

/** Token 用量摘要（C3 成本感知）：今日与累计（仅统计助手消息）。 */
export function getTokenUsageSummary(now = new Date()): {
  today: { input: number; output: number; total: number };
  total: { input: number; output: number; total: number };
} {
  const db = getDb();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sum = (rows: Array<{ usageInput: number | null; usageOutput: number | null; usageTotal: number | null }>) => ({
    input: rows.reduce((sum, row) => sum + (row.usageInput ?? 0), 0),
    output: rows.reduce((sum, row) => sum + (row.usageOutput ?? 0), 0),
    total: rows.reduce((sum, row) => sum + (row.usageTotal ?? (row.usageInput ?? 0) + (row.usageOutput ?? 0)), 0),
  });
  const columns = {
    usageInput: schema.messages.usageInput,
    usageOutput: schema.messages.usageOutput,
    usageTotal: schema.messages.usageTotal,
  };
  const all = db.select(columns).from(schema.messages)
    .where(and(eq(schema.messages.role, 'assistant'), isNotNull(schema.messages.usageTotal)))
    .all();
  const todayRows = db.select(columns).from(schema.messages)
    .where(and(
      eq(schema.messages.role, 'assistant'),
      isNotNull(schema.messages.usageTotal),
      gte(schema.messages.createdAt, startOfDay),
    ))
    .all();
  return { today: sum(todayRows), total: sum(all) };
}

/** 回忆耗时统计（B4 隐性感知）：每概念均值 + 全局中位；0 值日志（历史/口头快评）不计入。 */
function recallDurationStats(workspaceId: string): {
  perTerm: Map<string, number>;
  median: number | null;
} {
  const rows = getDb()
    .select({
      termId: schema.reviewLogs.termId,
      durationMs: schema.reviewLogs.durationMs,
    })
    .from(schema.reviewLogs)
    .where(and(
      eq(schema.reviewLogs.workspaceId, workspaceId),
      gt(schema.reviewLogs.durationMs, 0),
    ))
    .all();
  const buckets = new Map<string, number[]>();
  const all: number[] = [];
  for (const row of rows) {
    const list = buckets.get(row.termId) ?? [];
    list.push(row.durationMs);
    buckets.set(row.termId, list);
    all.push(row.durationMs);
  }
  const perTerm = new Map<string, number>();
  for (const [termId, list] of buckets) {
    perTerm.set(termId, list.reduce((sum, value) => sum + value, 0) / list.length);
  }
  all.sort((left, right) => left - right);
  const median = all.length === 0
    ? null
    : all.length % 2 === 1
      ? all[(all.length - 1) / 2]
      : (all[all.length / 2 - 1] + all[all.length / 2]) / 2;
  return { perTerm, median };
}

export type WorkspaceExport = {
  generatedAt: Date;
  tables: Record<string, unknown[]>;
};

/**
 * 全库导出（备份/迁移用）：按 schema 导出名返回全部表行。
 * Date 字段保持原样，由调用方在 JSON 序列化时转 ISO 字符串。
 */
export function exportWorkspaceData(): WorkspaceExport {
  getDb(); // 确保连接与迁移已就绪
  const tables: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(schema)) {
    tables[name] = getDb().select().from(table).all();
  }
  return { generatedAt: new Date(), tables };
}

/**
 * 整库导入（B1 备份恢复）：事务内先清空全部表再插入导出快照。
 * - 表键必须是 schema 已知导出名，未知键直接抛错（整笔拒绝，不产生半状态）；
 * - `PRAGMA defer_foreign_keys` 让清空与插入顺序对外键免疫，提交时统一校验；
 * - 日期列按 schema 列类型把 ISO 字符串还原为 Date。
 */
export function importWorkspaceData(payload: {
  generatedAt?: unknown;
  tables: Record<string, unknown[]>;
}): { imported: Record<string, number> } {
  const db = getDb();
  const entries = Object.entries(schema);
  const known = new Map(entries);
  for (const key of Object.keys(payload.tables ?? {})) {
    if (!known.has(key)) throw new Error(`导出文件包含未知表：${key}`);
  }

  // 日期列清单（timestamp_ms 模式 dataType === 'date'）
  const dateColumns = new Map<string, Set<string>>();
  for (const [name, table] of entries) {
    const dates = new Set<string>();
    for (const [columnName, column] of Object.entries(getTableColumns(table))) {
      if ((column as { dataType?: string }).dataType === 'date') dates.add(columnName);
    }
    dateColumns.set(name, dates);
  }

  const imported: Record<string, number> = {};
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    // 先清空（含未出现在快照中的表，保证"恢复到快照时刻"语义）
    for (const [, table] of entries) {
      tx.delete(table).run();
    }
    for (const [name, table] of entries) {
      const rows = payload.tables[name];
      if (!rows) continue;
      const dates = dateColumns.get(name) ?? new Set<string>();
      for (const raw of rows) {
        const row = { ...(raw as Record<string, unknown>) };
        for (const key of dates) {
          const value = row[key];
          if (typeof value === 'string' && value) {
            const parsed = new Date(value);
            row[key] = Number.isNaN(parsed.getTime()) ? null : parsed;
          }
        }
        tx.insert(table).values(row as never).run();
      }
      imported[name] = rows.length;
    }
  });
  return { imported };
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

export function getReviewLog(id: string): ReviewLog | undefined {
  return getDb().select().from(schema.reviewLogs)
    .where(eq(schema.reviewLogs.id, id)).limit(1).get();
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
  resourceIds?: string[];
  /** C3 成本感知：助手消息可携带本次生成的 token 用量 */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
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
    usageInput: input.usage?.inputTokens ?? null,
    usageOutput: input.usage?.outputTokens ?? null,
    usageTotal: input.usage?.totalTokens ?? null,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date(),
  };

  db.transaction((tx) => {
    tx.insert(schema.messages).values(message).run();
    const validResourceIds = [...new Set(input.resourceIds ?? [])].filter((resourceId) =>
      Boolean(tx.select({ id: schema.resources.id }).from(schema.resources)
        .where(and(eq(schema.resources.id, resourceId), eq(schema.resources.workspaceId, session.workspaceId)))
        .limit(1).get()));
    if (validResourceIds.length > 0) {
      tx.insert(schema.messageResources).values(validResourceIds.map((resourceId, position) => ({
        messageId: message.id,
        resourceId,
        position,
        createdAt: new Date(),
      }))).run();
    }
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
          result: { role: input.role, length: input.content.length, resourceCount: validResourceIds.length },
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

/** 会话展示使用：消息附带已持久化的资源引用。 */
export function listMessagesWithResources(sessionId: string): MessageWithResources[] {
  return listMessages(sessionId).map((message) => ({
    ...message,
    sources: getDb()
      .select({
        id: schema.resources.id,
        title: schema.resources.title,
        url: schema.resources.url,
        type: schema.resources.type,
        position: schema.messageResources.position,
      })
      .from(schema.messageResources)
      .innerJoin(schema.resources, eq(schema.messageResources.resourceId, schema.resources.id))
      .where(eq(schema.messageResources.messageId, message.id))
      .orderBy(asc(schema.messageResources.position))
      .all()
      .map(({ id, title, url, type }) => ({ id, title, url, type })),
  }));
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
          queueStatus: 'pending',
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
/** B2 概念定义修正：更新单源术语定义，复习卡 / 知识图经动态 join 自动联动；非学习行为不写事件流。 */
export function updateTermDefinition(termId: string, definition: string): Term | undefined {
  const db = getDb();
  const existing = db.select().from(schema.terms).where(eq(schema.terms.id, termId)).limit(1).get();
  if (!existing) return undefined;
  db.update(schema.terms).set({ definition }).where(eq(schema.terms.id, termId)).run();
  return db.select().from(schema.terms).where(eq(schema.terms.id, termId)).limit(1).get();
}

/** 全局内容搜索结果条目（C1）：type 决定前端跳转目标。 */
export type SearchHit = {
  type: 'session' | 'message' | 'concept' | 'note' | 'resource';
  id: string;
  title: string;
  excerpt: string;
  /** 消息命中时带回所属会话，供 /?session=&message= 定位 */
  sessionId?: string;
};

function likePattern(query: string) {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * 跨模块内容搜索（C1）：会话标题、消息正文、概念、笔记与资源，
 * 按当前工作区作用域，每类最多 limit 条。LIKE 通配符已转义。
 */
export function searchContent(query: string, limit = 5): SearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const db = getDb();
  const ws = ensureWorkspace();
  const pattern = likePattern(trimmed);
  const hits: SearchHit[] = [];

  const sessions = db.select().from(schema.sessions)
    .where(and(
      eq(schema.sessions.workspaceId, ws.id),
      like(schema.sessions.title, pattern),
    ))
    .orderBy(desc(schema.sessions.updatedAt)).limit(limit).all();
  for (const session of sessions) {
    hits.push({ type: 'session', id: session.id, title: session.title, excerpt: '学习会话' });
  }

  const messages = db.select({
    id: schema.messages.id,
    sessionId: schema.messages.sessionId,
    content: schema.messages.content,
    sessionTitle: schema.sessions.title,
  })
    .from(schema.messages)
    .innerJoin(schema.sessions, eq(schema.messages.sessionId, schema.sessions.id))
    .where(and(
      eq(schema.sessions.workspaceId, ws.id),
      like(schema.messages.content, pattern),
    ))
    .orderBy(desc(schema.messages.createdAt)).limit(limit).all();
  for (const message of messages) {
    hits.push({
      type: 'message',
      id: message.id,
      sessionId: message.sessionId,
      title: message.sessionTitle,
      excerpt: excerptOf(message.content, trimmed),
    });
  }

  const terms = db.select().from(schema.terms)
    .where(or(
      like(schema.terms.name, pattern),
      like(schema.terms.definition, pattern),
    ))
    .orderBy(desc(schema.terms.createdAt)).limit(limit).all();
  for (const term of terms) {
    hits.push({ type: 'concept', id: term.id, title: term.canonicalName || term.name, excerpt: excerptOf(term.definition, trimmed) });
  }

  const notes = db.select().from(schema.notes)
    .where(and(
      eq(schema.notes.workspaceId, ws.id),
      or(like(schema.notes.title, pattern), like(schema.notes.markdown, pattern)),
    ))
    .orderBy(desc(schema.notes.createdAt)).limit(limit).all();
  for (const note of notes) {
    hits.push({ type: 'note', id: note.id, title: note.title, excerpt: excerptOf(note.markdown, trimmed) });
  }

  const resources = db.select().from(schema.resources)
    .where(and(
      eq(schema.resources.workspaceId, ws.id),
      or(like(schema.resources.title, pattern), like(schema.resources.description, pattern)),
    ))
    .orderBy(desc(schema.resources.createdAt)).limit(limit).all();
  for (const resource of resources) {
    hits.push({
      type: 'resource',
      id: resource.id,
      title: resource.title,
      excerpt: excerptOf(`${resource.description ?? ''} ${resource.url}`, trimmed),
    });
  }

  return hits;
}

/** 取命中词附近片段做摘要。 */
function excerptOf(content: string, query: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const index = normalized.toLocaleLowerCase('zh-CN').indexOf(query.toLocaleLowerCase('zh-CN'));
  if (index < 0) return normalized.slice(0, 60);
  const start = Math.max(0, index - 18);
  return (start > 0 ? '…' : '') + normalized.slice(start, start + 60);
}

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

/** 为术语创建掌握度与正式 FSRS 卡片（不存在时立即到期）。新概念默认「待确认」，不直接进队列。 */
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
        queueStatus: 'pending',
        stability: 0,
        difficulty: 0,
        dueAt: new Date(),
        lastReviewedAt: null,
      })
      .run();
  }
  ensureReviewCard(termId);
}

/** 队列状态流转（A2 队列治理）：确认入队 / 移出 / 恢复。 */
export function setTermQueueStatus(
  termId: string,
  queueStatus: 'pending' | 'active' | 'dismissed',
): void {
  ensureMastery(termId);
  getDb().update(schema.termMasteries)
    .set({ queueStatus })
    .where(eq(schema.termMasteries.termId, termId)).run();
}

/** 跳过本次 / 降频：只顺延到期时间，不改 FSRS 状态、不写复习日志（这不是一次检索）。 */
export function deferReviewCard(termId: string, days: number): void {
  const card = ensureReviewCard(termId);
  const base = Math.max(card.dueAt.getTime(), Date.now());
  const dueAt = new Date(base + days * 86_400_000);
  getDb().update(schema.reviewCards)
    .set({ dueAt })
    .where(eq(schema.reviewCards.id, card.id)).run();
}

/** 待确认概念清单（复习页空态批量确认用）。terms 与 mastery 均为全局单源，不做工作区过滤。 */
export function listPendingQueueTerms(limit = 30): Array<{
  termId: string;
  name: string;
  definition: string;
}> {
  const db = getDb();
  return db
    .select({
      termId: schema.terms.id,
      name: schema.terms.name,
      definition: schema.terms.definition,
    })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .where(eq(schema.termMasteries.queueStatus, 'pending'))
    .orderBy(desc(schema.termMasteries.dueAt))
    .limit(limit)
    .all();
}

function previewValues(card: StoredReviewCard, now: Date, retention: number): ReviewItem['preview'] {
  const preview = previewReview(card, now, retention);
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

/** 今日已引入的新卡数（评级前状态为 new 的复习日志数），用于「每日新学量」上限。 */
function countIntroducedToday(now: Date): number {
  const db = getDb();
  const ws = ensureWorkspace();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  return db.select({ c: count() }).from(schema.reviewLogs)
    .where(and(
      eq(schema.reviewLogs.workspaceId, ws.id),
      eq(schema.reviewLogs.state, 'new'),
      gte(schema.reviewLogs.reviewAt, startOfDay),
    )).get()?.c ?? 0;
}

/**
 * 拉取到期卡片并按「每日新学量」上限过滤新卡：
 * 今天已引入的新卡用完后，剩余新卡顺延到明天（旧卡不受影响）。
 */
function visibleDueRows(now: Date) {
  const db = getDb();
  const ws = ensureWorkspace();
  const settings = getWorkspaceSettings();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const rows = db
    .select({
      card: schema.reviewCards,
      name: schema.terms.name,
      definition: schema.terms.definition,
      queueStatus: schema.termMasteries.queueStatus,
    })
    .from(schema.reviewCards)
    .innerJoin(schema.terms, eq(schema.reviewCards.termId, schema.terms.id))
    // 队列治理：仅「已确认入队」的卡进入到期队列（历史行默认 active）
    .leftJoin(schema.termMasteries, eq(schema.reviewCards.termId, schema.termMasteries.termId))
    .where(and(
      eq(schema.reviewCards.workspaceId, ws.id),
      lte(schema.reviewCards.dueAt, now),
      or(
        isNull(schema.termMasteries.queueStatus),
        eq(schema.termMasteries.queueStatus, 'active'),
      ),
    ))
    .orderBy(asc(schema.reviewCards.dueAt))
    .all();
  const remainingNew = Math.max(0, settings.dailyNewLimit - countIntroducedToday(now));
  let newSeen = 0;
  const visible = rows.filter(({ card }) => {
    if (card.state !== 'new') return true;
    newSeen += 1;
    return newSeen <= remainingNew;
  });
  return { visible, startOfDay, retention: settings.retentionTarget };
}

/** 到期队列投影：卡片、来源、四档预计间隔与今日工作量。 */
export function getReviewQueue(now = new Date(), limit = 20): ReviewQueue {
  const db = getDb();
  const { visible, startOfDay, retention } = visibleDueRows(now);
  const summary = summarizeDue(visible, startOfDay);

  const reviews = visible.slice(0, limit).map(({ card, name, definition }) => {
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
      preview: previewValues(toStoredReviewCard(card), now, retention),
    } satisfies ReviewItem;
  });

  return {
    reviews,
    summary,
  };
}

/** 负荷摘要：与新卡上限过滤后的可见集保持一致。 */
function summarizeDue(
  visible: Array<{ card: { dueAt: Date } }>,
  startOfDay: Date,
): ReviewQueue['summary'] {
  const due = visible.length;
  const overdue = visible.filter(({ card }) => card.dueAt.getTime() <= startOfDay.getTime()).length;
  return {
    due,
    overdue,
    estimatedMinutes: due === 0 ? 0 : Math.max(1, Math.ceil(due * 0.75)),
  };
}

/** 只统计当前工作区负荷（同样受每日新学量上限约束），供首页和分析投影复用。 */
function getReviewLoadSummary(now = new Date()): ReviewQueue['summary'] {
  const { visible, startOfDay } = visibleDueRows(now);
  return summarizeDue(visible, startOfDay);
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
  // 调度沿用「复习保留率目标」设置；ReviewLog 记录的是实际调度结果，可复算。
  const retention = getWorkspaceSettings().retentionTarget;
  const outcome = scheduleReview(toStoredReviewCard(card), input.grade, reviewedAt, retention);
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
 * 成长分析投影：所有比率来自不可变事件或 Attempt / ReviewLog，
 * 小样本阈值与趋势填充由纯函数统一处理。
 */
export function getLearningAnalytics(rangeDays: AnalyticsRange = 7, now = new Date()): LearningAnalytics {
  const db = getDb();
  const workspace = ensureWorkspace();
  const rangeStart = new Date(now);
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(rangeStart.getDate() - rangeDays + 1);

  const eventRows = db.select().from(schema.learningEvents)
    .where(eq(schema.learningEvents.workspaceId, workspace.id))
    .orderBy(desc(schema.learningEvents.createdAt)).all();
  const events = eventRows.filter((event) => event.createdAt >= rangeStart && event.createdAt <= now)
    .map((event) => ({
      id: event.id,
      action: event.action,
      objectType: event.objectType,
      objectId: event.objectId,
      sessionId: event.sessionId,
      result: event.result,
      context: event.context,
      createdAt: event.createdAt,
    } satisfies AnalyticsEventInput));

  const practiceAttempts = db.select().from(schema.practiceAttempts)
    .where(eq(schema.practiceAttempts.workspaceId, workspace.id))
    .orderBy(desc(schema.practiceAttempts.createdAt)).all();
  const practicesInRange: AnalyticsPracticeInput[] = practiceAttempts
    .filter((attempt) => attempt.createdAt >= rangeStart && attempt.createdAt <= now)
    .map((attempt) => ({
      id: attempt.id,
      conceptId: attempt.conceptId,
      challengeId: attempt.challengeId,
      status: attempt.status,
      hintCount: attempt.hintCount,
      skills: attempt.skills,
      createdAt: attempt.createdAt,
    }));

  const interviewRows = db.select({
    attempt: schema.interviewAttempts,
    termId: schema.interviews.termId,
    skill: schema.interviews.skill,
  }).from(schema.interviewAttempts)
    .innerJoin(schema.interviews, eq(schema.interviewAttempts.interviewId, schema.interviews.id))
    .where(eq(schema.interviews.workspaceId, workspace.id))
    .orderBy(desc(schema.interviewAttempts.createdAt)).all();
  const interviewsInRange: AnalyticsInterviewInput[] = interviewRows
    .filter(({ attempt }) => attempt.createdAt >= rangeStart && attempt.createdAt <= now)
    .map(({ attempt, termId, skill }) => ({
      id: attempt.id,
      interviewId: attempt.interviewId,
      termId,
      skill,
      correct: attempt.correct,
      score: interviewOverallScore(attempt.scores),
      nextStrategy: attempt.nextStrategy,
      createdAt: attempt.createdAt,
    }));

  const reviewLogs = db.select().from(schema.reviewLogs)
    .where(eq(schema.reviewLogs.workspaceId, workspace.id))
    .orderBy(desc(schema.reviewLogs.reviewAt)).all();
  const reviewsInRange: AnalyticsReviewInput[] = reviewLogs
    .filter((log) => log.reviewAt >= rangeStart && log.reviewAt <= now)
    .map((log) => ({ id: log.id, termId: log.termId, rating: log.rating, reviewAt: log.reviewAt }));

  const concepts = db.select({
    id: schema.terms.id,
    name: schema.terms.canonicalName,
    state: schema.termMasteries.state,
    difficulty: schema.termMasteries.difficulty,
    dueAt: schema.termMasteries.dueAt,
  }).from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id)).all();
  const weakSkills = rankWeakSkills({
    concepts,
    practiceAttempts: practicesInRange,
    interviewAttempts: interviewsInRange,
    reviewLogs: reviewsInRange,
    now,
  });

  const reviewSummary = getReviewLoadSummary(now);
  const activities = enrichAnalyticsActivities({
    events,
    practiceAttempts,
    interviewAttempts: interviewsInRange,
    reviewLogs,
  });
  const progress = buildAnalyticsProgress(activities);
  const todayKey = localDateKey(now);
  const completedActions = events.filter((event) => (
    localDateKey(event.createdAt) === todayKey && analyticsCategory(event.action)
  )).length;
  const recommendation = reviewSummary.due > 0
    ? {
        eyebrow: '优先处理记忆负荷',
        title: `${reviewSummary.due} 个概念已到复习时间`,
        description: reviewSummary.overdue > 0
          ? `其中 ${reviewSummary.overdue} 个已逾期，先主动回忆再继续新内容。`
          : '先完成短时主动回忆，避免未来几天负荷继续堆积。',
        href: '/review',
        actionLabel: '开始复习',
      }
    : weakSkills[0]
      ? {
          eyebrow: '来自最近证据的建议',
          title: `巩固「${weakSkills[0].name}」`,
          description: weakSkills[0].evidence.join('；'),
          href: weakSkills[0].actionHref,
          actionLabel: weakSkills[0].actionLabel,
        }
      : {
          eyebrow: '当前没有积压',
          title: '继续一个真实问题',
          description: '新的对话会继续形成概念、练习和复习证据。',
          href: '/',
          actionLabel: '继续学习',
        };

  return {
    rangeDays,
    generatedAt: now.toISOString(),
    today: {
      dueReviews: reviewSummary.due,
      overdueReviews: reviewSummary.overdue,
      estimatedMinutes: reviewSummary.estimatedMinutes,
      completedActions,
    },
    recommendation,
    trend: buildActivityTrend(events, rangeDays, now),
    metrics: buildAnalyticsMetrics({
      events,
      practiceAttempts: practicesInRange,
      interviewAttempts: interviewsInRange,
      reviewLogs: reviewsInRange,
    }),
    weakSkills,
    progress,
    recentActivities: activities.slice(0, 80),
  };
}

function enrichAnalyticsActivities(input: {
  events: AnalyticsEventInput[];
  practiceAttempts: PracticeAttempt[];
  interviewAttempts: AnalyticsInterviewInput[];
  reviewLogs: ReviewLog[];
}): AnalyticsActivity[] {
  const db = getDb();
  const terms = new Map(db.select().from(schema.terms).all().map((term) => [term.id, term]));
  const sessions = new Map(db.select().from(schema.sessions).all().map((session) => [session.id, session]));
  const messages = new Map(db.select().from(schema.messages).all().map((message) => [message.id, message]));
  const notes = new Map(db.select().from(schema.notes).all().map((note) => [note.id, note]));
  const resources = new Map(db.select().from(schema.resources).all().map((resource) => [resource.id, resource]));
  const practices = new Map(input.practiceAttempts.map((attempt) => [attempt.id, attempt]));
  const interviews = new Map(input.interviewAttempts.map((attempt) => [attempt.id, attempt]));
  const reviews = new Map(input.reviewLogs.map((log) => [log.id, log]));

  return input.events.flatMap((event) => {
    const category = analyticsCategory(event.action);
    if (!category) return [];
    const objectId = event.objectId ?? '';
    const practice = practices.get(objectId);
    const interview = interviews.get(objectId);
    const review = reviews.get(objectId);
    const message = messages.get(objectId);
    const termId = event.objectType === 'term'
      ? objectId
      : review?.termId ?? practice?.conceptId ?? interview?.termId ?? stringValue(event.context?.termId);
    const term = termId ? terms.get(termId) : undefined;
    const session = event.sessionId ? sessions.get(event.sessionId) : undefined;
    const note = notes.get(objectId);
    const resource = resources.get(objectId);
    const objectTitle = term?.canonicalName
      || note?.title
      || resource?.title
      || interview?.skill
      || session?.title
      || message?.content.slice(0, 72)
      || ANALYTICS_OBJECT_LABELS[event.objectType]
      || '学习记录';
    const href = activityHref({ event, termId, practice, interview, review });
    return [{
      id: event.id,
      category,
      actionLabel: ANALYTICS_ACTION_LABELS[event.action] ?? event.action,
      objectTitle,
      resultLabel: activityResult({ event, practice, interview, review }),
      createdAt: event.createdAt.toISOString(),
      date: localDateKey(event.createdAt),
      href,
    } satisfies AnalyticsActivity];
  });
}

function buildAnalyticsProgress(activities: AnalyticsActivity[]): AnalyticsProgress[] {
  return activities.filter((activity) => (
    activity.resultLabel.includes('通过')
      || activity.resultLabel.includes('取回')
      || activity.resultLabel.includes('进阶')
      || activity.resultLabel.includes('已读')
  )).slice(0, 3).map((activity) => ({
    id: activity.id,
    title: activity.objectTitle,
    detail: `${activity.actionLabel} · ${activity.resultLabel}`,
    createdAt: activity.createdAt,
    href: activity.href,
  }));
}

function activityHref(input: {
  event: AnalyticsEventInput;
  termId: string | null;
  practice?: PracticeAttempt;
  interview?: AnalyticsInterviewInput;
  review?: ReviewLog;
}) {
  const { event, termId, practice, interview, review } = input;
  if (practice) return `/analytics${termId ? `?concept=${termId}` : ''}#activity-ledger`;
  if (interview) return `/interview?attempt=interview%3A${interview.id}${termId ? `&concept=${termId}` : ''}`;
  if (review) return `/review?attempt=review%3A${review.id}&concept=${review.termId}`;
  if (event.objectType === 'note' && event.objectId) return `/notes?note=${event.objectId}&source=note%3A${event.objectId}`;
  if (event.objectType === 'resource' && event.objectId) return `/resources?resource=${event.objectId}&source=resource%3A${event.objectId}`;
  if (termId) return `/?concept=${termId}`;
  if (event.sessionId) return `/?session=${event.sessionId}${event.objectId ? `&message=${event.objectId}&source=message%3A${event.sessionId}%3A${event.objectId}` : ''}`;
  return '/today';
}

function activityResult(input: {
  event: AnalyticsEventInput;
  practice?: PracticeAttempt;
  interview?: AnalyticsInterviewInput;
  review?: ReviewLog;
}) {
  const { event, practice, interview, review } = input;
  if (practice) return practice.status === 'success'
    ? '任务通过'
    : `未通过${practice.errorType ? ` · ${practice.errorType}` : ''}`;
  if (interview) {
    const strategy = interview.nextStrategy === 'advance' ? '进阶' : interview.nextStrategy === 'downgrade' ? '降级巩固' : '保持难度';
    return `${interview.score} 分 · ${strategy}`;
  }
  if (review) return review.rating === 'again' ? '未取回 · Again' : `成功取回 · ${review.rating}`;
  const status = stringValue(event.result?.status);
  if (status) return status;
  if (event.action === 'message_sent') return '回答已完成';
  if (event.action === 'term_seen') return '进入概念库';
  if (event.action === 'note_created') return '知识已沉淀';
  if (event.action === 'resource_highlight_created') return '摘录已保存';
  return '已记录';
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

const ANALYTICS_ACTION_LABELS: Record<string, string> = {
  session_created: '开始会话',
  message_sent: '完成对话',
  term_seen: '发现概念',
  note_created: '生成笔记',
  note_updated: '更新笔记',
  practice_attempted: 'SQL 评测',
  interview_answered: '面试作答',
  reviewed: '主动复习',
  resource_created: '添加资料',
  resource_updated: '更新资料',
  resource_status_changed: '阅读进度',
  resource_highlight_created: '保存摘录',
};

const ANALYTICS_OBJECT_LABELS: Record<string, string> = {
  session: '学习会话',
  message: '对话回答',
  term: '知识概念',
  note: '学习笔记',
  resource: '学习资料',
  resource_highlight: '资料摘录',
  practice_attempt: '练习尝试',
  interview_attempt: '面试尝试',
  review_log: '复习记录',
};

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

  // 薄弱点推荐（B4 隐性感知）：难度预筛后按薄弱度评分（含回忆偏慢加权）取最弱一个
  const weakCandidates = getDb()
    .select({
      id: schema.terms.id,
      termId: schema.termMasteries.termId,
      name: schema.terms.canonicalName,
      difficulty: schema.termMasteries.difficulty,
      state: schema.termMasteries.state,
    })
    .from(schema.termMasteries)
    .innerJoin(schema.terms, eq(schema.termMasteries.termId, schema.terms.id))
    .all()
    .sort((left, right) => (right.difficulty ?? 0) - (left.difficulty ?? 0))
    .slice(0, 12);
  const durationStats = recallDurationStats(ensureWorkspace().id);
  const weakConcept = weakCandidates
    .map((candidate) => ({
      candidate,
      score: weaknessScore({
        difficulty: candidate.difficulty,
        state: candidate.state,
        avgDurationMs: durationStats.perTerm.get(candidate.termId) ?? null,
        medianDurationMs: durationStats.median,
      }),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;
  if (weakConcept) {
    actions.push({
      id: `interview:${weakConcept.id}`,
      kind: 'interview',
      title: `测验：${weakConcept.name}`,
      description: '用一次结构化问答检查是否真正理解这个概念。',
      source: `来自掌握状态 ${weakConcept.state} 与难度记录`,
      effort: '约 10–20 分钟',
      href: `/interview?concept=${weakConcept.id}`,
      actionLabel: '开始测验',
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
  canonicalUrl?: string;
  siteName?: string | null;
  author?: string | null;
  description?: string | null;
  faviconUrl?: string | null;
  termId?: string | null;
  conceptIds?: string[];
  tags?: string[];
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
  const conceptIds = [...new Set([
    ...(input.conceptIds ?? []),
    ...(input.termId ? [input.termId] : []),
  ])].filter((termId) => Boolean(getTerm(termId)));
  const now = new Date();
  const resource = {
    id: randomUUID(),
    workspaceId: ws.id,
    termId: conceptIds[0] ?? null,
    title: input.title,
    type: input.type,
    url: input.url,
    canonicalUrl: input.canonicalUrl ?? input.url,
    siteName: input.siteName ?? null,
    author: input.author ?? null,
    description: input.description ?? null,
    faviconUrl: input.faviconUrl ?? null,
    status: '想读' as const,
    progress: 0,
    tags: [...new Set(input.tags ?? [])],
    note: input.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  getDb().transaction((tx) => {
    tx.insert(schema.resources).values(resource).run();
    if (conceptIds.length > 0) {
      tx.insert(schema.resourceTerms).values(conceptIds.map((termId) => ({
        resourceId: resource.id,
        termId,
        createdAt: now,
      }))).run();
      tx.insert(schema.conceptMentions)
        .values(conceptIds.map((termId) => ({
          id: randomUUID(),
          termId,
          sourceType: 'resource' as const,
          sourceId: resource.id,
          sessionId: null,
          locator: resource.url,
          excerpt: resource.note ?? resource.title,
          idempotencyKey: `${input.idempotencyKey}:mention:${termId}`,
          createdAt: now,
        })))
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
          context: { conceptIds, canonicalUrl: resource.canonicalUrl },
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

export function findResourceByCanonicalUrl(canonicalUrl: string): Resource | undefined {
  const ws = ensureWorkspace();
  return getDb().select().from(schema.resources)
    .where(and(eq(schema.resources.workspaceId, ws.id), eq(schema.resources.canonicalUrl, canonicalUrl)))
    .limit(1).get();
}

export function getResourceDetail(id: string): ResourceDetail | undefined {
  const resource = getResource(id);
  if (!resource) return undefined;
  const db = getDb();
  const concepts = db.select({ id: schema.terms.id, name: schema.terms.name })
    .from(schema.resourceTerms)
    .innerJoin(schema.terms, eq(schema.resourceTerms.termId, schema.terms.id))
    .where(eq(schema.resourceTerms.resourceId, id))
    .orderBy(asc(schema.terms.name)).all();
  if (concepts.length === 0 && resource.termId) {
    const legacy = getTerm(resource.termId);
    if (legacy) concepts.push({ id: legacy.id, name: legacy.name });
  }
  const highlights = db.select().from(schema.resourceHighlights)
    .where(eq(schema.resourceHighlights.resourceId, id))
    .orderBy(desc(schema.resourceHighlights.createdAt)).all();
  return { ...resource, concepts, highlights };
}

export function listResourceDetails(): ResourceDetail[] {
  return listResources().map((resource) => getResourceDetail(resource.id)).filter(
    (resource): resource is ResourceDetail => Boolean(resource),
  );
}

/** 重复 URL 不新建条目，只合并新的 Concept 和标签。 */
export function mergeResource(input: {
  id: string;
  conceptIds: string[];
  tags?: string[];
  idempotencyKey: string;
}): ResourceDetail {
  const resource = getResource(input.id);
  if (!resource) throw new Error(`资源不存在：${input.id}`);
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous) return getResourceDetail(resource.id) as ResourceDetail;
  const db = getDb();
  const existingIds = db.select({ termId: schema.resourceTerms.termId }).from(schema.resourceTerms)
    .where(eq(schema.resourceTerms.resourceId, resource.id)).all().map((item) => item.termId);
  const missingIds = [...new Set(input.conceptIds)].filter((id) => !existingIds.includes(id) && getTerm(id));
  const tags = [...new Set([...resource.tags, ...(input.tags ?? [])])];
  const now = new Date();
  db.transaction((tx) => {
    if (missingIds.length > 0) {
      tx.insert(schema.resourceTerms).values(missingIds.map((termId) => ({ resourceId: resource.id, termId, createdAt: now }))).run();
      tx.insert(schema.conceptMentions).values(missingIds.map((termId) => ({
        id: randomUUID(),
        termId,
        sourceType: 'resource' as const,
        sourceId: resource.id,
        sessionId: null,
        locator: resource.url,
        excerpt: resource.note ?? resource.title,
        idempotencyKey: `${input.idempotencyKey}:mention:${termId}`,
        createdAt: now,
      }))).run();
    }
    tx.update(schema.resources).set({ tags, updatedAt: now }).where(eq(schema.resources.id, resource.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: resource.workspaceId,
      action: 'resource_duplicate_merged',
      objectType: 'resource',
      objectId: resource.id,
      result: { addedConcepts: missingIds.length },
      context: { canonicalUrl: resource.canonicalUrl },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return getResourceDetail(resource.id) as ResourceDetail;
}

export function updateResource(input: {
  id: string;
  title: string;
  type: ResourceType;
  status: ResourceStatus;
  progress: number;
  tags: string[];
  note?: string | null;
  conceptIds: string[];
  idempotencyKey: string;
}): ResourceDetail {
  const resource = getResource(input.id);
  if (!resource) throw new Error(`资源不存在：${input.id}`);
  if (findEventByIdempotencyKey(input.idempotencyKey)) return getResourceDetail(resource.id) as ResourceDetail;
  const conceptIds = [...new Set(input.conceptIds)].filter((termId) => Boolean(getTerm(termId)));
  const now = new Date();
  const status = input.progress >= 100 ? '已读' as const : input.status;
  const progress = status === '已读' ? 100 : Math.min(99, Math.max(0, input.progress));
  getDb().transaction((tx) => {
    tx.update(schema.resources).set({
      title: input.title,
      type: input.type,
      status,
      progress,
      tags: [...new Set(input.tags)],
      note: input.note ?? null,
      termId: conceptIds[0] ?? null,
      updatedAt: now,
    }).where(eq(schema.resources.id, resource.id)).run();
    tx.delete(schema.resourceTerms).where(eq(schema.resourceTerms.resourceId, resource.id)).run();
    tx.delete(schema.conceptMentions).where(and(
      eq(schema.conceptMentions.sourceType, 'resource'),
      eq(schema.conceptMentions.sourceId, resource.id),
    )).run();
    if (conceptIds.length > 0) {
      tx.insert(schema.resourceTerms).values(conceptIds.map((termId) => ({ resourceId: resource.id, termId, createdAt: now }))).run();
      tx.insert(schema.conceptMentions).values(conceptIds.map((termId) => ({
        id: randomUUID(),
        termId,
        sourceType: 'resource' as const,
        sourceId: resource.id,
        sessionId: null,
        locator: resource.url,
        excerpt: input.note ?? resource.title,
        idempotencyKey: `${input.idempotencyKey}:mention:${termId}`,
        createdAt: now,
      }))).run();
    }
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: resource.workspaceId,
      action: 'resource_updated',
      objectType: 'resource',
      objectId: resource.id,
      result: { status, progress, conceptCount: conceptIds.length },
      context: { previousStatus: resource.status, previousProgress: resource.progress },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return getResourceDetail(resource.id) as ResourceDetail;
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
      .set({
        status: input.status,
        progress: input.status === '已读' ? 100 : resource.progress,
        updatedAt: new Date(),
      })
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

export function createResourceHighlight(input: {
  resourceId: string;
  excerpt: string;
  note?: string | null;
  locator?: string | null;
  tags?: string[];
  idempotencyKey: string;
}): ResourceHighlight {
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous?.objectId) {
    const existing = getDb().select().from(schema.resourceHighlights)
      .where(eq(schema.resourceHighlights.id, previous.objectId)).limit(1).get();
    if (existing) return existing;
  }
  const resource = getResource(input.resourceId);
  if (!resource) throw new Error(`资源不存在：${input.resourceId}`);
  const now = new Date();
  const highlight = {
    id: randomUUID(),
    resourceId: resource.id,
    excerpt: input.excerpt,
    note: input.note ?? null,
    locator: input.locator ?? null,
    tags: [...new Set(input.tags ?? [])],
    createdAt: now,
    updatedAt: now,
  } satisfies ResourceHighlight;
  getDb().transaction((tx) => {
    tx.insert(schema.resourceHighlights).values(highlight).run();
    tx.update(schema.resources).set({ updatedAt: now }).where(eq(schema.resources.id, resource.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: resource.workspaceId,
      action: 'resource_highlight_created',
      objectType: 'resource_highlight',
      objectId: highlight.id,
      result: { length: highlight.excerpt.length },
      context: { resourceId: resource.id, locator: highlight.locator },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return highlight;
}

export function deleteResourceHighlight(input: {
  id: string;
  idempotencyKey: string;
}) {
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous) return true;
  const highlight = getDb().select().from(schema.resourceHighlights)
    .where(eq(schema.resourceHighlights.id, input.id)).limit(1).get();
  if (!highlight) return false;
  const resource = getResource(highlight.resourceId);
  if (!resource) return false;
  getDb().transaction((tx) => {
    tx.delete(schema.resourceHighlights).where(eq(schema.resourceHighlights.id, highlight.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: resource.workspaceId,
      action: 'resource_highlight_deleted',
      objectType: 'resource_highlight',
      objectId: highlight.id,
      context: { resourceId: resource.id },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return true;
}

export function deleteResource(input: { id: string; idempotencyKey: string }) {
  if (findEventByIdempotencyKey(input.idempotencyKey)) return true;
  const resource = getResource(input.id);
  if (!resource) return false;
  getDb().transaction((tx) => {
    tx.delete(schema.conceptMentions).where(and(
      eq(schema.conceptMentions.sourceType, 'resource'),
      eq(schema.conceptMentions.sourceId, resource.id),
    )).run();
    tx.delete(schema.resources).where(eq(schema.resources.id, resource.id)).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: resource.workspaceId,
      action: 'resource_deleted',
      objectType: 'resource',
      objectId: resource.id,
      result: { title: resource.title },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return true;
}

/** 组装本轮聊天可用的资源上下文，正文只取个人笔记和摘录。 */
export function getResourceContext(resourceIds: string[]) {
  const ws = ensureWorkspace();
  return [...new Set(resourceIds)].slice(0, 5).map((id) => getResourceDetail(id))
    .filter((resource): resource is ResourceDetail => Boolean(resource && resource.workspaceId === ws.id))
    .map((resource) => ({
      id: resource.id,
      title: resource.title,
      url: resource.url,
      description: resource.description,
      note: resource.note,
      highlights: resource.highlights.slice(0, 12).map((highlight) => ({
        excerpt: highlight.excerpt,
        note: highlight.note,
        locator: highlight.locator,
      })),
    }));
}

/** 同步数据库种子、真实 Concept 和有来源的共现关系。 */
function ensureKnowledgeProjection() {
  const db = getDb();
  const workspace = ensureWorkspace();
  const now = new Date();
  const terms = db.select().from(schema.terms).all();
  const knownNodes = db.select().from(schema.knowledgeNodes)
    .where(eq(schema.knowledgeNodes.workspaceId, workspace.id)).all();
  const byLabel = new Map(knownNodes.map((node) => [node.label.toLocaleLowerCase(), node]));
  const byTerm = new Map(knownNodes.filter((node) => node.termId).map((node) => [node.termId as string, node]));

  db.transaction((tx) => {
    for (const seed of KNOWLEDGE_SEED_NODES) {
      const key = seed.label.toLocaleLowerCase();
      const existing = byLabel.get(key);
      const term = terms.find((candidate) => conceptNames(candidate).has(key));
      if (existing) {
        if (!existing.termId && term && !byTerm.has(term.id)) {
          tx.update(schema.knowledgeNodes).set({ termId: term.id, updatedAt: now })
            .where(eq(schema.knowledgeNodes.id, existing.id)).run();
          existing.termId = term.id;
          byTerm.set(term.id, existing);
        }
        continue;
      }
      const node = {
        id: seed.id,
        workspaceId: workspace.id,
        termId: term?.id ?? null,
        kind: seed.kind,
        label: seed.label,
        description: seed.description,
        origin: 'seed' as const,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(schema.knowledgeNodes).values(node).run();
      knownNodes.push(node);
      byLabel.set(key, node);
      if (term) byTerm.set(term.id, node);
    }

    for (const term of terms) {
      if (byTerm.has(term.id)) continue;
      const labelKey = term.canonicalName.toLocaleLowerCase();
      const matching = byLabel.get(labelKey);
      if (matching && !matching.termId) {
        tx.update(schema.knowledgeNodes).set({ termId: term.id, updatedAt: now })
          .where(eq(schema.knowledgeNodes.id, matching.id)).run();
        matching.termId = term.id;
        byTerm.set(term.id, matching);
        continue;
      }
      const node = {
        id: `concept:${term.id}`,
        workspaceId: workspace.id,
        termId: term.id,
        kind: 'concept' as const,
        label: term.canonicalName,
        description: term.definition,
        origin: 'learned' as const,
        createdAt: term.createdAt,
        updatedAt: term.createdAt,
      };
      tx.insert(schema.knowledgeNodes).values(node).run();
      knownNodes.push(node);
      byLabel.set(labelKey, node);
      byTerm.set(term.id, node);
    }

    for (const edge of KNOWLEDGE_SEED_EDGES) {
      const sourceSeed = KNOWLEDGE_SEED_NODES.find((node) => node.id === edge.source);
      const targetSeed = KNOWLEDGE_SEED_NODES.find((node) => node.id === edge.target);
      const source = sourceSeed ? byLabel.get(sourceSeed.label.toLocaleLowerCase()) : undefined;
      const target = targetSeed ? byLabel.get(targetSeed.label.toLocaleLowerCase()) : undefined;
      if (!source || !target) continue;
      tx.insert(schema.knowledgeEdges).values({
        id: `seed-edge:${edge.source}:${edge.target}:${edge.relation}`,
        workspaceId: workspace.id,
        sourceNodeId: source.id,
        targetNodeId: target.id,
        relation: edge.relation,
        evidenceType: 'seed',
        evidenceId: null,
        weight: 1,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing().run();
    }

    const existingMentionEdges = tx.select().from(schema.knowledgeEdges).where(and(
      eq(schema.knowledgeEdges.workspaceId, workspace.id),
      eq(schema.knowledgeEdges.evidenceType, 'mention'),
    )).all();
    const termIds = new Set(terms.map((term) => term.id));
    const mentions = tx.select().from(schema.conceptMentions).all()
      .filter((mention) => termIds.has(mention.termId));
    const groups = new Map<string, Set<string>>();
    for (const mention of mentions) {
      const key = `${mention.sourceType}:${mention.sourceId}`;
      groups.set(key, new Set([...(groups.get(key) ?? []), mention.termId]));
    }
    const pairCounts = new Map<string, { source: string; target: string; weight: number }>();
    for (const group of groups.values()) {
      const ids = [...group].map((termId) => byTerm.get(termId)?.id).filter((id): id is string => Boolean(id)).slice(0, 12);
      for (let left = 0; left < ids.length; left += 1) {
        for (let right = left + 1; right < ids.length; right += 1) {
          const [source, target] = [ids[left], ids[right]].sort();
          const key = `${source}:${target}`;
          const pair = pairCounts.get(key);
          pairCounts.set(key, { source, target, weight: (pair?.weight ?? 0) + 1 });
        }
      }
    }
    for (const pair of pairCounts.values()) {
      const existing = existingMentionEdges.find((edge) =>
        edge.sourceNodeId === pair.source && edge.targetNodeId === pair.target && edge.relation === 'related');
      if (existing) {
        if (existing.weight !== pair.weight) {
          tx.update(schema.knowledgeEdges).set({ weight: pair.weight, updatedAt: now })
            .where(eq(schema.knowledgeEdges.id, existing.id)).run();
        }
      } else {
        tx.insert(schema.knowledgeEdges).values({
          id: randomUUID(),
          workspaceId: workspace.id,
          sourceNodeId: pair.source,
          targetNodeId: pair.target,
          relation: 'related',
          evidenceType: 'mention',
          evidenceId: null,
          weight: pair.weight,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing().run();
      }
    }
    for (const existing of existingMentionEdges) {
      const key = `${existing.sourceNodeId}:${existing.targetNodeId}`;
      if (!pairCounts.has(key)) {
        tx.delete(schema.knowledgeEdges).where(eq(schema.knowledgeEdges.id, existing.id)).run();
      }
    }
  });
}

/** 读取当前 Concept 周围一到两跳的局部知识图。 */
export function getKnowledgeGraph(input: {
  centerId?: string;
  depth?: 1 | 2;
  relations?: KnowledgeRelation[];
} = {}): KnowledgeGraph {
  ensureKnowledgeProjection();
  const db = getDb();
  const workspace = ensureWorkspace();
  const depth = input.depth ?? 1;
  const allNodes = db.select().from(schema.knowledgeNodes)
    .where(eq(schema.knowledgeNodes.workspaceId, workspace.id)).all();
  const allowed = new Set(input.relations?.length ? input.relations : ['part_of', 'prerequisite', 'related', 'applied_in']);
  const allEdges = db.select().from(schema.knowledgeEdges)
    .where(eq(schema.knowledgeEdges.workspaceId, workspace.id)).all()
    .filter((edge) => allowed.has(edge.relation));
  const validRequested = input.centerId && allNodes.some((node) => node.id === input.centerId)
    ? input.centerId
    : null;
  const connected = new Set(allEdges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]));
  const latestConnectedTerm = db.select().from(schema.terms).orderBy(desc(schema.terms.createdAt)).all()
    .map((term) => allNodes.find((node) => node.termId === term.id))
    .find((node) => node && connected.has(node.id));
  const centerId = validRequested
    ?? latestConnectedTerm?.id
    ?? allNodes.find((node) => node.id === 'domain:engineering')?.id
    ?? allNodes[0]?.id
    ?? null;
  const included = centerId ? collectLocalNodeIds(centerId, allEdges, depth) : new Set<string>();
  const layouts = new Map(db.select().from(schema.knowledgeNodeLayouts)
    .where(eq(schema.knowledgeNodeLayouts.viewKey, 'knowledge')).all()
    .map((layout) => [layout.nodeId, { x: layout.x, y: layout.y }]));
  const termById = new Map(db.select().from(schema.terms).all().map((term) => [term.id, term]));
  const nodes = allNodes.filter((node) => included.has(node.id)).map((node) => {
    const term = node.termId ? termById.get(node.termId) : undefined;
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      termId: node.termId,
      description: term?.definition ?? node.description,
      masteryState: node.termId ? getMasteryState(node.termId) : null,
      evidence: getKnowledgeEvidence(node.termId, node.label),
      href: node.termId ? `/?concept=${node.termId}` : null,
      position: layouts.get(node.id) ?? null,
    } satisfies KnowledgeGraphNode;
  });
  const edges = allEdges.filter((edge) => included.has(edge.sourceNodeId) && included.has(edge.targetNodeId))
    .map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      relation: edge.relation,
      weight: edge.weight,
      evidenceType: edge.evidenceType,
    } satisfies KnowledgeGraphEdge));
  return {
    mode: 'knowledge',
    centerId,
    depth,
    nodes,
    edges,
    searchOptions: allNodes.map((node) => ({ id: node.id, label: node.label, kind: node.kind, termId: node.termId }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN')),
    totalNodes: allNodes.length,
  };
}

/** 会话分支投影继续使用真实 parent/fork 锚点，并提供可直接返回来源的 URL。 */
export function getSessionKnowledgeGraph(): KnowledgeGraph {
  const sessions = listSessions();
  const nodes = sessions.map((session, index) => ({
    id: session.id,
    label: session.title,
    kind: 'session' as const,
    termId: null,
    description: `${listMessages(session.id).length} 条消息${session.parentId ? ' · 派生会话' : ' · 根会话'}`,
    masteryState: null,
    evidence: { messages: listMessages(session.id).length, notes: 0, resources: 0, interviews: 0, practice: 0, reviews: 0 },
    href: `/?session=${session.id}${session.forkedFromMessageId ? `&message=${session.forkedFromMessageId}` : ''}`,
    forkedFromMessageId: session.forkedFromMessageId,
    position: { x: sessionDepth(session, sessions) * 250, y: index * 105 },
  } satisfies KnowledgeGraphNode));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = sessions.filter((session) => session.parentId && ids.has(session.parentId)).map((session) => ({
    id: `session-edge:${session.parentId}:${session.id}`,
    source: session.parentId as string,
    target: session.id,
    relation: 'branch' as const,
    weight: 1,
    evidenceType: session.forkedFromMessageId ? 'message' : 'session',
  }));
  return {
    mode: 'session',
    centerId: nodes[0]?.id ?? null,
    depth: 2,
    nodes,
    edges,
    searchOptions: nodes.map((node) => ({ id: node.id, label: node.label, kind: node.kind, termId: null })),
    totalNodes: nodes.length,
  };
}

export function saveKnowledgeNodeLayout(input: {
  nodeId: string;
  x: number;
  y: number;
  viewKey?: string;
  idempotencyKey: string;
}) {
  const previous = findEventByIdempotencyKey(input.idempotencyKey);
  if (previous) return true;
  const db = getDb();
  const workspace = ensureWorkspace();
  const node = db.select().from(schema.knowledgeNodes).where(and(
    eq(schema.knowledgeNodes.id, input.nodeId),
    eq(schema.knowledgeNodes.workspaceId, workspace.id),
  )).limit(1).get();
  if (!node) return false;
  const viewKey = input.viewKey ?? 'knowledge';
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(schema.knowledgeNodeLayouts).values({ nodeId: node.id, viewKey, x: input.x, y: input.y, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.knowledgeNodeLayouts.nodeId, schema.knowledgeNodeLayouts.viewKey],
        set: { x: input.x, y: input.y, updatedAt: now },
      }).run();
    tx.insert(schema.learningEvents).values(eventValues({
      workspaceId: workspace.id,
      action: 'knowledge_layout_changed',
      objectType: 'knowledge_node',
      objectId: node.id,
      result: { x: input.x, y: input.y },
      context: { viewKey },
      idempotencyKey: input.idempotencyKey,
    })).run();
  });
  return true;
}

function conceptNames(term: Term) {
  return new Set([term.name, term.canonicalName, ...term.aliases].map((name) => name.toLocaleLowerCase()));
}

function collectLocalNodeIds(centerId: string, edges: KnowledgeEdge[], depth: 1 | 2) {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    adjacency.set(edge.sourceNodeId, new Set([...(adjacency.get(edge.sourceNodeId) ?? []), edge.targetNodeId]));
    adjacency.set(edge.targetNodeId, new Set([...(adjacency.get(edge.targetNodeId) ?? []), edge.sourceNodeId]));
  }
  const included = new Set([centerId]);
  let frontier = [centerId];
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const nodeId of frontier) for (const neighbor of adjacency.get(nodeId) ?? []) {
      included.add(neighbor);
      next.add(neighbor);
    }
    frontier = [...next];
  }
  return included;
}

function getMasteryState(termId: string): TermMastery['state'] | null {
  return getDb().select({ state: schema.termMasteries.state }).from(schema.termMasteries)
    .where(eq(schema.termMasteries.termId, termId)).limit(1).get()?.state ?? null;
}

function getKnowledgeEvidence(termId: string | null, label: string): KnowledgeEvidence {
  const empty = { messages: 0, notes: 0, resources: 0, interviews: 0, practice: 0, reviews: 0 };
  if (!termId) return empty;
  const db = getDb();
  const mentions = db.select({ sourceType: schema.conceptMentions.sourceType }).from(schema.conceptMentions)
    .where(eq(schema.conceptMentions.termId, termId)).all();
  return {
    messages: mentions.filter((item) => item.sourceType === 'message').length,
    notes: mentions.filter((item) => item.sourceType === 'note').length,
    resources: mentions.filter((item) => item.sourceType === 'resource').length,
    interviews: db.select().from(schema.interviews).where(eq(schema.interviews.termId, termId)).all().length,
    practice: db.select({ skills: schema.practiceAttempts.skills }).from(schema.practiceAttempts).all()
      .filter((attempt) => attempt.skills.some((skill) => skill.toLocaleLowerCase() === label.toLocaleLowerCase())).length,
    reviews: db.select().from(schema.reviewLogs).where(eq(schema.reviewLogs.termId, termId)).all().length,
  };
}

function sessionDepth(session: Session, sessions: Session[]) {
  const byId = new Map(sessions.map((item) => [item.id, item]));
  let depth = 0;
  let cursor = session.parentId ? byId.get(session.parentId) : undefined;
  const seen = new Set([session.id]);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    depth += 1;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return depth;
}
