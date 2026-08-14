export const LEARNING_CONTEXT_KEYS = ['workspace', 'concept', 'source', 'attempt'] as const;

type ContextId = string;

export type LearningSource =
  | { type: 'message'; sessionId: ContextId; messageId: ContextId }
  | { type: 'note'; id: ContextId }
  | { type: 'resource'; id: ContextId };

export type LearningAttempt =
  | { type: 'practice'; id: ContextId }
  | { type: 'interview'; id: ContextId }
  | { type: 'review'; id: ContextId };

export type LearningContext = {
  workspaceId: ContextId | null;
  conceptId: ContextId | null;
  source: LearningSource | null;
  attempt: LearningAttempt | null;
};

type SearchReader = { get(name: string): string | null };

const CONTEXT_ID = /^[a-z0-9][a-z0-9_-]{0,159}$/i;
const MESSAGE_ID = /^[a-z0-9][a-z0-9_:-]{0,239}$/i;

export function parseLearningContext(search: SearchReader): LearningContext {
  return {
    workspaceId: validId(search.get('workspace')),
    conceptId: validId(search.get('concept')),
    source: parseSource(search.get('source')),
    attempt: parseAttempt(search.get('attempt')),
  };
}

export function sourceRef(source: LearningSource) {
  if (source.type === 'message') return `message:${source.sessionId}:${source.messageId}`;
  return `${source.type}:${source.id}`;
}

export function attemptRef(attempt: LearningAttempt) {
  return `${attempt.type}:${attempt.id}`;
}

export function contextFocusRef(context: LearningContext) {
  if (context.attempt) return attemptRef(context.attempt);
  if (context.source) return sourceRef(context.source);
  if (context.conceptId) return `concept:${context.conceptId}`;
  return null;
}

/** 给模块链接追加统一上下文，不覆盖链接自身的对象选择参数。 */
export function withLearningContext(
  href: string,
  context: Partial<LearningContext>,
) {
  const [withoutHash, hash = ''] = href.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  const params = new URLSearchParams(query);
  setOrDelete(params, 'workspace', context.workspaceId);
  setOrDelete(params, 'concept', context.conceptId);
  setOrDelete(params, 'source', context.source ? sourceRef(context.source) : context.source);
  setOrDelete(params, 'attempt', context.attempt ? attemptRef(context.attempt) : context.attempt);
  const serialized = params.toString();
  return `${pathname}${serialized ? `?${serialized}` : ''}${hash ? `#${hash}` : ''}`;
}

export function withoutLearningContext(href: string) {
  const [withoutHash, hash = ''] = href.split('#', 2);
  const [pathname, query = ''] = withoutHash.split('?', 2);
  const params = new URLSearchParams(query);
  for (const key of LEARNING_CONTEXT_KEYS) params.delete(key);
  const serialized = params.toString();
  return `${pathname}${serialized ? `?${serialized}` : ''}${hash ? `#${hash}` : ''}`;
}

export function sourceHref(source: LearningSource, context: LearningContext) {
  if (source.type === 'message') {
    return withLearningContext(`/?session=${source.sessionId}&message=${source.messageId}`, {
      ...context,
      source,
      attempt: null,
    });
  }
  const path = source.type === 'note' ? `/notes?note=${source.id}` : `/resources?resource=${source.id}`;
  return withLearningContext(path, { ...context, source, attempt: null });
}

export function attemptHref(attempt: LearningAttempt, context: LearningContext) {
  const path = attempt.type === 'practice'
    ? '/practice'
    : attempt.type === 'interview'
      ? '/interview'
      : '/review';
  return withLearningContext(path, { ...context, attempt });
}

function parseSource(value: string | null): LearningSource | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts[0] === 'message' && parts.length >= 3) {
    const sessionId = validId(parts[1]);
    const messageId = validMessageId(parts.slice(2).join(':'));
    return sessionId && messageId ? { type: 'message', sessionId, messageId } : null;
  }
  if ((parts[0] === 'note' || parts[0] === 'resource') && parts.length === 2) {
    const id = validId(parts[1]);
    return id ? { type: parts[0], id } : null;
  }
  return null;
}

function parseAttempt(value: string | null): LearningAttempt | null {
  if (!value) return null;
  const [type, rawId, ...extra] = value.split(':');
  const id = validId(rawId);
  if (extra.length || !id || !['practice', 'interview', 'review'].includes(type)) return null;
  return { type: type as LearningAttempt['type'], id };
}

function validId(value: string | null | undefined) {
  return value && CONTEXT_ID.test(value) ? value : null;
}

function validMessageId(value: string | null | undefined) {
  return value && MESSAGE_ID.test(value) ? value : null;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value === undefined) return;
  if (value === null) params.delete(key);
  else params.set(key, value);
}
