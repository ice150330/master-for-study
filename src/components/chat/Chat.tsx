'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageContent } from './MessageContent';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * 聊天工作区：流式对话 + 术语高亮 + 悬停弹窗。
 * 阶段 0 不落库；阶段 1 接入会话树与持久化。
 */
export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [termDefs, setTermDefs] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');
    const history: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      // 第一段：流式正文（正文内 [[术语]] 内联标记）
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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

  return (
    <div className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4 py-6">
      {/* 标题区 */}
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mentor</h1>
        <p className="mt-1 text-sm text-muted">本地 AI 学习老师 · 术语会高亮，悬停看解释</p>
      </header>

      {/* 消息区 */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl bg-background/40 p-4">
        {messages.length === 0 && (
          <p className="py-16 text-center text-sm text-muted">
            随便问个技术问题，比如「什么是 DNS？」
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-md ${
                m.role === 'user'
                  ? 'bg-primary text-foreground'
                  : 'bg-card text-background'
              }`}
            >
              <MessageContent text={m.content} termDefs={termDefs} />
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

      {/* 输入区 */}
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
          onClick={send}
          disabled={isStreaming}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-foreground transition-opacity disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  );
}
