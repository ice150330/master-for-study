import type { ResourceTypeValue } from './types';

const trackingParameters = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'spm',
]);

/** 规范化 URL 用于工作区内去重；保留可能影响内容的业务参数。 */
export function normalizeResourceUrl(input: string) {
  const url = new URL(input.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('资源链接只支持 HTTP 或 HTTPS');
  }
  url.hash = '';
  url.hostname = url.hostname.toLocaleLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLocaleLowerCase().startsWith('utm_') || trackingParameters.has(key.toLocaleLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  const sorted = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  url.search = '';
  for (const [key, value] of sorted) url.searchParams.append(key, value);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function inferResourceType(urlInput: string, siteName?: string | null): ResourceTypeValue {
  const url = new URL(urlInput);
  const hostname = url.hostname.toLocaleLowerCase();
  const label = `${hostname} ${siteName ?? ''}`.toLocaleLowerCase();
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'GitHub';
  if (/youtube|bilibili|vimeo|视频/.test(label)) return '视频';
  if (/docs\.|developer\.|documentation|文档/.test(label) || /\/docs?\//.test(url.pathname)) return '文档';
  if (/book|ebook|书籍/.test(label)) return '书籍';
  if (/blog|medium|substack|博客/.test(label)) return '博客';
  return '教程';
}
