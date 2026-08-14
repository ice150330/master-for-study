import { generateNote, noteToMarkdown } from '@/lib/ai/note';
import { createNote, listMessages, listNotes } from '@/lib/db';

/**
 * 学习笔记接口。
 *
 * GET  /api/notes          —— 列出全部笔记
 * POST /api/notes          —— 由某会话生成笔记
 *    body: { sessionId: string }
 */

export async function GET() {
  const notes = listNotes();
  return Response.json({ notes });
}

export async function POST(req: Request) {
  const { sessionId } = (await req.json()) as { sessionId?: string };

  if (!sessionId) {
    return Response.json({ error: '缺少 sessionId' }, { status: 400 });
  }

  const messages = listMessages(sessionId);
  if (messages.length === 0) {
    return Response.json({ error: '该会话还没有消息' }, { status: 400 });
  }

  const generated = await generateNote(
    messages.map((m) => ({ role: m.role, content: m.content })),
  );
  const markdown = noteToMarkdown(generated);

  const note = createNote({
    sessionId,
    title: generated.title,
    content: generated as unknown as Record<string, unknown>,
    markdown,
  });

  return Response.json({ note }, { status: 201 });
}
