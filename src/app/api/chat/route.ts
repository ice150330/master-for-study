import { createTextStreamResponse, streamText, toTextStream } from 'ai';
import { fastModel, proModel } from '@/lib/ai/provider';
import { TERM_ANNOTATION_SYSTEM_PROMPT } from '@/lib/ai/term-annotation';
import { findMessageByIdempotencyKey, getSession, saveMessage } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { chatRequestSchema } from '@/lib/validation/schemas';

/**
 * 流式对话接口。
 *
 * 请求体：{ messages, model?: 'fast'|'pro', sessionId, idempotencyKey }
 * 响应：text/plain 流，正文中的技术术语以 [[术语]] 内联标记。
 * 附带：用户与助手消息分别在事务中和 message_sent 事件一起落库。
 */

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, chatRequestSchema);
    if (!parsed.success) return parsed.response;
    const { messages, model, sessionId, idempotencyKey } = parsed.data;

    if (!getSession(sessionId)) {
      throw new DomainError('SESSION_NOT_FOUND', '会话不存在', 404);
    }
    const last = messages.at(-1);
    if (last?.role !== 'user') {
      throw new DomainError('INVALID_MESSAGE_ORDER', '最后一条消息必须来自用户', 400);
    }
    const previousAssistant = findMessageByIdempotencyKey(`${idempotencyKey}:assistant`);
    if (previousAssistant) {
      return new Response(previousAssistant.content, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const selected = model === 'pro' ? proModel : fastModel;

    // 用户消息与事件同事务写入；重试沿用幂等键，不重复落库。
    saveMessage({
      sessionId,
      role: 'user',
      content: last.content,
      idempotencyKey,
    });

    const result = streamText({
      model: selected,
      system: TERM_ANNOTATION_SYSTEM_PROMPT,
      messages,
      onFinish: ({ text }) => {
        saveMessage({
          sessionId,
          role: 'assistant',
          content: text,
          idempotencyKey: `${idempotencyKey}:assistant`,
        });
      },
    });

    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
    });
  });
}
