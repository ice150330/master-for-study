import { createTextStreamResponse, streamText, toTextStream } from 'ai';
import { fastModel, proModel } from '@/lib/ai/provider';
import { TERM_ANNOTATION_SYSTEM_PROMPT } from '@/lib/ai/term-annotation';

/**
 * 流式对话接口。
 *
 * 请求体：{ messages: Array<{ role: 'user'|'assistant', content: string }>, model?: 'fast'|'pro' }
 * 响应：text/plain 流，正文中的技术术语以 [[术语]] 内联标记。
 */

export async function POST(req: Request) {
  const { messages, model } = (await req.json()) as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: 'fast' | 'pro';
  };

  const selected = model === 'pro' ? proModel : fastModel;

  const result = streamText({
    model: selected,
    system: TERM_ANNOTATION_SYSTEM_PROMPT,
    messages,
  });

  // AI SDK v7：推荐用 toTextStream + createTextStreamResponse 组合输出纯文本流。
  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
