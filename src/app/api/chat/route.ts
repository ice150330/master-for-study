import { createTextStreamResponse, streamText, toTextStream } from 'ai';
import { fastModel, proModel } from '@/lib/ai/provider';
import { TERM_ANNOTATION_SYSTEM_PROMPT } from '@/lib/ai/term-annotation';
import { recordEvent, saveMessage } from '@/lib/db';

/**
 * 流式对话接口。
 *
 * 请求体：{ messages, model?: 'fast'|'pro', sessionId?: string }
 * 响应：text/plain 流，正文中的技术术语以 [[术语]] 内联标记。
 * 附带：新用户消息即时落库，助手回复在 onFinish 落库，并写一条 message_sent 事件。
 */

export async function POST(req: Request) {
  const { messages, model, sessionId } = (await req.json()) as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: 'fast' | 'pro';
    sessionId?: string;
  };

  const selected = model === 'pro' ? proModel : fastModel;

  // 新用户消息落库（历史消息已存在库中，仅持久化最后一条用户消息）。
  if (sessionId) {
    const last = messages[messages.length - 1];
    if (last?.role === 'user') {
      saveMessage({ sessionId, role: 'user', content: last.content });
    }
  }

  const result = streamText({
    model: selected,
    system: TERM_ANNOTATION_SYSTEM_PROMPT,
    messages,
    onFinish: ({ text }) => {
      if (sessionId) {
        saveMessage({ sessionId, role: 'assistant', content: text });
        recordEvent({
          type: 'message_sent',
          entityId: sessionId,
          metadata: { role: 'assistant', length: text.length },
        });
      }
    },
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
