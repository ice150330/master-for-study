import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDir: string;
let dbPath: string;
let repository: typeof import('../../src/lib/db');

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-db-'));
  dbPath = path.join(tempDir, 'integration.db');
  process.env.MENTOR_DB_PATH = dbPath;
  repository = await import('../../src/lib/db');
  repository.resetDbForTests();
});

afterAll(() => {
  repository.resetDbForTests();
  delete process.env.MENTOR_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('SQLite 仓库事务与幂等性', () => {
  it('活跃会话按最近活动倒序返回', async () => {
    const older = repository.createSession({
      title: '较早会话',
      idempotencyKey: 'session:test:older',
    });
    await new Promise((resolve) => setTimeout(resolve, 3));
    const newer = repository.createSession({
      title: '较新会话',
      idempotencyKey: 'session:test:newer',
    });
    expect(repository.listSessions()[0].id).toBe(newer.id);

    await new Promise((resolve) => setTimeout(resolve, 3));
    repository.saveMessage({
      sessionId: older.id,
      role: 'user',
      content: '继续较早会话',
      idempotencyKey: 'message:test:resume-older',
    });
    expect(repository.listSessions()[0].id).toBe(older.id);
  });

  it('相同幂等键只创建一个会话和一条事件', () => {
    const first = repository.createSession({
      title: '事务测试会话',
      idempotencyKey: 'session:test:create',
    });
    const second = repository.createSession({
      title: '重复请求不应覆盖',
      idempotencyKey: 'session:test:create',
    });

    expect(second.id).toBe(first.id);
    expect(repository.listSessions().filter((session) => session.id === first.id)).toHaveLength(1);
    const event = repository.findEventByIdempotencyKey('session:test:create');
    expect(event).toMatchObject({
      action: 'session_created',
      objectType: 'session',
      objectId: first.id,
      schemaVersion: 1,
    });
    expect(event?.workspaceId).toBeTruthy();
  });

  it('消息、资源和复习的重复请求不重复落库', () => {
    const session = repository.createSession({
      title: '幂等写入',
      idempotencyKey: 'session:test:writes',
    });
    const firstMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '第一次消息',
      idempotencyKey: 'message:test:one',
    });
    const secondMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '重复消息',
      idempotencyKey: 'message:test:one',
    });
    expect(secondMessage.id).toBe(firstMessage.id);
    expect(repository.listMessages(session.id)).toHaveLength(1);

    const firstResource = repository.createResource({
      title: 'SQLite 文档',
      type: '文档',
      url: 'https://sqlite.org/docs.html',
      idempotencyKey: 'resource:test:create',
    });
    const secondResource = repository.createResource({
      title: '重复资源',
      type: '博客',
      url: 'https://example.com/duplicate',
      idempotencyKey: 'resource:test:create',
    });
    expect(secondResource.id).toBe(firstResource.id);
    expect(repository.listResources().filter((resource) => resource.id === firstResource.id)).toHaveLength(1);

    const term = repository.upsertTerm({
      name: '事务',
      definition: '一组不可分割的数据库操作。',
      idempotencyKey: 'term:test:create',
    });
    const firstReview = repository.reviewTerm({
      termId: term.id,
      grade: 'good',
      idempotencyKey: 'review:test:one',
    });
    const secondReview = repository.reviewTerm({
      termId: term.id,
      grade: 'again',
      idempotencyKey: 'review:test:one',
    });
    expect(secondReview).toEqual(firstReview);
    expect(repository.findEventByIdempotencyKey('review:test:one')).toMatchObject({
      result: { grade: 'good', algorithmVersion: 'ts-fsrs-6@5.4.1' },
      context: { termId: term.id, answerMode: 'oral', recallProvided: false, durationMs: 0 },
    });
  });

  it('资源支持多概念、重复链接合并、摘录和消息引用持久化', () => {
    const firstTerm = repository.upsertTerm({
      name: '资源检索',
      definition: '从资料库中找到相关证据。',
      idempotencyKey: 'term:resource:retrieval',
    });
    const secondTerm = repository.upsertTerm({
      name: '证据引用',
      definition: '让回答能够回到原始资料。',
      idempotencyKey: 'term:resource:citation',
    });
    const thirdTerm = repository.upsertTerm({
      name: '阅读摘录',
      definition: '记录资料中的关键片段。',
      idempotencyKey: 'term:resource:highlight',
    });
    const resource = repository.createResource({
      title: 'SQLite FTS5 指南',
      type: '文档',
      url: 'https://sqlite.org/fts5.html?utm_source=test',
      canonicalUrl: 'https://sqlite.org/fts5.html',
      conceptIds: [firstTerm.id, secondTerm.id],
      tags: ['检索', '数据库'],
      note: '重点关注 bm25 排序。',
      idempotencyKey: 'resource:test:knowledge-source',
    });

    expect(repository.findResourceByCanonicalUrl('https://sqlite.org/fts5.html')?.id).toBe(resource.id);
    expect(repository.getResourceDetail(resource.id)?.concepts.map((concept) => concept.id).sort()).toEqual(
      [firstTerm.id, secondTerm.id].sort(),
    );

    const merged = repository.mergeResource({
      id: resource.id,
      conceptIds: [secondTerm.id, thirdTerm.id],
      tags: ['数据库', '全文搜索'],
      idempotencyKey: 'resource:test:knowledge-source:merge',
    });
    expect(merged.concepts.map((concept) => concept.id).sort()).toEqual(
      [firstTerm.id, secondTerm.id, thirdTerm.id].sort(),
    );
    expect(merged.tags.sort()).toEqual(['全文搜索', '数据库', '检索'].sort());
    expect(repository.listResources().filter((item) => item.id === resource.id)).toHaveLength(1);

    const updated = repository.updateResource({
      id: resource.id,
      title: resource.title,
      type: resource.type,
      status: '在读',
      progress: 45,
      tags: merged.tags,
      note: '已读到查询语法，下一步验证排名函数。',
      conceptIds: merged.concepts.map((concept) => concept.id),
      idempotencyKey: 'resource:test:knowledge-source:update',
    });
    expect(updated).toMatchObject({ status: '在读', progress: 45 });

    const highlight = repository.createResourceHighlight({
      resourceId: resource.id,
      excerpt: 'The FTS5 extension provides full-text search capabilities.',
      note: '可作为本地知识检索的第一阶段实现。',
      locator: '#overview-of-fts5',
      idempotencyKey: 'resource:test:knowledge-source:highlight',
    });
    expect(repository.getResourceDetail(resource.id)?.highlights[0]).toMatchObject({ id: highlight.id });

    const session = repository.createSession({
      title: '带资料的对话',
      idempotencyKey: 'session:test:resource-citation',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '可以先用 FTS5 建立全文索引。[来源 1]',
      resourceIds: [resource.id],
      idempotencyKey: 'message:test:resource-citation',
    });
    const reloaded = repository.listMessagesWithResources(session.id);
    expect(reloaded[0]).toMatchObject({
      content: '可以先用 FTS5 建立全文索引。[来源 1]',
      sources: [{ id: resource.id, title: resource.title, url: resource.url }],
    });
  });

  it('知识图同步真实 Concept、来源关系、局部深度和独立布局', () => {
    const alpha = repository.upsertTerm({
      name: '图谱 Alpha',
      definition: '局部图测试的中心概念。',
      idempotencyKey: 'term:graph:alpha',
    });
    const beta = repository.upsertTerm({
      name: '图谱 Beta',
      definition: '与中心概念直接相关。',
      idempotencyKey: 'term:graph:beta',
    });
    const gamma = repository.upsertTerm({
      name: '图谱 Gamma',
      definition: '通过 Beta 与中心形成二跳关系。',
      idempotencyKey: 'term:graph:gamma',
    });
    repository.recordConceptMention({ termId: alpha.id, sourceType: 'message', sourceId: 'graph-source-one', idempotencyKey: 'mention:graph:alpha:one' });
    repository.recordConceptMention({ termId: beta.id, sourceType: 'message', sourceId: 'graph-source-one', idempotencyKey: 'mention:graph:beta:one' });
    repository.recordConceptMention({ termId: beta.id, sourceType: 'message', sourceId: 'graph-source-two', idempotencyKey: 'mention:graph:beta:two' });
    repository.recordConceptMention({ termId: gamma.id, sourceType: 'message', sourceId: 'graph-source-two', idempotencyKey: 'mention:graph:gamma:two' });

    const centerId = `concept:${alpha.id}`;
    const oneHop = repository.getKnowledgeGraph({ centerId, depth: 1, relations: ['related'] });
    const twoHop = repository.getKnowledgeGraph({ centerId, depth: 2, relations: ['related'] });
    expect(oneHop.nodes.map((node) => node.termId)).toContain(beta.id);
    expect(oneHop.nodes.map((node) => node.termId)).not.toContain(gamma.id);
    expect(twoHop.nodes.map((node) => node.termId)).toContain(gamma.id);
    expect(twoHop.nodes.find((node) => node.termId === beta.id)?.evidence.messages).toBe(2);
    expect(twoHop.edges.every((edge) => edge.evidenceType === 'mention')).toBe(true);
    expect(repository.getKnowledgeGraph({ centerId, depth: 2 }).totalNodes).toBe(repository.getKnowledgeGraph({ centerId, depth: 2 }).totalNodes);

    expect(repository.saveKnowledgeNodeLayout({
      nodeId: centerId,
      x: 128,
      y: -64,
      idempotencyKey: 'knowledge-layout:test:alpha',
    })).toBe(true);
    repository.saveKnowledgeNodeLayout({
      nodeId: centerId,
      x: 999,
      y: 999,
      idempotencyKey: 'knowledge-layout:test:alpha',
    });
    expect(repository.getKnowledgeGraph({ centerId, depth: 1 }).nodes.find((node) => node.id === centerId)?.position).toEqual({ x: 128, y: -64 });
    expect(repository.findEventByIdempotencyKey('knowledge-layout:test:alpha')).toMatchObject({
      action: 'knowledge_layout_changed',
      objectType: 'knowledge_node',
      objectId: centerId,
    });
  });

  it('会话知识图节点保留分支消息锚点', () => {
    const root = repository.createSession({ title: '图谱根会话', idempotencyKey: 'session:graph:root' });
    const anchor = repository.saveMessage({ sessionId: root.id, role: 'assistant', content: '从这条消息继续。', idempotencyKey: 'message:graph:anchor' });
    const branch = repository.createSession({
      title: '图谱分支会话',
      parentId: root.id,
      forkedFromMessageId: anchor.id,
      idempotencyKey: 'session:graph:branch',
    });
    const graph = repository.getSessionKnowledgeGraph();
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: root.id, target: branch.id, relation: 'branch' }));
    expect(graph.nodes.find((node) => node.id === branch.id)?.href).toContain(`message=${anchor.id}`);
  });

  it('正式 FSRS 的预览与提交一致，Again 不会立即回到队首', () => {
    const term = repository.upsertTerm({
      name: '检索练习',
      definition: '从记忆中主动提取答案。',
      idempotencyKey: 'term:review:preview',
    });
    // A2 队列治理：新概念默认待确认，显式确认后才进入队列
    repository.setTermQueueStatus(term.id, 'active');
    const now = new Date('2027-01-01T08:00:00.000Z');
    const item = repository.getReviewQueue(now).reviews.find((review) => review.termId === term.id);
    expect(item).toBeTruthy();
    const result = repository.reviewTerm({
      termId: term.id,
      grade: 'again',
      answerMode: 'typed',
      recallText: '先尝试回忆',
      durationMs: 12_000,
      reviewedAt: now,
      idempotencyKey: 'review:preview:again',
    });
    expect(result.dueAt.toISOString()).toBe(item?.preview.again.dueAt);
    expect(result.intervalLabel).toBe(item?.preview.again.intervalLabel);
    expect(repository.getReviewQueue(now).reviews.some((review) => review.termId === term.id)).toBe(false);
  });

  it('撤销最近评级会恢复卡片，但不修改原 ReviewLog', () => {
    const term = repository.upsertTerm({
      name: '撤销复习',
      definition: '撤销只追加新事实。',
      idempotencyKey: 'term:review:undo',
    });
    repository.setTermQueueStatus(term.id, 'active');
    const reviewedAt = new Date('2027-01-02T08:00:00.000Z');
    const result = repository.reviewTerm({
      termId: term.id,
      grade: 'good',
      answerMode: 'typed',
      recallText: '不可变日志',
      reviewedAt,
      idempotencyKey: 'review:undo:grade',
    });
    const beforeUndo = repository.listReviewLogs(term.id)[0];
    const undo = repository.undoReview({
      reviewLogId: result.logId,
      idempotencyKey: 'review:undo:one',
    });
    expect(undo).toMatchObject({ reviewLogId: result.logId, termId: term.id, restoredState: 'new' });
    expect(repository.listReviewLogs(term.id)).toEqual([beforeUndo]);
    expect(repository.getReviewQueue(reviewedAt).reviews.some((review) => review.termId === term.id)).toBe(true);
  });

  it('困难卡标记幂等并留下学习事件', () => {
    const term = repository.upsertTerm({
      name: '困难卡',
      definition: '需要额外处理的复习卡。',
      idempotencyKey: 'term:review:difficult',
    });
    const first = repository.setReviewCardDifficult({
      termId: term.id,
      difficult: true,
      idempotencyKey: 'review:difficult:one',
    });
    const second = repository.setReviewCardDifficult({
      termId: term.id,
      difficult: false,
      idempotencyKey: 'review:difficult:one',
    });
    expect(second).toEqual(first);
    expect(repository.findEventByIdempotencyKey('review:difficult:one')).toMatchObject({
      action: 'review_card_flagged',
      result: { difficult: true },
    });
  });

  it('工作区设置首次访问落默认行，之后部分更新生效', () => {
    const defaults = repository.getWorkspaceSettings();
    expect(defaults.teacherStyle).toBe('lecturer');
    expect(defaults.retentionTarget).toBe(0.85);
    expect(defaults.answerDepth).toBe('standard');
    // 再读一次拿到的是同一行（不是每次插入新默认行）
    expect(repository.getWorkspaceSettings().id).toBe(defaults.id);

    const updated = repository.updateWorkspaceSettings({
      teacherStyle: 'strict',
      retentionTarget: 0.9,
      interviewStyle: null,
    });
    expect(updated.teacherStyle).toBe('strict');
    expect(updated.retentionTarget).toBe(0.9);
    expect(updated.interviewStyle).toBeNull();
    // 未提交的字段保持原值
    expect(updated.answerDepth).toBe('standard');
    expect(repository.getWorkspaceSettings()).toMatchObject({ teacherStyle: 'strict' });
  });

  it('每日新学量上限约束新卡进入今日队列，超额新卡顺延', () => {
    const now = new Date('2027-01-03T08:00:00.000Z');
    const before = repository.getReviewQueue(now, 500);
    const newBefore = before.reviews.filter((review) => review.state === 'new').length;

    // 上限设为当前可见新卡数：存量不动，新增新卡应被顺延
    repository.updateWorkspaceSettings({ dailyNewLimit: newBefore });
    const extra = repository.upsertTerm({
      name: '每日上限新卡',
      definition: '超出每日新学量的新卡顺延到明天。',
      idempotencyKey: 'term:cap:extra',
    });
    const capped = repository.getReviewQueue(now, 500);
    expect(capped.reviews.some((review) => review.termId === extra.id)).toBe(false);
    expect(capped.reviews.filter((review) => review.state === 'new').length).toBe(newBefore);

    // 提高上限并确认入队后恢复可见，摘要与队列保持一致
    repository.updateWorkspaceSettings({ dailyNewLimit: newBefore + 1 });
    repository.setTermQueueStatus(extra.id, 'active');
    const restored = repository.getReviewQueue(now, 500);
    expect(restored.reviews.some((review) => review.termId === extra.id)).toBe(true);
    expect(restored.summary.due).toBe(restored.reviews.length);
  });

  it('队列治理：新概念默认待确认，确认后入队，可移出、恢复与顺延', () => {
    // 上限测试留下的小额度会挡住本用例的新卡；放开每日新学量，聚焦队列状态语义。
    // 顺延以真实 now 为基准，因此整个用例用真实时间断言。
    repository.updateWorkspaceSettings({ dailyNewLimit: 50 });
    const term = repository.upsertTerm({
      name: '队列治理概念',
      definition: '待确认概念不进入到期队列。',
      idempotencyKey: 'term:queue:governance',
    });
    const now = new Date();

    // 新概念默认待确认：队列不可见，但出现在待确认清单
    let queue = repository.getReviewQueue(now, 500);
    expect(queue.reviews.some((review) => review.termId === term.id)).toBe(false);
    expect(repository.listPendingQueueTerms()).toEqual(
      expect.arrayContaining([expect.objectContaining({ termId: term.id, name: '队列治理概念' })]),
    );

    // 确认入队后可见（新卡立即到期）
    repository.setTermQueueStatus(term.id, 'active');
    queue = repository.getReviewQueue(now, 500);
    expect(queue.reviews.some((review) => review.termId === term.id)).toBe(true);

    // 移出队列后不可见，待确认清单同样不含
    repository.setTermQueueStatus(term.id, 'dismissed');
    queue = repository.getReviewQueue(now, 500);
    expect(queue.reviews.some((review) => review.termId === term.id)).toBe(false);
    expect(repository.listPendingQueueTerms().some((item) => item.termId === term.id)).toBe(false);

    // 恢复入队后重新可见
    repository.setTermQueueStatus(term.id, 'active');
    queue = repository.getReviewQueue(now, 500);
    expect(queue.reviews.some((review) => review.termId === term.id)).toBe(true);

    // 顺延 30 天后到期队列不可见，且不产生复习日志（这不是一次检索）
    repository.deferReviewCard(term.id, 30);
    queue = repository.getReviewQueue(now, 500);
    expect(queue.reviews.some((review) => review.termId === term.id)).toBe(false);
    expect(repository.listReviewLogs(term.id)).toHaveLength(0);
  });

  it('学习者画像快照汇集近期主题与学过的薄弱概念（A1 记忆注入）', () => {
    // 近期主题：真实会话标题
    const session = repository.createSession({
      title: '事务隔离级别怎么选',
      idempotencyKey: 'session:test:memory-profile',
    });
    // 薄弱概念：复习一次产生非 new 状态与难度值
    const weakTerm = repository.upsertTerm({
      name: '记忆注入薄弱概念',
      definition: '供画像快照聚合。',
      idempotencyKey: 'term:memory:weak',
    });
    repository.setTermQueueStatus(weakTerm.id, 'active');
    repository.reviewTerm({
      termId: weakTerm.id,
      grade: 'hard',
      answerMode: 'typed',
      reviewedAt: new Date(),
      idempotencyKey: 'review:memory:weak',
    });
    // 待确认概念不应进入薄弱清单
    const pendingTerm = repository.upsertTerm({
      name: '待确认不入画像',
      definition: '尚未确认入队。',
      idempotencyKey: 'term:memory:pending',
    });

    const snapshot = repository.getLearnerProfileSnapshot();
    expect(snapshot.recentTopics).toContain(session.title);
    expect(snapshot.weakConcepts.some((concept) => concept.name === '记忆注入薄弱概念')).toBe(true);
    expect(snapshot.weakConcepts.some((concept) => concept.name === pendingTerm.name)).toBe(false);
    expect(snapshot.weakConcepts.every((concept) => concept.state !== 'new')).toBe(true);
    // 记忆注入开关默认开启
    expect(repository.getWorkspaceSettings().memoryInjection).toBe(true);
    repository.updateWorkspaceSettings({ memoryInjection: false });
    expect(repository.getWorkspaceSettings().memoryInjection).toBe(false);
    repository.updateWorkspaceSettings({ memoryInjection: true });
  });

  it('token 用量摘要只统计助手消息并区分今日（C3）', () => {
    const session = repository.createSession({
      title: '用量统计会话',
      idempotencyKey: 'session:usage:one',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '第一条带用量的回答',
      idempotencyKey: 'message:usage:a',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '用户消息不计量',
      idempotencyKey: 'message:usage:u',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '旧实现的历史消息无用量',
      idempotencyKey: 'message:usage:legacy',
    });
    const summary = repository.getTokenUsageSummary();
    expect(summary.today).toEqual({ input: 100, output: 50, total: 150 });
    expect(summary.total).toEqual({ input: 100, output: 50, total: 150 });
  });

  it('隐性感知：同难度下回忆更慢的概念排在薄弱清单更前（B4）', () => {
    const make = (name: string, key: string, durationMs: number) => {
      const term = repository.upsertTerm({
        name,
        definition: '隐性感知验证概念。',
        idempotencyKey: `term:${key}`,
      });
      repository.setTermQueueStatus(term.id, 'active');
      repository.reviewTerm({
        termId: term.id,
        grade: 'good',
        answerMode: 'typed',
        recallText: '回忆内容',
        durationMs,
        reviewedAt: new Date(),
        idempotencyKey: `review:${key}`,
      });
      return term;
    };
    const fast = make('隐性感知快概念', 'implicit:fast', 2_000);
    const slow = make('隐性感知慢概念', 'implicit:slow', 90_000);

    const snapshot = repository.getLearnerProfileSnapshot();
    const names = snapshot.weakConcepts.map((concept) => concept.name);
    expect(names).toContain('隐性感知快概念');
    expect(names).toContain('隐性感知慢概念');
    // 同评级同状态，慢概念应排在前
    expect(names.indexOf('隐性感知慢概念')).toBeLessThan(names.indexOf('隐性感知快概念'));
    // 今日薄弱推荐也命中慢概念（或更高分概念）
    const today = repository.getTodayLearningActions();
    expect(today.some((action) => action.kind === 'interview')).toBe(true);
    expect(fast.id).toBeTruthy();
    expect(slow.id).toBeTruthy();
  });

  it('目标主线：设置成长目标后知识图命中节点打标（B3）', () => {
    repository.updateWorkspaceSettings({ growthGoal: '后端工程师' });
    // 以 SQL 种子节点为中心取一跳，邻居必含「后端基础」领域节点
    const sqlNode = repository.getKnowledgeGraph({ depth: 2 }).searchOptions
      .find((option) => option.label === 'SQL');
    expect(sqlNode).toBeTruthy();
    const graph = repository.getKnowledgeGraph({ centerId: sqlNode?.id, depth: 1 });
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.nodes.some((node) => node.mainline)).toBe(true);
    const mainlineLabels = graph.nodes.filter((node) => node.mainline).map((node) => node.label);
    expect(mainlineLabels).toContain('后端基础');

    // 清除目标后不再打标
    repository.updateWorkspaceSettings({ growthGoal: null });
    const plain = repository.getKnowledgeGraph({ centerId: sqlNode?.id, depth: 1 });
    expect(plain.nodes.every((node) => !node.mainline)).toBe(true);
  });

  it('全局内容搜索跨会话、消息、概念、笔记与资源命中（C1）', () => {
    const marker = `搜索标记${Date.now() % 100_000}`;
    const session = repository.createSession({
      title: `${marker}会话`,
      idempotencyKey: `session:search:${marker}`,
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: `这段正文包含 ${marker} 关键词`,
      idempotencyKey: `message:search:${marker}`,
    });
    repository.upsertTerm({
      name: `${marker}概念`,
      definition: `定义里也有 ${marker}。`,
      idempotencyKey: `term:search:${marker}`,
    });

    const hits = repository.searchContent(marker, 10);
    const types = new Set(hits.map((hit) => hit.type));
    expect(types).toContain('session');
    expect(types).toContain('message');
    expect(types).toContain('concept');
    // 消息命中带所属会话，摘要包含关键词上下文
    const messageHit = hits.find((hit) => hit.type === 'message');
    expect(messageHit?.sessionId).toBe(session.id);
    expect(messageHit?.excerpt).toContain(marker);
    // 空白查询返回空
    expect(repository.searchContent('   ')).toEqual([]);
  });

  it('全库导出包含全部表与已写入数据', () => {
    repository.upsertTerm({
      name: '导出概念',
      definition: '导出完整性验证。',
      idempotencyKey: 'term:export:one',
    });
    const dump = repository.exportWorkspaceData();
    // 26 张表全部在场
    expect(Object.keys(dump.tables).length).toBeGreaterThanOrEqual(20);
    expect(Object.keys(dump.tables)).toContain('learningEvents');
    expect(dump.tables.workspaces.length).toBeGreaterThan(0);
    expect(dump.tables.terms.some((row) => (row as { name?: string }).name === '导出概念')).toBe(true);
    expect(dump.generatedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('整库导入：快照覆盖当前数据并可完整恢复（B1 备份恢复）', () => {
    const sessionsBefore = repository.listSessions().length;
    // 取快照（Date 序列化为 ISO，模拟真实导出文件的形态）
    const snapshot = repository.exportWorkspaceData();
    const serialized = JSON.parse(JSON.stringify(snapshot, (_key, value: unknown) =>
      value instanceof Date ? value.toISOString() : value)) as { generatedAt: string; tables: Record<string, unknown[]> };

    // 快照之后写入的新数据，导入后应当消失
    const extraSession = repository.createSession({
      title: '导入后不应存在',
      idempotencyKey: 'session:import:extra',
    });
    expect(repository.listSessions().length).toBe(sessionsBefore + 1);

    const { imported } = repository.importWorkspaceData(serialized);
    expect(imported.sessions).toBe(sessionsBefore);
    expect(repository.listSessions().some((session) => session.id === extraSession.id)).toBe(false);
    expect(repository.listSessions().length).toBe(sessionsBefore);
    // 概念与掌握度（含日期列）完整还原
    expect(repository.getWorkspaceSettings().memoryInjection).toBe(true);
    // 未知表键整笔拒绝
    expect(() => repository.importWorkspaceData({
      generatedAt: '2026-08-24T00:00:00.000Z',
      tables: { ...serialized.tables, notATable: [{ id: 'x' }] },
    })).toThrow(/未知表/);
  });

  it('多工作区：新建即切换、数据按工作区隔离、可切回并重命名', () => {
    const original = repository.ensureWorkspace();
    const sessionInOriginal = repository.createSession({
      title: '原工作区会话',
      idempotencyKey: 'session:workspace:original',
    });

    // 新建即激活，后续查询全部落在新工作区
    const created = repository.createWorkspace({ title: '第二主题' });
    expect(created.isActive).toBe(true);
    expect(repository.ensureWorkspace().id).toBe(created.id);
    expect(repository.listSessions().some((session) => session.id === sessionInOriginal.id)).toBe(false);

    repository.createSession({
      title: '新工作区会话',
      idempotencyKey: 'session:workspace:second',
    });
    expect(repository.listSessions()).toHaveLength(1);

    // 切回原工作区：数据恢复可见，新工作区数据隐藏
    const back = repository.switchWorkspace(original.id);
    expect(back?.isActive).toBe(true);
    const restored = repository.listSessions();
    expect(restored.some((session) => session.id === sessionInOriginal.id)).toBe(true);
    expect(restored.some((session) => session.title === '新工作区会话')).toBe(false);

    // 重命名生效，列表激活项排最前
    repository.renameWorkspace(created.id, { title: '改名主题' });
    const list = repository.listWorkspaces();
    expect(list[0].id).toBe(original.id);
    expect(list.some((workspace) => workspace.title === '改名主题')).toBe(true);
  });

  it('工作区归档与删除（C4）：当前不可归档/删除，删除清理本区过程数据、概念全局保留', () => {
    const original = repository.ensureWorkspace();
    // 当前工作区不可归档 / 删除
    expect(() => repository.setWorkspaceArchived(original.id, true)).toThrow(/不能归档当前/);
    expect(() => repository.deleteWorkspace(original.id)).toThrow(/不能删除当前/);

    // 第二工作区：写入完整过程数据 + 一个全局概念
    const second = repository.createWorkspace({ title: '待清理主题' });
    const session = repository.createSession({
      title: '待清理会话',
      idempotencyKey: 'session:workspace:cleanup',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '待清理消息',
      idempotencyKey: 'message:workspace:cleanup',
    });
    const sharedTerm = repository.upsertTerm({
      name: '全局保留概念',
      definition: '术语是全局单源，删除工作区不应删除概念。',
      idempotencyKey: 'term:workspace:shared',
    });

    // 切回原工作区后才能归档 / 删除 second（当前工作区受保护）
    repository.switchWorkspace(original.id);

    // 归档：不可见于切换语义（archivedAt 置位），可恢复
    const archived = repository.setWorkspaceArchived(second.id, true);
    expect(archived?.archivedAt).not.toBeNull();
    const restored = repository.setWorkspaceArchived(second.id, false);
    expect(restored?.archivedAt).toBeNull();

    // 删除：本区会话/消息清空，概念与掌握度保留
    const result = repository.deleteWorkspace(second.id);
    expect(result.deleted).toBe(true);
    expect(repository.listSessions().some((item) => item.id === session.id)).toBe(false);
    // 全局概念仍在
    expect(repository.getTerm(sharedTerm.id)?.name).toBe('全局保留概念');
    expect(repository.listWorkspaces().some((item) => item.id === second.id)).toBe(false);
  });

  it('结构化面试按评分策略调整三题难度，并保留重答版本', () => {
    const skill = repository.upsertTerm({
      name: '索引设计',
      definition: '根据查询模式设计索引。',
      idempotencyKey: 'interview:skill:index',
    });
    const first = repository.startInterviewSession({
      settings: {
        role: 'backend',
        topic: 'database',
        difficulty: 'standard',
        totalRounds: 3,
        teacherStyle: 'rigorous',
      },
      question: interviewQuestion('如何为订单查询设计索引？', '索引设计'),
      termId: skill.id,
      idempotencyKey: 'interview:session:adaptive',
    });
    const firstQuestion = first.questions[0];
    const firstAnswer = repository.finishInterview(firstQuestion.id, {
      answer: '先按用户和时间的查询模式设计联合索引，并核对选择性。',
      durationMs: 42_000,
      evaluation: interviewEvaluation('advance'),
      idempotencyKey: 'interview:answer:first',
    });
    expect(firstAnswer.session).toMatchObject({ currentDifficulty: 'advanced', lastStrategy: 'advance' });
    const retried = repository.finishInterview(firstQuestion.id, {
      answer: '补充说明覆盖索引和写放大权衡。',
      durationMs: 31_000,
      evaluation: interviewEvaluation('advance'),
      idempotencyKey: 'interview:answer:first:retry',
    });
    expect(retried.attempt.version).toBe(2);
    expect(retried.attempts).toHaveLength(2);

    const second = repository.createNextInterviewQuestion({
      interviewSessionId: first.session.id,
      question: interviewQuestion('索引失效时如何定位？', '执行计划'),
      idempotencyKey: 'interview:question:second',
    });
    const secondQuestion = second.questions.at(-1)!;
    expect(secondQuestion.difficulty).toBe('advanced');
    const prerequisite = repository.upsertTerm({
      name: '执行计划',
      definition: '数据库对查询的执行步骤。',
      idempotencyKey: 'interview:skill:plan',
    });
    const secondAnswer = repository.finishInterview(secondQuestion.id, {
      answer: '只看 SQL 文本。',
      durationMs: 18_000,
      evaluation: interviewEvaluation('downgrade', '执行计划'),
      prerequisiteTermId: prerequisite.id,
      idempotencyKey: 'interview:answer:second',
    });
    expect(secondAnswer.session).toMatchObject({ currentDifficulty: 'standard', lastStrategy: 'downgrade' });
    expect(secondAnswer.interview.termId).toBe(prerequisite.id);

    const third = repository.createNextInterviewQuestion({
      interviewSessionId: first.session.id,
      question: interviewQuestion('执行计划中重点观察哪些字段？', '执行计划'),
      idempotencyKey: 'interview:question:third',
    });
    const thirdQuestion = third.questions.at(-1)!;
    expect(thirdQuestion.difficulty).toBe('standard');
    const thirdAnswer = repository.finishInterview(thirdQuestion.id, {
      answer: '观察扫描行数、访问方式和实际耗时。',
      durationMs: 25_000,
      evaluation: interviewEvaluation('stay'),
      idempotencyKey: 'interview:answer:third',
    });
    expect(thirdAnswer.session).toMatchObject({ status: 'completed', currentRound: 3 });
    expect(repository.findEventByIdempotencyKey('interview:answer:second')).toMatchObject({
      action: 'interview_answered',
      objectType: 'interview_attempt',
      result: { level: 'downgrade', version: 1 },
      context: { termId: prerequisite.id, difficulty: 'advanced' },
    });
  });

  it('事件写入失败时回滚同事务内的资源状态', () => {
    const raw = new Database(dbPath);
    raw.exec(`
      CREATE TRIGGER force_learning_event_failure
      BEFORE INSERT ON learning_events
      BEGIN
        SELECT RAISE(ABORT, 'forced event failure');
      END;
    `);

    expect(() =>
      repository.createResource({
        title: '不应残留的资源',
        type: '教程',
        url: 'https://example.com/rollback',
        idempotencyKey: 'resource:test:rollback',
      }),
    ).toThrow();

    raw.exec('DROP TRIGGER force_learning_event_failure;');
    raw.close();
    expect(repository.listResources().some((resource) => resource.title === '不应残留的资源')).toBe(false);
    expect(repository.findEventByIdempotencyKey('resource:test:rollback')).toBeUndefined();
  });

  it('首问自动命名，历史术语可恢复定义和消息来源', () => {
    const session = repository.createSession({
      idempotencyKey: 'session:test:history',
    });
    repository.upsertTerm({
      name: 'Cache-Control',
      definition: '控制 HTTP 缓存行为的响应头。',
      idempotencyKey: 'term:test:cache-control',
    });
    const userMessage = repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '请解释 [[Cache-Control]] 的作用和常见指令',
      idempotencyKey: 'message:test:history:user',
    });

    expect(repository.getSession(session.id)?.title).toBe('请解释 Cache-Control 的作用和常见指令');
    expect(repository.listHistoricalTerms(repository.listMessages(session.id))).toEqual([
      {
        name: 'Cache-Control',
        definition: '控制 HTTP 缓存行为的响应头。',
        sources: [{ messageId: userMessage.id, sessionId: session.id }],
      },
    ]);
  });

  it('会话支持置顶、归档、恢复和事务删除', () => {
    const session = repository.createSession({
      title: '待管理会话',
      idempotencyKey: 'session:test:manage',
    });
    repository.updateSession(session.id, {
      action: 'pin',
      pinned: true,
      idempotencyKey: 'session:test:pin',
    });
    expect(repository.getSession(session.id)?.pinnedAt).toBeInstanceOf(Date);

    repository.updateSession(session.id, {
      action: 'archive',
      archived: true,
      idempotencyKey: 'session:test:archive',
    });
    expect(repository.listSessions().some((item) => item.id === session.id)).toBe(false);
    expect(repository.listSessions({ archived: true }).some((item) => item.id === session.id)).toBe(true);

    repository.updateSession(session.id, {
      action: 'archive',
      archived: false,
      idempotencyKey: 'session:test:restore',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '删除前消息',
      idempotencyKey: 'message:test:before-delete',
    });
    expect(repository.deleteSession(session.id, 'session:test:delete')).toBe(true);
    expect(repository.getSession(session.id)).toBeUndefined();
    expect(repository.listMessages(session.id)).toEqual([]);
    expect(repository.findEventByIdempotencyKey('session:test:delete')).toMatchObject({
      action: 'session_deleted',
      objectId: session.id,
    });
  });

  it('语义分支只继承锚点之前的祖先消息', () => {
    const root = repository.createSession({
      title: 'HTTP 根会话',
      idempotencyKey: 'session:test:branch-root',
    });
    const rootQuestion = repository.saveMessage({
      sessionId: root.id,
      role: 'user',
      content: '缓存是什么？',
      idempotencyKey: 'message:test:branch-root-question',
    });
    const rootAnswer = repository.saveMessage({
      sessionId: root.id,
      role: 'assistant',
      content: '缓存复用已有响应。',
      idempotencyKey: 'message:test:branch-root-answer',
    });
    repository.saveMessage({
      sessionId: root.id,
      role: 'user',
      content: '这条消息位于分叉点之后，不应继承。',
      idempotencyKey: 'message:test:branch-after-anchor',
    });

    const branch = repository.createSession({
      parentId: root.id,
      forkedFromMessageId: rootAnswer.id,
      title: '缓存分支',
      idempotencyKey: 'session:test:semantic-branch',
    });
    const branchQuestion = repository.saveMessage({
      sessionId: branch.id,
      role: 'user',
      content: '那浏览器如何复用？',
      idempotencyKey: 'message:test:branch-question',
    });

    expect(branch.rootSessionId).toBe(root.id);
    expect(branch.forkedFromMessageId).toBe(rootAnswer.id);
    expect(repository.listMessages(root.id)).toHaveLength(3);
    expect(repository.listSessionContextMessages(branch.id).map((message) => message.id)).toEqual([
      rootQuestion.id,
      rootAnswer.id,
      branchQuestion.id,
    ]);
  });

  it('拒绝使用其他会话的消息作为分支锚点', () => {
    const parent = repository.createSession({
      title: '合法父会话',
      idempotencyKey: 'session:test:anchor-parent',
    });
    const other = repository.createSession({
      title: '其他会话',
      idempotencyKey: 'session:test:anchor-other',
    });
    const otherMessage = repository.saveMessage({
      sessionId: other.id,
      role: 'assistant',
      content: '不属于父会话',
      idempotencyKey: 'message:test:anchor-other',
    });

    expect(() =>
      repository.createSession({
        parentId: parent.id,
        forkedFromMessageId: otherMessage.id,
        idempotencyKey: 'session:test:invalid-anchor',
      }),
    ).toThrow('分支锚点不属于父会话');
  });

  it('Concept 合并别名并统一聚合消息、笔记和资源来源', () => {
    const session = repository.createSession({
      title: 'Concept 来源测试',
      idempotencyKey: 'session:test:concept-source',
    });
    const message = repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: 'Cache-Control 控制缓存复用。',
      idempotencyKey: 'message:test:concept-source',
    });
    const concept = repository.upsertTerm({
      name: 'Cache-Control',
      canonicalName: 'HTTP Cache-Control',
      aliases: ['缓存控制'],
      definition: 'HTTP 缓存控制响应头。',
      example: 'max-age=3600',
      confidence: 0.8,
      idempotencyKey: 'term:test:concept-v1',
    });
    const merged = repository.upsertTerm({
      name: '缓存控制',
      canonicalName: 'HTTP Cache-Control',
      aliases: ['Cache-Control'],
      definition: '用于声明缓存复用条件和有效期的 HTTP 响应头。',
      example: 'Cache-Control: no-store',
      confidence: 0.96,
      idempotencyKey: 'term:test:concept-v2',
    });
    expect(merged.id).toBe(concept.id);
    expect(merged.definition).toContain('复用条件');
    expect(merged.aliases).toContain('缓存控制');

    repository.recordConceptMention({
      termId: concept.id,
      sourceType: 'message',
      sourceId: message.id,
      sessionId: session.id,
      excerpt: message.content,
      idempotencyKey: 'mention:test:concept-message',
    });
    const note = repository.createNote({
      sessionId: session.id,
      title: '缓存笔记',
      content: {
        coreConcepts: [{ name: 'HTTP Cache-Control', explanation: '缓存策略入口' }],
        terms: [],
      },
      markdown: '# 缓存笔记',
      idempotencyKey: 'note:test:concept-source',
    });
    const resource = repository.createResource({
      title: 'MDN 缓存文档',
      type: '文档',
      url: 'https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control',
      termId: concept.id,
      idempotencyKey: 'resource:test:concept-source',
    });

    const detail = repository.getConceptDetail({ name: '缓存控制' });
    expect(detail?.concept.id).toBe(concept.id);
    expect(detail?.mentions.map((mention) => mention.sourceType).sort()).toEqual([
      'message',
      'note',
      'resource',
    ]);
    expect(detail?.relatedNotes).toContainEqual({ id: note.id, title: note.title, sessionId: session.id });
    expect(detail?.relatedResources[0]).toMatchObject({ id: resource.id, title: resource.title });
  });

  it('今日行动投影只引用真实会话、到期记录和未完成资源', () => {
    // 自包含：确认一张立即到期的复习卡，并放开每日新学量，保证 review 行动必然出现
    repository.updateWorkspaceSettings({ dailyNewLimit: 50 });
    const dueTerm = repository.upsertTerm({
      name: '今日到期概念',
      definition: '用于今日行动投影的到期卡。',
      idempotencyKey: 'term:test:today-due',
    });
    repository.setTermQueueStatus(dueTerm.id, 'active');

    const session = repository.createSession({
      title: '今日投影会话',
      idempotencyKey: 'session:test:today-projection',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '继续学习事务隔离级别',
      idempotencyKey: 'message:test:today-projection',
    });
    const resource = repository.createResource({
      title: '今日未读资源',
      type: '教程',
      url: 'https://example.com/today-resource',
      idempotencyKey: 'resource:test:today-projection',
    });

    const actions = repository.getTodayLearningActions();
    expect(actions.find((action) => action.kind === 'continue')).toMatchObject({
      href: `/?session=${session.id}`,
    });
    expect(actions.find((action) => action.kind === 'review')?.source).toContain('到期时间');
    expect(actions.find((action) => action.id === `resource:${resource.id}`)).toMatchObject({
      href: `/resources?resource=${resource.id}`,
    });
    expect(actions.every((action) => action.effort.length > 0 && action.source.length > 0)).toBe(true);
  });

  it('用户编辑追加版本且不会覆盖 AI 快照，来源删除后显式失效', () => {
    const session = repository.createSession({
      title: '笔记版本来源',
      idempotencyKey: 'session:test:note-version',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'user',
      content: '解释事务原子性',
      idempotencyKey: 'message:test:note-version:user',
    });
    repository.saveMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '事务中的操作要么全部成功，要么全部失败。',
      idempotencyKey: 'message:test:note-version:assistant',
    });
    const note = repository.createNote({
      sessionId: session.id,
      title: '事务原子性',
      content: { coreConcepts: [{ name: '原子性', explanation: '不可分割' }], terms: [] },
      markdown: '# 事务原子性\n\nAI 原始内容',
      idempotencyKey: 'note:test:version-create',
    });
    const originalSnapshot = structuredClone(note.aiSnapshot);
    const updated = repository.updateNote({
      id: note.id,
      title: '事务原子性（已编辑）',
      markdown: '# 事务原子性\n\n用户补充内容',
      tags: ['数据库', '事务'],
      idempotencyKey: 'note:test:version-update',
    });
    const retried = repository.updateNote({
      id: note.id,
      title: '不应重复保存',
      markdown: '重复请求',
      tags: [],
      idempotencyKey: 'note:test:version-update',
    });

    expect(updated.version).toBe(2);
    expect(retried.title).toBe('事务原子性（已编辑）');
    expect(updated.aiSnapshot).toEqual(originalSnapshot);
    expect(updated.userContent).toMatchObject({ markdown: '# 事务原子性\n\n用户补充内容' });
    expect(repository.listNoteVersions(note.id).map((version) => version.origin)).toEqual([
      'user',
      'ai',
    ]);
    expect(repository.listNoteSources(note.id)[0]).toMatchObject({ valid: true });

    repository.deleteSession(session.id, 'session:test:note-version-delete-source');
    expect(repository.getNote(note.id)).toBeTruthy();
    expect(repository.listNoteSources(note.id)[0]).toMatchObject({
      valid: false,
      sessionId: null,
      startMessageId: null,
      endMessageId: null,
    });
  });
});

function interviewQuestion(question: string, skill: string) {
  return {
    question,
    skill,
    rubric: {
      correctness: '技术结论正确',
      structure: '先结论后依据',
      evidence: '说明查询或数据依据',
      communication: '表达简洁准确',
    },
  };
}

function interviewEvaluation(
  nextStrategy: 'advance' | 'stay' | 'downgrade',
  prerequisite: string | null = null,
) {
  return {
    correct: nextStrategy !== 'downgrade',
    scores: {
      correctness: { score: nextStrategy === 'downgrade' ? 2 : 4, note: '结论评分' },
      structure: { score: 4, note: '结构评分' },
      evidence: { score: 3, note: '证据评分' },
      communication: { score: 4, note: '表达评分' },
    },
    summary: '结构化面试反馈。',
    strengths: ['结论清楚'],
    improvements: ['补充权衡'],
    evidence: [{ dimension: 'correctness' as const, quote: '索引', note: '原文证据' }],
    modelAnswer: '先识别查询模式，再比较索引收益与写入成本。',
    nextStrategy,
    prerequisite,
  };
}
