import {
  integer,
  index,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { LEARNING_EVENT_ACTIONS, LEARNING_OBJECT_TYPES } from '../learning-events';
import type {
  InterviewDimension,
  InterviewDimensionScore,
  InterviewDifficulty,
  InterviewEvidence,
  InterviewRole,
  InterviewStrategy,
  InterviewTeacherStyle,
  InterviewTopic,
} from '../interview/types';

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

/** FSRS 卡片：保存可继续调度的完整记忆状态，term_masteries 作为兼容投影。 */
export const reviewCards = sqliteTable('review_cards', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  termId: text('term_id')
    .notNull()
    .references(() => terms.id, { onDelete: 'cascade' })
    .unique(),
  state: text('state', {
    enum: ['new', 'learning', 'reviewing', 'relearning'],
  }).notNull(),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  scheduledDays: integer('scheduled_days').notNull().default(0),
  learningSteps: integer('learning_steps').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  lapses: integer('lapses').notNull().default(0),
  lastReviewAt: integer('last_review_at', { mode: 'timestamp_ms' }),
  isDifficult: integer('is_difficult', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('review_cards_due_at_idx').on(table.dueAt),
]);

/** 不可变复习日志：完整保留 FSRS 输入、输出与主动回忆证据。 */
export const reviewLogs = sqliteTable('review_logs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  cardId: text('card_id')
    .notNull()
    .references(() => reviewCards.id, { onDelete: 'cascade' }),
  termId: text('term_id')
    .notNull()
    .references(() => terms.id, { onDelete: 'cascade' }),
  rating: text('rating', { enum: ['again', 'hard', 'good', 'easy'] }).notNull(),
  state: text('state', {
    enum: ['new', 'learning', 'reviewing', 'relearning'],
  }).notNull(),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  lastElapsedDays: integer('last_elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  learningSteps: integer('learning_steps').notNull(),
  reviewAt: integer('review_at', { mode: 'timestamp_ms' }).notNull(),
  stateAfter: text('state_after', {
    enum: ['new', 'learning', 'reviewing', 'relearning'],
  }).notNull(),
  dueAfter: integer('due_after', { mode: 'timestamp_ms' }).notNull(),
  stabilityAfter: real('stability_after').notNull(),
  difficultyAfter: real('difficulty_after').notNull(),
  scheduledDaysAfter: integer('scheduled_days_after').notNull(),
  learningStepsAfter: integer('learning_steps_after').notNull(),
  repsAfter: integer('reps_after').notNull(),
  lapsesAfter: integer('lapses_after').notNull(),
  durationMs: integer('duration_ms').notNull().default(0),
  answerMode: text('answer_mode', { enum: ['typed', 'oral'] }).notNull(),
  recallText: text('recall_text'),
  algorithmVersion: text('algorithm_version').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('review_logs_card_review_idx').on(table.cardId, table.reviewAt),
  index('review_logs_term_review_idx').on(table.termId, table.reviewAt),
]);

/** 撤销单独追加记录，保证 review_logs 本身永不修改。 */
export const reviewUndos = sqliteTable('review_undos', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  cardId: text('card_id')
    .notNull()
    .references(() => reviewCards.id, { onDelete: 'cascade' }),
  reviewLogId: text('review_log_id')
    .notNull()
    .references(() => reviewLogs.id, { onDelete: 'cascade' })
    .unique(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/** SQL 实践尝试：每次运行一条不可变证据，成功与失败都保留。 */
export const practiceAttempts = sqliteTable('practice_attempts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  conceptId: text('concept_id').references(() => terms.id, { onDelete: 'set null' }),
  challengeId: text('challenge_id').notNull(),
  status: text('status', { enum: ['success', 'error'] }).notNull(),
  errorType: text('error_type', {
    enum: ['syntax', 'runtime', 'timeout', 'validation'],
  }),
  runCount: integer('run_count').notNull(),
  hintCount: integer('hint_count').notNull(),
  durationMs: integer('duration_ms').notNull(),
  sql: text('sql').notNull(),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  skills: text('skills', { mode: 'json' }).$type<string[]>().notNull().default([]),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('practice_attempts_challenge_created_idx').on(table.challengeId, table.createdAt),
]);

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

/** 一次结构化面试练习：设置、轮次和自适应难度的单一状态源。 */
export const interviewSessions = sqliteTable('interview_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  role: text('role').$type<InterviewRole>().notNull(),
  topic: text('topic').$type<InterviewTopic>().notNull(),
  initialDifficulty: text('initial_difficulty').$type<InterviewDifficulty>().notNull(),
  currentDifficulty: text('current_difficulty').$type<InterviewDifficulty>().notNull(),
  totalRounds: integer('total_rounds').notNull(),
  currentRound: integer('current_round').notNull().default(1),
  teacherStyle: text('teacher_style').$type<InterviewTeacherStyle>().notNull(),
  status: text('status', { enum: ['active', 'completed'] }).notNull().default('active'),
  lastStrategy: text('last_strategy').$type<InterviewStrategy>(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
}, (table) => [
  index('interview_sessions_workspace_status_idx').on(table.workspaceId, table.status, table.updatedAt),
]);

/** 面试题目及最近一次作答投影，保留原字段供现有分析兼容读取。 */
export const interviews = sqliteTable('interviews', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  workspaceId: text('workspace_id').references(() => workspaces.id),
  interviewSessionId: text('interview_session_id').references(() => interviewSessions.id, {
    onDelete: 'cascade',
  }),
  termId: text('term_id').references(() => terms.id, { onDelete: 'set null' }),
  roundIndex: integer('round_index').notNull().default(1),
  skill: text('skill').notNull().default('通用技术能力'),
  difficulty: text('difficulty').$type<InterviewDifficulty>().notNull().default('standard'),
  rubric: text('rubric', { mode: 'json' })
    .$type<Record<InterviewDimension, string>>()
    .notNull()
    .default({
      correctness: '技术判断正确',
      structure: '回答结构清晰',
      evidence: '有事实或权衡依据',
      communication: '表达准确简洁',
    }),
  followUp: text('follow_up'),
  question: text('question').notNull(),
  answer: text('answer'),
  feedback: text('feedback'),
  correct: integer('correct', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('interviews_session_round_idx').on(table.interviewSessionId, table.roundIndex),
]);

/** 每次答案都是不可变版本；同题重答只追加，不覆盖历史反馈。 */
export const interviewAttempts = sqliteTable('interview_attempts', {
  id: text('id').primaryKey(),
  interviewId: text('interview_id')
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  answer: text('answer').notNull(),
  durationMs: integer('duration_ms').notNull(),
  scores: text('scores', { mode: 'json' })
    .$type<Record<InterviewDimension, InterviewDimensionScore>>()
    .notNull(),
  evidence: text('evidence', { mode: 'json' }).$type<InterviewEvidence[]>().notNull().default([]),
  summary: text('summary').notNull(),
  strengths: text('strengths', { mode: 'json' }).$type<string[]>().notNull().default([]),
  improvements: text('improvements', { mode: 'json' }).$type<string[]>().notNull().default([]),
  modelAnswer: text('model_answer').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  nextStrategy: text('next_strategy').$type<InterviewStrategy>().notNull(),
  prerequisite: text('prerequisite'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('interview_attempts_interview_version_idx').on(table.interviewId, table.version),
]);

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
  canonicalUrl: text('canonical_url'),
  siteName: text('site_name'),
  author: text('author'),
  description: text('description'),
  faviconUrl: text('favicon_url'),
  status: text('status', { enum: ['想读', '在读', '已读'] })
    .notNull()
    .default('想读'),
  progress: integer('progress').notNull().default(0),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
}, (table) => [
  uniqueIndex('resources_workspace_canonical_url_idx').on(table.workspaceId, table.canonicalUrl),
  index('resources_workspace_status_updated_idx').on(table.workspaceId, table.status, table.updatedAt),
]);

/** 资源与 Concept 多对多关系；term_id 仅保留为旧数据兼容投影。 */
export const resourceTerms = sqliteTable('resource_terms', {
  resourceId: text('resource_id')
    .notNull()
    .references(() => resources.id, { onDelete: 'cascade' }),
  termId: text('term_id')
    .notNull()
    .references(() => terms.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('resource_terms_resource_term_idx').on(table.resourceId, table.termId),
  index('resource_terms_term_idx').on(table.termId),
]);

/** 资源摘录：保存原文、个人注释与来源定位。 */
export const resourceHighlights = sqliteTable('resource_highlights', {
  id: text('id').primaryKey(),
  resourceId: text('resource_id')
    .notNull()
    .references(() => resources.id, { onDelete: 'cascade' }),
  excerpt: text('excerpt').notNull(),
  note: text('note'),
  locator: text('locator'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  index('resource_highlights_resource_created_idx').on(table.resourceId, table.createdAt),
]);

/** 助手消息实际使用的资源，刷新历史后仍能显示引用来源。 */
export const messageResources = sqliteTable('message_resources', {
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  resourceId: text('resource_id')
    .notNull()
    .references(() => resources.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('message_resources_message_resource_idx').on(table.messageId, table.resourceId),
]);

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

/** 知识图节点：语义对象存于数据库，Concept 可选关联 term。 */
export const knowledgeNodes = sqliteTable('knowledge_nodes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  termId: text('term_id').references(() => terms.id, { onDelete: 'set null' }),
  kind: text('kind', { enum: ['domain', 'concept'] }).notNull(),
  label: text('label').notNull(),
  description: text('description'),
  origin: text('origin', { enum: ['seed', 'learned'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('knowledge_nodes_workspace_label_idx').on(table.workspaceId, table.label),
  uniqueIndex('knowledge_nodes_workspace_term_idx').on(table.workspaceId, table.termId),
  index('knowledge_nodes_workspace_kind_idx').on(table.workspaceId, table.kind),
]);

/** 知识图语义边：与画布坐标分离，关系必须保留来源证据。 */
export const knowledgeEdges = sqliteTable('knowledge_edges', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  sourceNodeId: text('source_node_id')
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  targetNodeId: text('target_node_id')
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  relation: text('relation', { enum: ['part_of', 'prerequisite', 'related', 'applied_in'] }).notNull(),
  evidenceType: text('evidence_type', { enum: ['seed', 'mention', 'resource', 'interview', 'practice'] }).notNull(),
  evidenceId: text('evidence_id'),
  weight: integer('weight').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('knowledge_edges_semantic_idx').on(table.sourceNodeId, table.targetNodeId, table.relation),
  index('knowledge_edges_workspace_relation_idx').on(table.workspaceId, table.relation),
  index('knowledge_edges_target_idx').on(table.targetNodeId),
]);

/** 画布布局：只保存视觉坐标，不污染语义节点和关系。 */
export const knowledgeNodeLayouts = sqliteTable('knowledge_node_layouts', {
  nodeId: text('node_id')
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  viewKey: text('view_key').notNull().default('knowledge'),
  x: real('x').notNull(),
  y: real('y').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  uniqueIndex('knowledge_node_layouts_node_view_idx').on(table.nodeId, table.viewKey),
]);
