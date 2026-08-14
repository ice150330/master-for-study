import { Suspense } from 'react';
import { NotesView } from '@/components/notes/NotesView';

const note = {
  id: '11111111-1111-4111-8111-111111111111',
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  title: 'HTTP 缓存策略笔记',
  content: {},
  aiSnapshot: { source: 'ai' },
  userContent: null,
  tags: ['HTTP', 'Cache-Control'],
  version: 1,
  markdown: '# HTTP 缓存策略\n\n## 核心概念\n\n- **Cache-Control**：声明缓存复用条件。\n\n## 代码示例\n\n```http\nCache-Control: max-age=3600\n```',
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-15T00:00:00.000Z',
  versions: [
    {
      id: 'version-ai',
      version: 1,
      origin: 'ai' as const,
      title: 'HTTP 缓存策略笔记',
      markdown: '# HTTP 缓存策略\n\nAI 初始内容',
      tags: ['HTTP', 'Cache-Control'],
      createdAt: '2026-08-15T00:00:00.000Z',
    },
  ],
  sources: [
    {
      id: 'source-valid',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      startMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      endMessageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      excerpt: '缓存策略来源对话',
      valid: true,
      sessionTitle: 'HTTP 缓存策略',
    },
  ],
};

const invalidNote = {
  ...note,
  id: '22222222-2222-4222-8222-222222222222',
  sessionId: null,
  title: '已失效来源示例',
  tags: ['来源检查'],
  sources: [
    {
      id: 'source-invalid',
      sessionId: null,
      startMessageId: null,
      endMessageId: null,
      excerpt: null,
      valid: false,
      sessionTitle: null,
    },
  ],
};

export default function NotesFixturePage() {
  return (
    <Suspense fallback={null}>
      <NotesView
        initialNotes={[note, invalidNote]}
        initialSessions={[
          { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', parentId: null, title: 'HTTP 缓存策略' },
        ]}
        initialTerms={[
          { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Cache-Control' },
        ]}
        initialSelectedId={note.id}
      />
    </Suspense>
  );
}
