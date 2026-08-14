import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { load } from 'cheerio';
import { inferResourceType, normalizeResourceUrl } from './url';
import type { ResourceMetadata } from './types';

const MAX_HTML_BYTES = 600_000;
const MAX_REDIRECTS = 4;

export async function fetchResourceMetadata(input: string): Promise<ResourceMetadata> {
  let target = normalizeResourceUrl(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    let response: Response | null = null;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      await assertPublicUrl(target);
      response = await fetch(target, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'MentorResourceMetadata/1.0',
        },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('资源链接重定向次数过多');
      target = normalizeResourceUrl(new URL(location, target).toString());
    }
    if (!response?.ok) throw new Error(`网页返回 ${response?.status ?? '未知'} 状态`);
    const contentType = response.headers.get('content-type') ?? '';
    const html = contentType.includes('html') ? await readLimitedText(response) : '';
    const $ = load(html);
    const canonicalCandidate = value($('link[rel="canonical"]').attr('href'));
    const canonicalUrl = canonicalCandidate
      ? normalizeResourceUrl(new URL(canonicalCandidate, target).toString())
      : normalizeResourceUrl(target);
    const siteName = firstValue(
      $('meta[property="og:site_name"]').attr('content'),
      new URL(target).hostname.replace(/^www\./, ''),
    );
    const title = firstValue(
      $('meta[property="og:title"]').attr('content'),
      $('meta[name="twitter:title"]').attr('content'),
      $('title').text(),
      fallbackTitle(target),
    ) as string;
    const author = firstValue(
      $('meta[name="author"]').attr('content'),
      $('meta[property="article:author"]').attr('content'),
    );
    const description = firstValue(
      $('meta[property="og:description"]').attr('content'),
      $('meta[name="description"]').attr('content'),
    );
    const favicon = firstValue(
      $('link[rel="icon"]').attr('href'),
      $('link[rel="shortcut icon"]').attr('href'),
    );
    return {
      title,
      canonicalUrl,
      siteName,
      author,
      description,
      faviconUrl: favicon ? new URL(favicon, target).toString() : new URL('/favicon.ico', target).toString(),
      type: inferResourceType(canonicalUrl, siteName),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertPublicUrl(input: string) {
  const url = new URL(input);
  const hostname = url.hostname.toLocaleLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('不能读取本机或局域网地址');
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('不能读取本机或局域网地址');
    return;
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('不能读取本机或局域网地址');
  }
}

export function isPrivateAddress(address: string) {
  const normalized = address.toLocaleLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const ipv4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  const parts = ipv4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a >= 224;
}

async function readLimitedText(response: Response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('网页内容过大，无法自动提取元数据');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

function firstValue(...values: Array<string | null | undefined>) {
  return values.map(value).find(Boolean) ?? null;
}

function value(input?: string | null) {
  return input?.trim() || null;
}

function fallbackTitle(input: string) {
  const url = new URL(input);
  return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname);
}
