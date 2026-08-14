import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const phase = process.env.MENTOR_CAPTURE_PHASE ?? '12-interview-adaptive';
const captureRoot = path.resolve(process.cwd(), 'data', 'ui-captures', phase);
const now = '2026-08-15T02:35:00.000Z';
const ids = {
  session: '11111111-1111-4111-8111-111111111111',
  q1: '21111111-1111-4111-8111-111111111111',
  q2: '21111111-1111-4111-8111-222222222222',
  q3: '21111111-1111-4111-8111-333333333333',
  term1: '31111111-1111-4111-8111-111111111111',
  term2: '31111111-1111-4111-8111-222222222222',
};

test('结构化面试完成设置、追问、自适应三题与重答对比', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440x900', '阶段 12 以桌面面试工作台为主验收面');
  await fs.mkdir(captureRoot, { recursive: true });
  const payloads: Array<Record<string, unknown>> = [];
  let answerCount = 0;
  let nextCount = 0;
  const detail = makeDetail();

  await page.route('**/api/interview', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    payloads.push(body);
    if (body.action === 'start') {
      await route.fulfill({ status: 201, json: { detail } });
      return;
    }
    if (body.action === 'followup') {
      detail.questions[0].followUp = '如果订单量增长十倍，你会如何验证这个方案仍然有效？';
      await route.fulfill({ json: { interview: detail.questions[0] } });
      return;
    }
    if (body.action === 'answer') {
      answerCount += 1;
      const current = detail.questions.at(-1)!;
      const attempt = answerCount === 1
        ? makeAttempt(current.id, 1, 'stay', [3, 3, 3, 3], String(body.answer), '回答覆盖了主路径，但还缺少容量证据。')
        : answerCount === 2
          ? makeAttempt(current.id, 2, 'advance', [5, 4, 4, 4], String(body.answer), '补充了容量、索引与写入成本，达到当前难度。')
          : answerCount === 3
            ? makeAttempt(current.id, 1, 'downgrade', [2, 2, 2, 3], String(body.answer), '缺少执行计划依据，需要回到查询分析基础。', '执行计划')
            : makeAttempt(current.id, 1, 'stay', [4, 4, 3, 4], String(body.answer), '能够识别关键字段，保持标准难度继续巩固。');
      current.attempts.push(attempt);
      current.answer = attempt.answer;
      current.feedback = attempt.summary;
      current.correct = attempt.correct;
      if (answerCount === 2) detail.session.currentDifficulty = 'advanced';
      if (answerCount === 3) {
        detail.session.currentDifficulty = 'standard';
        current.termId = ids.term2;
      }
      detail.session.lastStrategy = attempt.nextStrategy;
      if (answerCount === 4) {
        detail.session.status = 'completed';
        detail.session.completedAt = now;
      }
      await route.fulfill({ json: { session: detail.session, interview: current, attempt, attempts: current.attempts } });
      return;
    }
    nextCount += 1;
    const question = nextCount === 1
      ? makeQuestion(ids.q2, 2, 'advanced', '执行计划', '索引未被使用时，你会按什么顺序定位原因？', ids.term2)
      : makeQuestion(ids.q3, 3, 'standard', '查询分析', '执行计划中哪些指标最能证明扫描成本异常？', ids.term2);
    detail.session.currentRound = question.roundIndex;
    detail.questions.push(question);
    await route.fulfill({ status: 201, json: { detail } });
  });

  await page.goto('/interview', { waitUntil: 'networkidle' });
  await expect(page.getByText('定义这次面试的目标')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-settings-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '开始面试' }).click();
  await expect(page.getByText('如何为高并发订单列表设计查询与索引？')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-answering-${testInfo.project.name}.png`), animations: 'disabled' });

  const answer = page.getByRole('textbox', { name: '面试回答' });
  await answer.fill('我会先按用户和创建时间建立联合索引，再观察真实查询的扫描行数。');
  await page.getByRole('button', { name: '请求追问' }).click();
  await expect(page.getByText(/订单量增长十倍/)).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-followup-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '提交本题' }).click();
  await expect(page.getByText('本题反馈')).toBeVisible();
  await expect(page.getByText('回答覆盖了主路径，但还缺少容量证据。')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-feedback-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '同题再答' }).click();
  await answer.fill('我会先估算容量和读写比，建立用户与时间联合索引，再用执行计划核对扫描行数，同时评估写放大。');
  await page.getByRole('button', { name: '提交本题' }).click();
  await expect(page.getByText('与第 1 次作答比较')).toBeVisible();
  await expect(page.getByText('60 → 85')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-retry-compare-${testInfo.project.name}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: '进入下一题' }).click();
  await expect(page.getByText('进阶难度')).toBeVisible();
  await answer.fill('我会先看 SQL 文本，然后尝试增加索引，但不确定如何确认优化器选择。');
  await page.getByRole('button', { name: '提交本题' }).click();
  await expect(page.getByText('核心知识有缺口，下一题回到前置层')).toBeVisible();
  await expect(page.getByRole('link', { name: '学习前置知识' })).toHaveAttribute('href', `/?concept=${ids.term2}`);

  await page.getByRole('button', { name: '进入下一题' }).click();
  await expect(page.getByText('标准难度')).toBeVisible();
  await answer.fill('我会比较估算行数与实际行数、扫描方式、循环次数和实际耗时，定位扫描成本。');
  await page.getByRole('button', { name: '提交本题' }).click();
  await page.getByRole('button', { name: '查看本场总结' }).click();
  await expect(page.getByText('本场表现轨迹')).toBeVisible();
  await page.screenshot({ path: path.join(captureRoot, `${phase}-summary-${testInfo.project.name}.png`), animations: 'disabled' });

  expect(payloads.filter((payload) => payload.action === 'answer')).toHaveLength(4);
  expect(payloads.filter((payload) => payload.action === 'next')).toHaveLength(2);
  expect(payloads[0]).toMatchObject({ action: 'start', role: 'backend', difficulty: 'standard', totalRounds: 3 });
});

function makeDetail() {
  return {
    session: {
      id: ids.session,
      workspaceId: '41111111-1111-4111-8111-111111111111',
      role: 'backend' as const,
      topic: 'system-design' as const,
      initialDifficulty: 'standard' as const,
      currentDifficulty: 'standard' as 'foundation' | 'standard' | 'advanced',
      totalRounds: 3,
      currentRound: 1,
      teacherStyle: 'guided' as const,
      status: 'active' as 'active' | 'completed',
      lastStrategy: null as 'advance' | 'stay' | 'downgrade' | null,
      idempotencyKey: 'e2e-session',
      createdAt: now,
      updatedAt: now,
      completedAt: null as string | null,
    },
    questions: [makeQuestion(ids.q1, 1, 'standard', '索引设计', '如何为高并发订单列表设计查询与索引？', ids.term1)],
  };
}

function makeQuestion(id: string, roundIndex: number, difficulty: 'foundation' | 'standard' | 'advanced', skill: string, question: string, termId: string) {
  return {
    id,
    sessionId: null,
    workspaceId: '41111111-1111-4111-8111-111111111111',
    interviewSessionId: ids.session,
    termId,
    roundIndex,
    skill,
    difficulty,
    rubric: { correctness: '技术正确', structure: '结构清楚', evidence: '有依据', communication: '表达准确' },
    followUp: null as string | null,
    question,
    answer: null as string | null,
    feedback: null as string | null,
    correct: null as boolean | null,
    createdAt: now,
    attempts: [] as ReturnType<typeof makeAttempt>[],
  };
}

function makeAttempt(
  interviewId: string,
  version: number,
  nextStrategy: 'advance' | 'stay' | 'downgrade',
  values: [number, number, number, number],
  answer: string,
  summary: string,
  prerequisite: string | null = null,
) {
  const [correctness, structure, evidence, communication] = values;
  return {
    id: `${interviewId.slice(0, 24)}${String(version).padStart(12, '0')}`,
    interviewId,
    version,
    answer,
    durationMs: 64_000,
    scores: {
      correctness: { score: correctness, note: '核心判断与题意的匹配程度。' },
      structure: { score: structure, note: '结论、依据和权衡的组织方式。' },
      evidence: { score: evidence, note: '是否给出容量、数据或执行计划依据。' },
      communication: { score: communication, note: '表达是否准确、简洁且可追问。' },
    },
    evidence: [{ dimension: 'correctness' as const, quote: answer.slice(0, 28), note: '这段原话体现了回答的核心判断。' }],
    summary,
    strengths: ['能够先给出明确结论', '回答紧扣当前工程场景'],
    improvements: ['补充可验证的量化依据', '明确说明方案边界与代价'],
    modelAnswer: '先明确容量、读写比例和查询模式，再设计索引，并使用执行计划与线上指标验证收益和代价。',
    correct: nextStrategy !== 'downgrade',
    nextStrategy,
    prerequisite,
    idempotencyKey: `e2e-attempt-${interviewId}-${version}`,
    createdAt: now,
  };
}
