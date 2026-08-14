'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SessionDeck } from './SessionDeck';
import { SessionPicker } from './SessionPicker';
import type { TermAction } from './Term';
import type { ChatModel, ChatMsg, ChatSession } from './chat-types';

/**
 * 聊天页状态容器：持有会话 / 消息 / 流式 / 术语 / 模型等全部状态与请求逻辑，
 * 布局委托 SessionDeck（祖先堆 + 当前大卡片 + 分支扇）与 SessionPicker。
 * 流式两段式不变：① /api/chat 纯文本流 ② 完成后 /api/terms 提取术语定义。
 */

const MODEL_KEY = 'mentor-model';
const MODEL_EVENT = 'mentor-model-change';

/** 订阅模型偏好变化：本标签页走自定义事件，跨标签页走 storage 事件。 */
function subscribeModel(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(MODEL_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(MODEL_EVENT, cb);
  };
}

export function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [termDefs, setTermDefs] = useState<Record<string, string>>({});
  const initRan = useRef(false);

  // 模型偏好：localStorage 为真相源（服务端快照恒为 fast，避免 hydration 不匹配）
  const model = useSyncExternalStore(
    subscribeModel,
    (): ChatModel => (localStorage.getItem(MODEL_KEY) === 'pro' ? 'pro' : 'fast'),
    (): ChatModel => 'fast',
  );

  // 初始化：加载会话列表，有则打开最近一个。
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    (async () => {
      const list = await refreshSessions();
      if (list.length > 0) await openSession(list[0].id);
    })();
  }, []);

  async function refreshSessions(): Promise<ChatSession[]> {
    const res = await fetch('/api/sessions');
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: ChatSession[] };
    setSessions(data.sessions);
    return data.sessions;
  }

  async function openSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages: ChatMsg[] };
    setCurrentSessionId(id);
    setMessages(data.messages);
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
    const history: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      // 第一段：流式正文（正文内 [[术语]] 内联标记），消息由服务端落库
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: sid, model }),
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

  function changeModel(m: ChatModel) {
    try {
      localStorage.setItem(MODEL_KEY, m);
    } catch {
      // 忽略
    }
    window.dispatchEvent(new Event(MODEL_EVENT));
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-4">
      {/* 工具行：全部会话 + 新话题 */}
      <div className="flex shrink-0 items-center">
        <SessionPicker
          sessions={sessions}
          currentId={currentSessionId}
          onSelect={openSession}
          onNew={newSession}
        />
      </div>

      {/* 卡片堆舞台（祖先堆 + 当前会话大卡片 + 分支扇） */}
      <SessionDeck
        sessions={sessions}
        currentSessionId={currentSessionId}
        messages={messages}
        isStreaming={isStreaming}
        termDefs={termDefs}
        onTermAction={handleTermAction}
        input={input}
        onInputChange={setInput}
        onSend={() => send()}
        model={model}
        onModelChange={changeModel}
        onSelect={openSession}
      />
    </div>
  );
}
