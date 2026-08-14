import { z } from 'zod';
import { PUBLIC_EVENT_ACTIONS } from '../learning-events';

const id = z.string().uuid('必须是有效 UUID');
const idempotencyKey = z.string().trim().min(8).max(128);
const nullableId = id.nullable().optional();

export const sessionsCreateSchema = z
  .object({
    parentId: nullableId,
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
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().min(1).max(20_000),
        }),
      )
      .min(1)
      .max(200),
    model: z.enum(['fast', 'pro']).optional(),
    sessionId: id,
    idempotencyKey,
  })
  .strict();

export const termsRequestSchema = z
  .object({
    text: z.string().max(100_000),
    idempotencyKey,
  })
  .strict();

export const notesCreateSchema = z
  .object({ sessionId: id, idempotencyKey })
  .strict();

export const interviewRequestSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('question'),
      context: z.string().trim().max(8_000).optional(),
      idempotencyKey,
    })
    .strict(),
  z
    .object({
      action: z.literal('answer'),
      id,
      answer: z.string().trim().min(1).max(20_000),
      idempotencyKey,
    })
    .strict(),
]);

export const reviewRequestSchema = z
  .object({
    termId: id,
    grade: z.enum(['again', 'hard', 'good', 'easy']),
    idempotencyKey,
  })
  .strict();

export const resourceCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    type: z.enum(['教程', '文档', '书籍', '视频', '博客', 'GitHub']),
    url: z.url().max(2_048),
    termId: nullableId,
    note: z.string().trim().max(8_000).nullable().optional(),
    idempotencyKey,
  })
  .strict();

export const resourcePatchSchema = z
  .object({
    id,
    status: z.enum(['想读', '在读', '已读']),
    idempotencyKey,
  })
  .strict();

export const publicEventSchema = z
  .object({
    action: z.enum(PUBLIC_EVENT_ACTIONS),
    result: z.record(z.string(), z.unknown()).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey,
  })
  .strict();
