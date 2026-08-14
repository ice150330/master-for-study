import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeRelation } from '../../src/lib/knowledge/types';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '14-knowledge-whiteboard';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);

test('局部知识图支持中心搜索、深度、关系筛选、节点轨道和会话图', async ({ page }, testInfo) => {
  test.skip(!['desktop-1440x900', 'tablet-1024x768'].includes(testInfo.project.name), '阶段 14 不做移动端逐状态精修');
  await fs.mkdir(captureRoot, { recursive: true });
  await page.route('**/api/knowledge-graph?*', async (route) => {
    const url = new URL(route.request().url());
    const depth = Number(url.searchParams.get('depth') ?? 1) as 1 | 2;
    const relations = url.searchParams.getAll('relation') as KnowledgeRelation[];
    await route.fulfill({ json: { graph: fixtureGraph(depth, relations.length ? relations : undefined) } });
  });
  await page.route('**/api/knowledge-graph', async (route) => {
    if (route.request().method() === 'PATCH') await route.fulfill({ json: { ok: true } });
    else await route.fallback();
  });

  await page.goto('/whiteboard', { waitUntil: 'networkidle' });
  const canvas = page.getByTestId('knowledge-canvas');
  await expect(canvas.locator('.react-flow__viewport')).toBeVisible();

  await page.getByRole('textbox', { name: '搜索白板节点' }).fill('Python');
  await page.getByRole('button', { name: 'Python Concept', exact: true }).click();
  await expect(page.getByText('4 / 9 个节点 · 3 条关系')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Python' })).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-local-one-hop-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '2 跳' }).click();
  await expect(page.getByText('9 / 9 个节点 · 9 条关系')).toBeVisible();
  await expect(canvas.locator('.react-flow__node')).toHaveCount(9);
  await expect(canvas.locator('.react-flow__minimap-node')).toHaveCount(9);
  await page.screenshot({ path: path.join(captureRoot, `${phase}-two-hop-fit-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByLabel('机器学习，知识概念').click();
  await expect(page.getByRole('heading', { name: '机器学习' })).toBeVisible();
  await expect(page.getByText('掌握依据')).toBeVisible();
  await expect(page.getByText('训练模型前需要稳定的数据表示与评估方式。')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-node-evidence-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '关系 4' }).click();
  await expect(page.getByRole('button', { name: '属于', exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-relation-filter-${testInfo.project.name}.png`), animations: 'disabled' });
  await page.getByRole('button', { name: '属于', exact: true }).click();
  await expect(page.getByRole('button', { name: '关系 3' })).toBeVisible();

  await page.getByRole('tab', { name: '会话分支' }).click();
  await expect(page.getByText(/个节点 · .*条关系/).first()).toBeVisible();
  await expect(canvas.locator('.react-flow__node').first()).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-session-branches-${testInfo.project.name}.png`), animations: 'disabled' });
});

function fixtureGraph(depth: 1 | 2, relations = ['part_of', 'prerequisite', 'related', 'applied_in'] as KnowledgeRelation[]): KnowledgeGraph {
  const allNodes = fixtureNodes();
  const allEdges = fixtureEdges().filter((edge) => relations.includes(edge.relation as KnowledgeRelation));
  const included = collect('python', allEdges, depth);
  const nodes = allNodes.filter((node) => included.has(node.id));
  return {
    mode: 'knowledge',
    centerId: 'python',
    depth,
    nodes,
    edges: allEdges.filter((edge) => included.has(edge.source) && included.has(edge.target)),
    searchOptions: allNodes.map((node) => ({ id: node.id, label: node.label, kind: node.kind, termId: node.termId })),
    totalNodes: allNodes.length,
  };
}

function fixtureNodes(): KnowledgeGraphNode[] {
  return [
    node('python', 'Python', '用于数据处理、自动化与模型实验。', 'reviewing', { messages: 4, notes: 2, resources: 2, practice: 3 }),
    domain('data-ai', '数据与 AI', '数据处理、建模和智能系统相关能力。'),
    node('machine-learning', '机器学习', '训练模型前需要稳定的数据表示与评估方式。', 'learning', { messages: 3, notes: 1, interviews: 2 }),
    node('data-analysis', '数据分析', '从数据中提出、验证并表达判断。', 'reviewing', { messages: 2, practice: 2 }),
    node('decision-tree', '决策树', '以特征条件逐步划分样本空间。', 'learning', { messages: 1, reviews: 1 }),
    node('preprocessing', '数据预处理', '清洗、编码和标准化原始数据。', 'new', { resources: 1 }),
    node('evaluation', '模型评估', '用可靠指标验证泛化表现。', 'relearning', { interviews: 1, reviews: 2 }),
    node('feature', '特征工程', '把业务信息转换为可学习表示。', 'new', { notes: 1 }),
    node('ai', '人工智能', '构建能够感知、推理或决策的系统。', 'learning', { messages: 5, resources: 1 }),
  ];
}

function fixtureEdges(): KnowledgeGraphEdge[] {
  const edge = (id: string, source: string, target: string, relation: KnowledgeRelation): KnowledgeGraphEdge => ({ id, source, target, relation, weight: 1, evidenceType: relation === 'related' ? 'mention' : 'seed' });
  return [
    edge('e1', 'python', 'data-ai', 'part_of'),
    edge('e2', 'python', 'machine-learning', 'prerequisite'),
    edge('e3', 'python', 'data-analysis', 'applied_in'),
    edge('e4', 'machine-learning', 'decision-tree', 'part_of'),
    edge('e5', 'machine-learning', 'preprocessing', 'prerequisite'),
    edge('e6', 'machine-learning', 'evaluation', 'prerequisite'),
    edge('e7', 'data-analysis', 'feature', 'related'),
    edge('e8', 'data-ai', 'ai', 'part_of'),
    edge('e9', 'ai', 'machine-learning', 'part_of'),
  ];
}

function node(id: string, label: string, description: string, masteryState: NonNullable<KnowledgeGraphNode['masteryState']>, evidence: Partial<KnowledgeGraphNode['evidence']>): KnowledgeGraphNode {
  return {
    id,
    label,
    kind: 'concept',
    termId: `${id}-term`,
    description,
    masteryState,
    evidence: { messages: 0, notes: 0, resources: 0, interviews: 0, practice: 0, reviews: 0, ...evidence },
    href: `/?concept=${id}-term`,
    position: null,
  };
}

function domain(id: string, label: string, description: string): KnowledgeGraphNode {
  return { id, label, kind: 'domain', termId: null, description, masteryState: null, evidence: { messages: 0, notes: 0, resources: 0, interviews: 0, practice: 0, reviews: 0 }, href: null, position: null };
}

function collect(centerId: string, edges: KnowledgeGraphEdge[], depth: 1 | 2) {
  const included = new Set([centerId]);
  let frontier = [centerId];
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const id of frontier) for (const edge of edges) {
      const neighbor = edge.source === id ? edge.target : edge.target === id ? edge.source : null;
      if (neighbor) { included.add(neighbor); next.add(neighbor); }
    }
    frontier = [...next];
  }
  return included;
}
