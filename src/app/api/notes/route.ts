import { generateNote, noteToMarkdown } from '@/lib/ai/note';
import {
  createNote,
  findEventByIdempotencyKey,
  getNote,
  getSession,
  listMessages,
  listNoteSources,
  listNoteVersions,
  listNotes,
  updateNote,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { noteUpdateSchema, notesCreateSchema } from '@/lib/validation/schemas';

/**
 * 学习笔记接口。
 *
 * GET  /api/notes          —— 列出全部笔记
 * POST /api/notes          —— 由某会话生成笔记
 *    body: { sessionId: string }
 */

export async function GET() {
  return withApiErrors(() =>
    Response.json({
      notes: listNotes().map((note) => ({
        ...note,
        versions: listNoteVersions(note.id),
        sources: listNoteSources(note.id),
      })),
    }),
  );
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, notesCreateSchema);
    if (!parsed.success) return parsed.response;
    const previous = findEventByIdempotencyKey(parsed.data.idempotencyKey);
    if (previous?.objectId) {
      const note = getNote(previous.objectId);
      if (note) return Response.json({ note }, { status: 200 });
    }

    if (!getSession(parsed.data.sessionId)) {
      throw new DomainError('SESSION_NOT_FOUND', '会话不存在', 404);
    }

    const messages = listMessages(parsed.data.sessionId);
    if (messages.length === 0) {
      throw new DomainError('SESSION_EMPTY', '该会话还没有消息', 400);
    }
    const generated = await generateNote(
      messages.map((message) => ({ role: message.role, content: message.content })),
    );
    const note = createNote({
      sessionId: parsed.data.sessionId,
      title: generated.title,
      content: generated as unknown as Record<string, unknown>,
      markdown: noteToMarkdown(generated),
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return Response.json(
      {
        note: {
          ...note,
          versions: listNoteVersions(note.id),
          sources: listNoteSources(note.id),
        },
      },
      { status: 201 },
    );
  });
}

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, noteUpdateSchema);
    if (!parsed.success) return parsed.response;
    if (!getNote(parsed.data.id)) throw new DomainError('NOTE_NOT_FOUND', '笔记不存在', 404);
    const note = updateNote(parsed.data);
    return Response.json({
      note: {
        ...note,
        versions: listNoteVersions(note.id),
        sources: listNoteSources(note.id),
      },
    });
  });
}
