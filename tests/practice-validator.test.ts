import { describe, expect, it } from 'vitest';
import { SQL_CHALLENGES } from '../src/lib/practice/challenges';
import { validateChallenge } from '../src/lib/practice/validator';

const baseExecution = {
  verification: [],
  affectedRows: 0,
  durationMs: 10,
};

describe('SQL Challenge 结果验证', () => {
  it('按列名、行内容和顺序验证查询，不比较 SQL 文本', () => {
    const challenge = SQL_CHALLENGES[0];
    const execution = {
      ...baseExecution,
      results: [{ columns: ['name', 'score'], values: [['Alice', 92], ['Bob', 85]], truncated: false }],
    };
    expect(validateChallenge(challenge, execution).passed).toBe(true);
  });

  it('能区分列错误与内容错误', () => {
    const challenge = SQL_CHALLENGES[0];
    const wrongColumns = validateChallenge(challenge, {
      ...baseExecution,
      results: [{ columns: ['name'], values: [['Alice']], truncated: false }],
    });
    expect(wrongColumns).toMatchObject({ passed: false, title: '返回列不符合任务' });
    const wrongRows = validateChallenge(challenge, {
      ...baseExecution,
      results: [{ columns: ['name', 'score'], values: [['Bob', 85]], truncated: false }],
    });
    expect(wrongRows).toMatchObject({ passed: false, title: '结果内容还不正确' });
  });

  it('副作用任务同时检查修改行数和验证查询', () => {
    const challenge = SQL_CHALLENGES[2];
    const execution = {
      ...baseExecution,
      affectedRows: 1,
      results: [],
      verification: [{ columns: ['name', 'status'], values: [['Dave', 'needs_support']], truncated: false }],
    };
    expect(validateChallenge(challenge, execution)).toMatchObject({ passed: true, title: '任务完成' });
  });
});
