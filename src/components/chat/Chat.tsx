'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage, isAbortError, request, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { SessionDeck } from './SessionDeck';
import { SessionPicker } from './SessionPicker';
import type { TermAction } from './Term';
import type { ChatModel, ChatMsg, ChatSession, HistoricalTerm } from './chat-types';

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
  const toast = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [termDefs, setTermDefs] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<{
    message: string;
    retryText?: string;
    idempotencyKey?: string;
  } | null>(null);
  const initRan = useRef(false);
  const currentSessionRef = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const sessionLoadSequence = useRef(0);
  const activeRequest = useRef<{
    id: number;
    sessionId: string;
    controller: AbortController;
  } | null>(null);

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
      try {
        const list = await refreshSessions();
        if (list.length > 0) await openSession(list[0].id);
      } catch (error) {
        setRequestError({ message: getErrorMessage(error, '会话加载失败') });
      }
    })();
    // 首次挂载只做一次初始化；后续会话切换由显式操作驱动。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => activeRequest.current?.controller.abort();
  }, []);

  async function refreshSessions(): Promise<ChatSession[]> {
    const data = await requestJson<{
      sessions: ChatSession[];
      archivedSessions?: ChatSession[];
    }>('/api/sessions');
    setSessions(data.sessions);
    setArchivedSessions(data.archivedSessions ?? []);
    return data.sessions;
  }

  async function openSession(id: string) {
    stopStreaming(false);
    const loadId = ++sessionLoadSequence.current;
    setRequestError(null);
    try {
      const data = await requestJson<{ messages: ChatMsg[]; terms?: HistoricalTerm[] }>(
        `/api/sessions/${id}`,
      );
      if (loadId !== sessionLoadSequence.current) return;
      currentSessionRef.current = id;
      setCurrentSessionId(id);
      setMessages(
        data.messages.map((message, index) => ({
          ...message,
          id: message.id ?? `${id}:history:${index}`,
          status: message.status ?? 'complete',
        })),
      );
      setTermDefs(
        Object.fromEntries((data.terms ?? []).map((term) => [term.name, term.definition])),
      );
    } catch (error) {
      if (loadId !== sessionLoadSequence.current) return;
      setRequestError({ message: getErrorMessage(error, '会话加载失败') });
    }
  }

  /** 新建 / 派生会话，返回新会话 id。 */
  async function createSession(
    parentId: string | null,
    title?: string,
    previousIdempotencyKey?: string,
  ): Promise<string | null> {
    const data = await requestJson<{ session: { id: string } }>('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentId,
        title,
        idempotencyKey: previousIdempotencyKey ?? createIdempotencyKey('session'),
      }),
    });
    await refreshSessions();
    return data.session.id;
  }

  async function newSession() {
    stopStreaming(false);
    setRequestError(null);
    try {
      const id = await createSession(null);
      if (id) await openSession(id);
    } catch (error) {
      setRequestError({ message: getErrorMessage(error, '新建会话失败') });
    }
  }

  async function send(
    textOverride?: string,
    retry = false,
    previousIdempotencyKey?: string,
    baseOverride?: ChatMsg[],
  ) {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('chat');
    let sid = currentSessionId;
    try {
      if (!sid) {
        sid = await createSession(null, undefined, `${idempotencyKey}:session`);
        if (!sid) return;
        currentSessionRef.current = sid;
        setCurrentSessionId(sid);
      }
    } catch (error) {
      setRequestError({
        message: getErrorMessage(error, '新建会话失败'),
        retryText: text,
        idempotencyKey,
      });
      return;
    }

    setInput('');
    setRequestError(null);
    let retryBase = messages;
    if (retry && retryBase.at(-1)?.role === 'assistant' && retryBase.at(-1)?.status === 'error') {
      retryBase = retryBase.slice(0, -1);
    }
    if (retry && retryBase.at(-1)?.role === 'user' && retryBase.at(-1)?.content === text) {
      retryBase = retryBase.slice(0, -1);
    }
    const baseMessages = baseOverride ?? retryBase;
    const userMessage: ChatMsg = {
      id: `${idempotencyKey}:user`,
      role: 'user',
      content: text,
      status: 'complete',
    };
    const assistantMessage: ChatMsg = {
      id: `${idempotencyKey}:assistant`,
      role: 'assistant',
      content: '',
      status: 'streaming',
    };
    const history: ChatMsg[] = [...baseMessages, userMessage];
    setMessages([...history, assistantMessage]);
    setIsStreaming(true);

    const requestId = ++requestSequence.current;
    const controller = new AbortController();
    activeRequest.current = { id: requestId, sessionId: sid, controller };

    try {
      // 第一段：流式正文（正文内 [[术语]] 内联标记），消息由服务端落库
      const res = await request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: sid, model, idempotencyKey }),
        signal: controller.signal,
        timeoutMs: 45_000,
      });
      if (!res.body) throw new Error('服务未返回可读取的内容');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        if (!isCurrentRequest(requestId, sid)) return;
        setMessages([...history, { ...assistantMessage, content: full }]);
      }
      if (isCurrentRequest(requestId, sid)) {
        setMessages([...history, { ...assistantMessage, content: full, status: 'complete' }]);
      }

      // 第二段：术语结构化提取（名称 + 一句话解释）
      if (!isCurrentRequest(requestId, sid)) return;
      try {
        await loadTermDefs(full, controller.signal, requestId, sid, idempotencyKey);
      } catch (error) {
        if (!isCurrentRequest(requestId, sid) || isAbortError(error)) return;
        toast({
          title: '回答已完成，术语解释稍后补充',
          description: getErrorMessage(error, '术语提取暂时不可用'),
          tone: 'error',
        });
      }
      if (isCurrentRequest(requestId, sid)) {
        try {
          await refreshSessions();
        } catch (error) {
          if (isCurrentRequest(requestId, sid)) {
            toast({
              title: '回答已完成，会话列表暂未刷新',
              description: getErrorMessage(error, '会话刷新失败'),
              tone: 'error',
            });
          }
        }
      }
    } catch (error) {
      if (!isCurrentRequest(requestId, sid) || isAbortError(error)) return;
      setMessages([
        ...history,
        {
          ...assistantMessage,
          status: 'error',
          error: getErrorMessage(error, '回答生成失败'),
        },
      ]);
      setInput(text);
      setRequestError({
        message: getErrorMessage(error, '对话生成失败，请稍后重试'),
        retryText: text,
        idempotencyKey,
      });
    } finally {
      if (activeRequest.current?.id === requestId) {
        activeRequest.current = null;
        setIsStreaming(false);
      }
    }
  }

  async function loadTermDefs(
    text: string,
    signal: AbortSignal,
    requestId: number,
    sessionId: string,
    chatIdempotencyKey: string,
  ) {
    const data = await requestJson<{ terms: Array<{ name: string; definition: string }> }>('/api/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        idempotencyKey: `${chatIdempotencyKey}:terms`,
      }),
      signal,
    });
    if (!isCurrentRequest(requestId, sessionId)) return;
    const map: Record<string, string> = {};
    for (const t of data.terms) map[t.name] = t.definition;
    setTermDefs((prev) => ({ ...prev, ...map }));
  }

  async function handleTermAction(action: TermAction, name: string) {
    if (action === 'branch') {
      stopStreaming(false);
      try {
        const id = await createSession(currentSessionId, `术语：${name}`);
        if (id) await openSession(id);
      } catch (error) {
        setRequestError({ message: getErrorMessage(error, '创建术语分支失败') });
      }
    } else if (action === 'new') {
      await newSession();
    } else if (action === 'followup') {
      await send(`请再详细解释一下「${name}」，并举一个例子。`);
    }
  }

  async function updateCurrentSession(
    action:
      | { action: 'rename'; title: string }
      | { action: 'pin'; pinned: boolean }
      | { action: 'archive'; archived: boolean },
  ) {
    if (!currentSessionId) return;
    setRequestError(null);
    try {
      await requestJson(`/api/sessions/${currentSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...action,
          idempotencyKey: createIdempotencyKey(`session-${action.action}`),
        }),
      });
      const active = await refreshSessions();
      if (action.action === 'archive' && action.archived) {
        if (active[0]) await openSession(active[0].id);
        else clearCurrentSession();
      }
      if (action.action === 'archive') {
        toast({ title: action.archived ? '会话已归档' : '会话已恢复', tone: 'success' });
      }
    } catch (error) {
      setRequestError({ message: getErrorMessage(error, '会话更新失败') });
    }
  }

  async function restoreSession(id: string) {
    try {
      await requestJson(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'archive',
          archived: false,
          idempotencyKey: createIdempotencyKey('session-restore'),
        }),
      });
      await refreshSessions();
      await openSession(id);
      toast({ title: '会话已恢复', tone: 'success' });
    } catch (error) {
      setRequestError({ message: getErrorMessage(error, '恢复会话失败') });
    }
  }

  async function deleteCurrentSession() {
    if (!currentSessionId) return;
    stopStreaming(false);
    try {
      await requestJson(`/api/sessions/${currentSessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: createIdempotencyKey('session-delete') }),
      });
      const active = await refreshSessions();
      if (active[0]) await openSession(active[0].id);
      else clearCurrentSession();
      toast({ title: '会话已删除', tone: 'success' });
    } catch (error) {
      setRequestError({ message: getErrorMessage(error, '删除会话失败') });
    }
  }

  function clearCurrentSession() {
    currentSessionRef.current = null;
    setCurrentSessionId(null);
    setMessages([]);
    setTermDefs({});
  }

  function regenerateLastAnswer() {
    const lastUserIndex = messages.findLastIndex((message) => message.role === 'user');
    if (lastUserIndex < 0) return;
    void send(messages[lastUserIndex].content, false, undefined, messages.slice(0, lastUserIndex));
  }

  function continueAnswer() {
    void send('请从刚才中断的位置继续，不要重复已经给出的内容。');
  }

  function isCurrentRequest(requestId: number, sessionId: string) {
    const active = activeRequest.current;
    return active?.id === requestId && currentSessionRef.current === sessionId;
  }

  const stopStreaming = useCallback(
    (notify = true) => {
      const active = activeRequest.current;
      if (!active) return;
      activeRequest.current = null;
      active.controller.abort();
      setIsStreaming(false);
      setMessages((items) =>
        items.map((message, index) =>
          index === items.length - 1 && message.status === 'streaming'
            ? { ...message, status: 'error', error: '已停止生成' }
            : message,
        ),
      );
      if (notify) {
        toast({ title: '已停止生成', description: '已保留当前收到的内容。', tone: 'info' });
      }
    },
    [toast],
  );

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
          archivedSessions={archivedSessions}
          currentId={currentSessionId}
          onSelect={openSession}
          onNew={newSession}
          onRestore={restoreSession}
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
        onStop={() => stopStreaming()}
        onRegenerate={regenerateLastAnswer}
        onContinue={continueAnswer}
        requestError={
          requestError
            ? {
                title: '本次操作未完成',
                description: requestError.message,
                actionLabel: requestError.retryText ? '重新发送' : undefined,
                onAction: requestError.retryText
                  ? () => send(requestError.retryText, true, requestError.idempotencyKey)
                  : undefined,
              }
            : null
        }
        model={model}
        onModelChange={changeModel}
        onSelect={openSession}
        onRename={(title) => updateCurrentSession({ action: 'rename', title })}
        onPin={(pinned) => updateCurrentSession({ action: 'pin', pinned })}
        onArchive={() => updateCurrentSession({ action: 'archive', archived: true })}
        onDelete={deleteCurrentSession}
      />
    </div>
  );
}
