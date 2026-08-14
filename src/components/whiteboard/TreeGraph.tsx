import type { LaidOutNode, TreeLayout } from '@/lib/tree-layout';

/**
 * 树图 SVG 渲染器：把 layoutTree 产出的布局画成节点 + 连线。
 * 布局横向从左（根）到右（叶子）展开，纵向按叶子序号排布。
 */

const NODE_W = 128;
const NODE_H = 40;
const GAP_X = 56;
const GAP_Y = 24;
const PAD = 20;

type NodeStyle = { fill?: string; text?: string };

export function TreeGraph<T>({
  layout,
  nodeStyle,
}: {
  layout: TreeLayout<T>;
  nodeStyle?: (node: LaidOutNode<T>) => NodeStyle;
}) {
  const { nodes, edges, maxDepth, maxLeaf } = layout;
  const width = PAD * 2 + maxDepth * (NODE_W + GAP_X) + NODE_W;
  const height = PAD * 2 + maxLeaf * (NODE_H + GAP_Y) + NODE_H;

  const cx = (x: number) => PAD + x * (NODE_W + GAP_X) + NODE_W / 2;
  const cy = (y: number) => PAD + y * (NODE_H + GAP_Y) + NODE_H / 2;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {edges.map((e, i) => {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={cx(from.x) + NODE_W / 2}
            y1={cy(from.y)}
            x2={cx(to.x) - NODE_W / 2}
            y2={cy(to.y)}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.5}
          />
        );
      })}

      {nodes.map((n) => {
        const style = nodeStyle?.(n) ?? {};
        const fill = style.fill ?? '#6c5ce7';
        const text = style.text ?? '#fafafa';
        return (
          <g key={n.id}>
            <rect
              x={cx(n.x) - NODE_W / 2}
              y={cy(n.y) - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={12}
              fill={fill}
            />
            <text
              x={cx(n.x)}
              y={cy(n.y)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={text}
              fontSize={13}
              fontWeight={600}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
