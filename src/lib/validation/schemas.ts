import { z } from 'zod';
import { PUBLIC_EVENT_ACTIONS } from '../learning-events';

const id = z.string().uuid('必须是有效 UUID');
const idempotencyKey = z.string().trim().min(8).max(128);
const nullableId = id.nullable().optional();

export const sessionsCreateSchema = z
  .object({
    parentId: nullableId,
    forkedFromMessageId: nullableId,
    title: z.string().trim().min(1).max(120).optional(),
    idempotencyKey,
  })
  .strict();

export const sessionIdSchema = id;

export const sessionUpdateSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('rename'),
      title: z.string().trim().min(1).max(120),
      idempotencyKey,
    })
    .strict(),
  z.object({ action: z.literal('pin'), pinned: z.boolean(), idempotencyKey }).strict(),
  z.object({ action: z.literal('archive'), archived: z.boolean(), idempotencyKey }).strict(),
]);

export const sessionDeleteSchema = z.object({ idempotencyKey }).strict();

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(20_000),
    model: z.enum(['fast', 'pro']).optional(),
    sessionId: id,
    resourceIds: z.array(id).max(5).default([]),
    idempotencyKey,
  })
  .strict();

export const termsRequestSchema = z
  .object({
    text: z.string().max(100_000),
    sessionId: id.optional(),
    sourceMessageIdempotencyKey: z.string().trim().min(8).max(128).optional(),
    idempotencyKey,
  })
  .strict();

export const conceptLookupSchema = z
  .object({
    id: id.optional(),
    name: z.string().trim().min(1).max(240).optional(),
  })
  .refine((value) => Boolean(value.id || value.name), '必须提供 Concept id 或 name');

export const notesCreateSchema = z
  .object({ sessionId: id, idempotencyKey })
  .strict();

export const noteUpdateSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(240),
    markdown: z.string().max(200_000),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    idempotencyKey,
  })
  .strict();

export const interviewRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('start'),
      role: z.enum(['backend', 'frontend', 'fullstack', 'data']),
      topic: z.enum(['system-design', 'database', 'engineering', 'behavioral']),
      difficulty: z.enum(['foundation', 'standard', 'advanced']),
      totalRounds: z.union([z.literal(3), z.literal(5)]),
      teacherStyle: z.enum(['guided', 'rigorous', 'concise']),
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('next'),
      interviewSessionId: id,
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('followup'),
      id,
      answerDraft: z.string().trim().max(20_000).optional(),
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('answer'),
      id,
      answer: z.string().trim().min(1).max(20_000),
      durationMs: z.number().int().min(0).max(3_600_000),
      idempotencyKey,
    })
    .strict(),
]);

export const reviewRequestSchema = z.union([
  z
    .object({
      action: z.literal('review').optional(),
      termId: id,
      grade: z.enum(['again', 'hard', 'good', 'easy']),
      answerMode: z.enum(['typed', 'oral']),
      recallText: z.string().trim().max(8_000).nullable().optional(),
      durationMs: z.number().int().min(0).max(3_600_000).default(0),
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('undo'),
      reviewLogId: id,
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('flag'),
      termId: id,
      difficult: z.boolean(),
      idempotencyKey,
    })
    .strict(),
]);

export const practiceAttemptSchema = z
  .object({
    challengeId: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
    conceptId: nullableId,
    status: z.enum(['success', 'error']),
    errorType: z.enum(['syntax', 'runtime', 'timeout', 'validation']).nullable().optional(),
    runCount: z.number().int().min(1).max(10_000),
    hintCount: z.number().int().min(0).max(100),
    durationMs: z.number().int().min(0).max(3_600_000),
    sql: z.string().trim().min(1).max(50_000),
    result: z.record(z.string(), z.unknown()).default({}),
    skills: z.array(z.string().trim().min(1).max(80)).max(12),
    idempotencyKey,
  })
  .strict();

export const resourceCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    type: z.enum(['教程', '文档', '书籍', '视频', '博客', 'GitHub']),
    url: z.url().max(2_048),
    canonicalUrl: z.url().max(2_048).optional(),
    siteName: z.string().trim().max(200).nullable().optional(),
    author: z.string().trim().max(240).nullable().optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    faviconUrl: z.url().max(2_048).nullable().optional(),
    termId: nullableId.optional(),
    conceptIds: z.array(id).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
    note: z.string().trim().max(8_000).nullable().optional(),
    idempotencyKey,
  })
  .strict();

export const resourcePatchSchema = z.union([
  z.object({
    id,
    status: z.enum(['想读', '在读', '已读']),
    idempotencyKey,
  })
  .strict(),
  z.object({
    action: z.literal('update'),
    id,
    title: z.string().trim().min(1).max(240),
    type: z.enum(['教程', '文档', '书籍', '视频', '博客', 'GitHub']),
    status: z.enum(['想读', '在读', '已读']),
    progress: z.number().int().min(0).max(100),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    note: z.string().trim().max(8_000).nullable().optional(),
    conceptIds: z.array(id).max(20),
    idempotencyKey,
  }).strict(),
]);

export const resourceMetadataSchema = z.object({ url: z.url().max(2_048) }).strict();

export const resourceDeleteSchema = z.object({ id, idempotencyKey }).strict();

export const resourceHighlightSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    resourceId: id,
    excerpt: z.string().trim().min(1).max(20_000),
    note: z.string().trim().max(8_000).nullable().optional(),
    locator: z.string().trim().max(500).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    idempotencyKey,
  }).strict(),
  z.object({ action: z.literal('delete'), id, idempotencyKey }).strict(),
]);

export const knowledgeGraphQuerySchema = z.object({
  mode: z.enum(['knowledge', 'session']).default('knowledge'),
  centerId: z.string().trim().min(1).max(160).optional(),
  depth: z.coerce.number().int().min(1).max(2).default(1).transform((value) => value as 1 | 2),
  relations: z.array(z.enum(['part_of', 'prerequisite', 'related', 'applied_in'])).max(4).default([]),
}).strict();

export const knowledgeLayoutSchema = z.object({
  nodeId: z.string().trim().min(1).max(160),
  viewKey: z.string().trim().regex(/^[a-z0-9:-]+$/).max(120).default('knowledge'),
  x: z.number().finite().min(-100_000).max(100_000),
  y: z.number().finite().min(-100_000).max(100_000),
  idempotencyKey,
}).strict();

export const publicEventSchema = z
  .object({
    action: z.enum(PUBLIC_EVENT_ACTIONS),
    result: z.record(z.string(), z.unknown()).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey,
  })
  .strict();
