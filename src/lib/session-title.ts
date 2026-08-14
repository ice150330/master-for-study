const DEFAULT_TITLE = '新会话';

export function deriveSessionTitle(content: string, maxLength = 32) {
  const normalized = content
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return DEFAULT_TITLE;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export { DEFAULT_TITLE };
