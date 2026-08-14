'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { buildSessionTree, type SessionTreeNode } from '@/lib/session-tree';
import { MessageContent } from './MessageContent';
import type { TermAction } from './Term';

type Msg = { role: 'user' | 'assistant'; content: string };
type Session = { id: string; parentId: string | null; title: string; createdAt: string };

/**
 * 聊天工作区：会话树侧边栏 + 流式对话 + 术语高亮与悬停弹窗。
 * 阶段 1 接入 SQLite 持久化（消息 / 会话 / 术语 / 学习事件）。
 */
export function Chat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [termDefs, setTermDefs] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const initRan = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化：加载会话列表，有则打开最近一个。
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    (async () => {
      const list = await refreshSessions();
      if (list.length > 0) await openSession(list[0].id);
    })();
  }, []);

  async function refreshSessions(): Promise<Session[]> {
    const res = await fetch('/api/sessions');
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: Session[] };
    setSessions(data.sessions);
    return data.sessions;
  }

  async function openSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    };
    setCurrentSessionId(id);
    setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
    setTermDefs({});
  }

  /** 新建 / 派生会话，返回新会话 id。 */
  async function createSession(
    parentId: string | null,
    title?: string,
  ): Promise<string | null> {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, title }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { session: { id: string } };
    await refreshSessions();
    return data.session.id;
  }

  async function newSession() {
    const id = await createSession(null);
    if (id) await openSession(id);
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    let sid = currentSessionId;
    if (!sid) {
      sid = await createSession(null);
      if (!sid) return;
      setCurrentSessionId(sid);
    }

    setInput('');
    const history: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      // 第一段：流式正文（正文内 [[术语]] 内联标记），消息由服务端落库
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: sid }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: full }]);
      }

      // 第二段：术语结构化提取（名称 + 一句话解释）
      await loadTermDefs(full);
      await refreshSessions();
    } catch (err) {
      console.error('对话失败：', err);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: '（对话失败，请确认 DeepSeek key 已配置且网络可用）',
        };
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  async function loadTermDefs(text: string) {
    const res = await fetch('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { terms: Array<{ name: string; definition: string }> };
    const map: Record<string, string> = {};
    for (const t of data.terms) map[t.name] = t.definition;
    setTermDefs((prev) => ({ ...prev, ...map }));
  }

  async function handleTermAction(action: TermAction, name: string) {
    if (action === 'branch') {
      const id = await createSession(currentSessionId, `术语：${name}`);
      if (id) await openSession(id);
    } else if (action === 'new') {
      await newSession();
    } else if (action === 'followup') {
      await send(`请再详细解释一下「${name}」，并举一个例子。`);
    }
  }

  const tree = buildSessionTree(sessions);

  return (
    <div className="flex h-screen">
      {/* 会话树侧边栏 */}
      <aside className="w-64 shrink-0 space-y-2 overflow-y-auto border-r border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">会话树</h2>
          <button
            type="button"
            onClick={newSession}
            className="rounded-lg bg-primary px-2 py-1 text-xs text-foreground"
          >
            + 新会话
          </button>
        </div>
        {tree.length === 0 ? (
          <p className="text-xs text-muted">暂无会话，点「+ 新会话」开始</p>
        ) : (
          renderTree(tree, currentSessionId, openSession)
        )}
      </aside>

      {/* 主聊天区 */}
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6">
        <header className="mb-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mentor</h1>
          <p className="mt-1 text-sm text-muted">本地 AI 学习老师 · 术语会高亮，悬停看解释</p>
          <nav className="mt-3 flex justify-center gap-3">
            <Link
              href="/notes"
              className="rounded-lg bg-card px-3 py-1.5 text-xs text-background transition-colors hover:bg-card-soft"
            >
              学习笔记
            </Link>
            <Link
              href="/interview"
              className="rounded-lg bg-card px-3 py-1.5 text-xs text-background transition-colors hover:bg-card-soft"
            >
              模拟面试
            </Link>
            <Link
              href="/review"
              className="rounded-lg bg-card px-3 py-1.5 text-xs text-background transition-colors hover:bg-card-soft"
            >
              复习
            </Link>
            <Link
              href="/analytics"
              className="rounded-lg bg-card px-3 py-1.5 text-xs text-background transition-colors hover:bg-card-soft"
            >
              成长分析
            </Link>
            <Link
              href="/whiteboard"
              className="rounded-lg bg-card px-3 py-1.5 text-xs text-background transition-colors hover:bg-card-soft"
            >
              白板
            </Link>
          </nav>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl bg-background/40 p-4">
          {messages.length === 0 && (
            <p className="py-16 text-center text-sm text-muted">
              随便问个技术问题，比如「什么是 DNS？」
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                  m.role === 'user' ? 'bg-primary text-foreground' : 'bg-card text-background'
                }`}
              >
                <MessageContent
                  text={m.content}
                  termDefs={termDefs}
                  onTermAction={handleTermAction}
                />
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start">
              <span className="text-xs text-muted">思考中…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-4 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-background outline-none placeholder:text-background/40 focus:border-primary"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={isStreaming}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-foreground transition-opacity disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

/** 递归渲染会话树。 */
function renderTree(
  nodes: SessionTreeNode<Session>[],
  currentId: string | null,
  onSelect: (id: string) => void,
  depth = 0,
): ReactNode {
  return (
    <ul className={depth > 0 ? 'ml-3 border-l border-border pl-2' : 'space-y-1'}>
      {nodes.map((n) => (
        <li key={n.id} className="space-y-1">
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={`w-full truncate rounded-lg px-2 py-1 text-left text-xs transition-colors ${
              n.id === currentId
                ? 'bg-primary text-foreground'
                : 'text-muted hover:bg-card hover:text-background'
            }`}
          >
            {n.title}
          </button>
          {n.children.length > 0 && renderTree(n.children, currentId, onSelect, depth + 1)}
        </li>
      ))}
    </ul>
  );
}
