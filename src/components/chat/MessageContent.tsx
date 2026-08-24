'use client';

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { filterMutedSegments, readTermBlacklist, subscribeTermBlacklist } from '@/lib/term-blacklist';
import { parseTermMarkers } from '@/lib/term-parse';
import { Term, type TermAction } from './Term';

/**
 * 消息正文渲染（全局会话 Markdown）：
 * - 助手回答走 react-markdown + remark-gfm，样式由 `.md-chat` 手绘主题块承载，
 *   覆盖标题 / 列表 / 引用 / 代码 / 表格 / 链接等常用组件；
 * - `[[术语]]` 标记在文本节点内解析为高亮 Term（命中黑名单降级为普通文本），
 *   行内代码保持字面；
 * - 用户消息保持纯文本（不走 MD，避免误格式化提问原文）。
 * 流式未闭合的标记由解析器容错为普通文本。
 */

const EMPTY_BLACKLIST = new Set<string>();

/** 把一段纯文本按术语标记切分为 Term / 字符串节点。 */
function termifyText(text: string, ctx: RenderCtx): ReactNode[] {
  return filterMutedSegments(parseTermMarkers(text), ctx.blacklist).map((seg, i) =>
    seg.type === 'term' ? (
      <Term
        key={i}
        name={seg.value}
        definition={ctx.termDefs[seg.value]}
        onAction={ctx.onTermAction}
        sourceMessageId={ctx.messageId}
      />
    ) : (
      <Fragment key={i}>{seg.value}</Fragment>
    ),
  );
}

/** 递归遍历 React 子树，把字符串叶子术语化；code / pre 内保持字面。 */
function termify(node: ReactNode, ctx: RenderCtx): ReactNode {
  if (typeof node === 'string') return termifyText(node, ctx);
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{termify(child, ctx)}</Fragment>);
  }
  if (isValidElement(node)) {
    // code / pre（含 Term 自身）不术语化，保留字面内容
    if (node.type === 'code' || node.type === 'pre' || node.type === Term) return node;
    const children = Children.toArray(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    );
    if (children.length === 0) return node;
    return cloneElement(
      node,
      undefined,
      ...children.map((child) => termify(child, ctx)),
    );
  }
  return node;
}

type RenderCtx = {
  termDefs: Record<string, string>;
  onTermAction?: (action: TermAction, name: string, messageId: string) => void;
  messageId: string;
  blacklist: ReadonlySet<string>;
};

/** 承载文本的块级组件统一走 termify；样式交给 .md-chat 全局块。 */
function mdComponents(ctx: RenderCtx): Components {
  const t = (children?: ReactNode) => termify(children ?? null, ctx);
  return {
    p: ({ children }) => <p>{t(children)}</p>,
    h1: ({ children }) => <h1>{t(children)}</h1>,
    h2: ({ children }) => <h2>{t(children)}</h2>,
    h3: ({ children }) => <h3>{t(children)}</h3>,
    h4: ({ children }) => <h4>{t(children)}</h4>,
    h5: ({ children }) => <h5>{t(children)}</h5>,
    h6: ({ children }) => <h6>{t(children)}</h6>,
    li: ({ children }) => <li>{t(children)}</li>,
    strong: ({ children }) => <strong>{t(children)}</strong>,
    em: ({ children }) => <em>{t(children)}</em>,
    th: ({ children }) => <th>{t(children)}</th>,
    td: ({ children }) => <td>{t(children)}</td>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer">
        {t(children)}
      </a>
    ),
    // 表格包一层横向滚动，避免推动页面溢出
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    ),
  };
}

export function MessageContent({
  text,
  termDefs,
  onTermAction,
  messageId,
  markdown = false,
}: {
  text: string;
  termDefs: Record<string, string>;
  onTermAction?: (action: TermAction, name: string, messageId: string) => void;
  messageId: string;
  /** 助手回答走 Markdown；用户提问保持纯文本 */
  markdown?: boolean;
}) {
  // 黑名单为 localStorage 真相源（服务端快照恒为空集），变更后消息区自动重渲染
  const blacklist = useSyncExternalStore(
    subscribeTermBlacklist,
    readTermBlacklist,
    () => EMPTY_BLACKLIST,
  );
  const ctx: RenderCtx = { termDefs, onTermAction, messageId, blacklist };

  if (!markdown) {
    return <span className="whitespace-pre-wrap">{termifyText(text, ctx)}</span>;
  }
  return (
    <div className="md-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents(ctx)}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
