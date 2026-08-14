import {
  integer,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { LEARNING_EVENT_ACTIONS, LEARNING_OBJECT_TYPES } from '../learning-events';

/**
 * 数据模型（Drizzle + SQLite）。
 * 设计原则：一切学习行为写入不可变的 LearningEvent 事件流，可溯源、可聚合分析。
 */

/** 工作区：一个学习主题，内含多条会话。 */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  goal: text('goal'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 会话：parent_id 自引用构成会话树（null 为根会话）。 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  parentId: text('parent_id').references((): AnySQLiteColumn => sessions.id),
  rootSessionId: text('root_session_id').references((): AnySQLiteColumn => sessions.id, {
    onDelete: 'set null',
  }),
  forkedFromMessageId: text('forked_from_message_id').references(
    (): AnySQLiteColumn => messages.id,
    { onDelete: 'set null' },
  ),
  title: text('title').notNull(),
  teacherStyle: text('teacher_style'),
  pinnedAt: integer('pinned_at', { mode: 'timestamp_ms' }),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 消息：一条会话内的用户 / 助手消息。 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  status: text('status', { enum: ['complete', 'error'] }).notNull().default('complete'),
  error: text('error'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 术语：单源卡片，多视图引用而非复制。 */
export const terms = sqliteTable('terms', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  canonicalName: text('canonical_name').notNull().default(''),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().notNull().default([]),
  definition: text('definition').notNull(),
  example: text('example'),
  confidence: real('confidence').notNull().default(0.8),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 术语掌握度：FSRS 相关字段，隐性巩固模块使用（本阶段先落表）。 */
export const termMasteries = sqliteTable('term_masteries', {
  id: text('id').primaryKey(),
  termId: text('term_id')
    .notNull()
    .references(() => terms.id)
    .unique(),
  state: text('state', {
    enum: ['new', 'learning', 'reviewing', 'relearning'],
  })
    .notNull()
    .default('new'),
  stability: real('stability'),
  difficulty: real('difficulty'),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp_ms' }),
});

/** 学习事件：不可变事件流（Event Sourcing），一切学习行为在此留痕。 */
export const learningEvents = sqliteTable('learning_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  sessionId: text('session_id').references(() => sessions.id),
  action: text('action', { enum: LEARNING_EVENT_ACTIONS }).notNull().default('legacy'),
  objectType: text('object_type', { enum: LEARNING_OBJECT_TYPES }).notNull().default('unknown'),
  objectId: text('object_id'),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(),
  context: text('context', { mode: 'json' }).$type<Record<string, unknown>>(),
  schemaVersion: integer('schema_version').notNull().default(1),
  idempotencyKey: text('idempotency_key').unique(),
  /** 兼容阶段 4 前的分析查询，后续投影完成后移除。 */
  type: text('type').notNull(),
  entityId: text('entity_id'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 笔记：由会话 / 工作区总结生成的结构化学习笔记。 */
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  sessionId: text('session_id').references(() => sessions.id),
  title: text('title').notNull(),
  content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  aiSnapshot: text('ai_snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  userContent: text('user_content', { mode: 'json' }).$type<Record<string, unknown>>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  version: integer('version').notNull().default(1),
  markdown: text('markdown').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
});

/** 笔记版本：AI 初始快照和每次用户保存都不可变追加。 */
export const noteVersions = sqliteTable('note_versions', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  origin: text('origin', { enum: ['ai', 'user'] }).notNull(),
  title: text('title').notNull(),
  markdown: text('markdown').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 笔记块来源：保留原会话消息范围；消息删除时显式失效。 */
export const noteSources = sqliteTable('note_sources', {
  id: text('id').primaryKey(),
  noteId: text('note_id')
    .notNull()
    .references(() => notes.id, { onDelete: 'cascade' }),
  blockKey: text('block_key').notNull(),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  startMessageId: text('start_message_id').references(() => messages.id, { onDelete: 'set null' }),
  endMessageId: text('end_message_id').references(() => messages.id, { onDelete: 'set null' }),
  excerpt: text('excerpt'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 面试问答记录。 */
export const interviews = sqliteTable('interviews', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  question: text('question').notNull(),
  answer: text('answer'),
  feedback: text('feedback'),
  correct: integer('correct', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 学习资源：教程 / 文档 / 书籍等，可关联术语（单源卡片）。 */
export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  termId: text('term_id').references(() => terms.id),
  title: text('title').notNull(),
  type: text('type', {
    enum: ['教程', '文档', '书籍', '视频', '博客', 'GitHub'],
  }).notNull(),
  url: text('url').notNull(),
  status: text('status', { enum: ['想读', '在读', '已读'] })
    .notNull()
    .default('想读'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** Concept 来源：统一记录消息、笔记块和资源中的出现位置。 */
export const conceptMentions = sqliteTable('concept_mentions', {
  id: text('id').primaryKey(),
  termId: text('term_id')
    .notNull()
    .references(() => terms.id, { onDelete: 'cascade' }),
  sourceType: text('source_type', { enum: ['message', 'note', 'resource'] }).notNull(),
  sourceId: text('source_id').notNull(),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  locator: text('locator'),
  excerpt: text('excerpt'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
