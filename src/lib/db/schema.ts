import {
  integer,
  real,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

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
  title: text('title').notNull(),
  teacherStyle: text('teacher_style'),
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
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** 术语：单源卡片，多视图引用而非复制。 */
export const terms = sqliteTable('terms', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  definition: text('definition').notNull(),
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
  type: text('type').notNull(),
  entityId: text('entity_id'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
