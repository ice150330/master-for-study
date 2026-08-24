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

    // 提高上限后恢复可见，摘要与队列保持一致
    repository.updateWorkspaceSettings({ dailyNewLimit: newBefore + 1 });
    const restored = repository.getReviewQueue(now, 500);
    expect(restored.reviews.some((review) => review.termId === extra.id)).toBe(true);
    expect(restored.summary.due).toBe(restored.reviews.length);
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
