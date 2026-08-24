'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { ConceptRail, type ConceptDetail } from '@/components/context/ConceptRail';
import { getErrorMessage, isAbortError, request, requestJson } from '@/lib/http/client';
import { createIdempotencyKey } from '@/lib/http/idempotency';
import { parseLearningContext, withLearningContext } from '@/lib/learning-context';
import { SessionDeck } from './SessionDeck';
import { SessionPicker } from './SessionPicker';
import type { TermAction } from './Term';
import type { ChatModel, ChatMsg, ChatResource, ChatSession, HistoricalTerm } from './chat-types';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const learningContext = useMemo(() => parseLearningContext(searchParams), [searchParams]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [resourceOptions, setResourceOptions] = useState<ChatResource[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [termDefs, setTermDefs] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<{
    message: string;
    retryText?: string;
    idempotencyKey?: string;
  } | null>(null);
  const [conceptPanel, setConceptPanel] = useState<{
    name: string;
    sourceMessageId?: string;
    detail: ConceptDetail | null;
    loading: boolean;
    error: string | null;
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
        try {
          await refreshResources();
        } catch {
          setResourceOptions([]);
        }
        const list = await refreshSessions();
        const requestedSession = new URLSearchParams(window.location.search).get('session');
        const requestedMessage = new URLSearchParams(window.location.search).get('message');
        const target = requestedSession && list.some((session) => session.id === requestedSession)
          ? requestedSession
          : list[0]?.id;
        if (target) {
          await openSession(target);
          if (requestedMessage) window.setTimeout(() => focusMessage(requestedMessage), 80);
        }
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

  useEffect(() => {
    const conceptId = new URLSearchParams(window.location.search).get('concept');
    if (conceptId) void loadConcept({ id: conceptId, syncUrl: false });
    // 仅消费首次进入页面时来自笔记或资源的 Concept 深链接。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function refreshResources() {
    const data = await requestJson<{ resources: ChatResource[] }>('/api/resources');
    setResourceOptions(data.resources);
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
      setSelectedResourceIds([]);
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
    forkedFromMessageId?: string,
  ): Promise<string | null> {
    const data = await requestJson<{ session: { id: string } }>('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentId: forkedFromMessageId ? undefined : parentId,
        forkedFromMessageId,
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
    targetSessionId?: string,
    resourceIdsOverride?: string[],
  ) {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    const idempotencyKey = previousIdempotencyKey ?? createIdempotencyKey('chat');
    const resourceIds = resourceIdsOverride ?? selectedResourceIds;
    const selectedSources = resourceOptions.filter((resource) => resourceIds.includes(resource.id));
    let sid = targetSessionId ?? currentSessionId;
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
      sources: selectedSources,
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
        body: JSON.stringify({ message: text, sessionId: sid, model, resourceIds, idempotencyKey }),
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
        setSelectedResourceIds([]);
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
        sessionId,
        sourceMessageIdempotencyKey: `${chatIdempotencyKey}:assistant`,
        idempotencyKey: `${chatIdempotencyKey}:terms`,
      }),
      signal,
    });
    if (!isCurrentRequest(requestId, sessionId)) return;
    const map: Record<string, string> = {};
    for (const t of data.terms) map[t.name] = t.definition;
    setTermDefs((prev) => ({ ...prev, ...map }));
  }

  async function createSemanticBranch(
    messageId: string,
    title: string,
    firstQuestion: string,
  ) {
    if (!currentSessionId) return;
    stopStreaming(false);
    const parentId = currentSessionId;
    try {
      const id = await createSession(parentId, title, undefined, messageId);
      if (!id) return;
      await openSession(id);
      await send(firstQuestion, false, undefined, [], id);
    } catch (error) {
      setRequestError({ message: getErrorMessage(error, '创建语义分支失败') });
    }
  }

  async function handleTermAction(action: TermAction, name: string, messageId: string) {
    if (action === 'open') {
      await loadConcept({ name, sourceMessageId: messageId });
    } else if (action === 'branch') {
      await createSemanticBranch(
        messageId,
        `术语：${name}`,
        `结合刚才的上下文，解释「${name}」在这里的具体含义，并给出一个贴近原问题的例子。`,
      );
    } else if (action === 'new') {
      await newSession();
    } else if (action === 'followup') {
      await send(`请再详细解释一下「${name}」，并举一个例子。`);
    }
  }

  async function loadConcept({
    id,
    name,
    sourceMessageId,
    syncUrl = true,
  }: {
    id?: string;
    name?: string;
    sourceMessageId?: string;
    syncUrl?: boolean;
  }) {
    const label = name ?? '知识对象';
    setConceptPanel({ name: label, sourceMessageId, detail: null, loading: true, error: null });
    try {
      const query = new URLSearchParams(id ? { id } : { name: name ?? '' });
      const detail = await requestJson<ConceptDetail>(`/api/concepts?${query}`);
      setConceptPanel({
        name: detail.concept.canonicalName,
        sourceMessageId,
        detail,
        loading: false,
        error: null,
      });
      if (syncUrl) {
        const source = sourceMessageId && currentSessionId
          ? { type: 'message' as const, sessionId: currentSessionId, messageId: sourceMessageId }
          : learningContext.source;
        router.push(withLearningContext(currentSessionId ? `/?session=${currentSessionId}${sourceMessageId ? `&message=${sourceMessageId}` : ''}` : '/', {
          ...learningContext,
          conceptId: detail.concept.id,
          source,
          attempt: null,
        }));
      }
    } catch (error) {
      setConceptPanel({
        name: label,
        sourceMessageId,
        detail: null,
        loading: false,
        error: getErrorMessage(error, '知识对象加载失败'),
      });
    }
  }

  function followupConcept() {
    const concept = conceptPanel?.detail?.concept;
    const sourceMessageId = conceptPanel?.sourceMessageId;
    if (!concept) return;
    setConceptPanel(null);
    if (sourceMessageId && currentSessionId) {
      void createSemanticBranch(
        sourceMessageId,
        `概念：${concept.canonicalName}`,
        `结合原消息继续解释「${concept.canonicalName}」，重点说明它和当前主题之间的关系。`,
      );
    } else {
      void send(`继续解释「${concept.canonicalName}」，并结合当前会话给出一个例子。`);
    }
  }

  async function openConceptSource(source: ConceptDetail['mentions'][number]) {
    if (source.sourceType === 'message' && source.sessionId) {
      router.push(withLearningContext(`/?session=${source.sessionId}&message=${source.sourceId}`, {
        ...learningContext,
        source: { type: 'message', sessionId: source.sessionId, messageId: source.sourceId },
        attempt: null,
      }));
      await openSession(source.sessionId);
      requestAnimationFrame(() => focusMessage(source.sourceId));
      return;
    }
    if (source.sourceType === 'note') router.push(withLearningContext(`/notes?note=${source.sourceId}`, {
      ...learningContext,
      source: { type: 'note', id: source.sourceId },
      attempt: null,
    }));
    if (source.sourceType === 'resource') router.push(withLearningContext(`/resources?resource=${source.sourceId}`, {
      ...learningContext,
      source: { type: 'resource', id: source.sourceId },
      attempt: null,
    }));
  }

  function focusMessage(messageId: string) {
    const target = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.animate(
      [
        { backgroundColor: 'transparent' },
        { backgroundColor: 'var(--card-soft)' },
        { backgroundColor: 'transparent' },
      ],
      { duration: 900 },
    );
  }

  function branchFromMessage(messageId: string) {
    void createSemanticBranch(
      messageId,
      '从消息继续',
      '请从这条消息继续深入，先概括我们已经确认的上下文，再展开一个最值得追问的方向。',
    );
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
    const previousSources = messages.slice(lastUserIndex + 1).find((message) => message.role === 'assistant')?.sources ?? [];
    const resourceIds = previousSources.map((source) => source.id);
    setSelectedResourceIds(resourceIds);
    void send(messages[lastUserIndex].content, false, undefined, messages.slice(0, lastUserIndex), undefined, resourceIds);
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
    <div
      className={`grid h-full min-h-0 ${
        conceptPanel ? 'min-[1180px]:grid-cols-[minmax(0,1fr)_20rem]' : ''
      }`}
    >
      <div className="flex min-h-0 min-w-0 flex-col gap-3 px-4 py-4">
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
        resourceOptions={resourceOptions}
        selectedResourceIds={selectedResourceIds}
        onToggleResource={(id) => setSelectedResourceIds((items) =>
          items.includes(id) ? items.filter((item) => item !== id) : [...items, id].slice(-5))}
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
        onBranchFromMessage={branchFromMessage}
      />
      </div>
      {conceptPanel ? (
        <aside aria-label="概念详情" className="paper-popover z-40 min-h-0 overflow-hidden border-l max-[1179px]:fixed max-[1179px]:inset-x-0 max-[1179px]:bottom-0 max-[1179px]:h-[68vh] max-[1179px]:rounded-t-lg max-[1179px]:border">
          <ConceptRail
            name={conceptPanel.name}
            detail={conceptPanel.detail}
            loading={conceptPanel.loading}
            error={conceptPanel.error}
            onClose={() => setConceptPanel(null)}
            onFollowup={followupConcept}
            onOpenSource={openConceptSource}
            learningContext={learningContext}
          />
        </aside>
      ) : null}
    </div>
  );
}
