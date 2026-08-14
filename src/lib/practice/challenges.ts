import type { SqlChallenge } from './types';

const STUDENTS_SEED = `
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
INSERT INTO students (name, department, score) VALUES
  ('Alice', 'Engineering', 92),
  ('Bob', 'Product', 85),
  ('Carol', 'Design', 78),
  ('Dave', 'Engineering', 66),
  ('Eve', 'Product', 71);
`.trim();

const STUDENTS_SCHEMA = [{
  table: 'students',
  columns: 'id · name · department · score · status',
  sample: '5 行 · score 为整数 · status 默认 active',
}];

export const SQL_CHALLENGES: SqlChallenge[] = [
  {
    id: 'sql-filter-sort',
    title: '筛出高分学员',
    prompt: '返回分数不低于 80 的学员姓名和分数，并按分数从高到低排列。列名必须为 name、score。',
    difficulty: '基础',
    skills: ['WHERE', 'ORDER BY'],
    seedSql: STUDENTS_SEED,
    schema: STUDENTS_SCHEMA,
    starterSql: 'SELECT name, score\nFROM students\n',
    expectedResult: {
      kind: 'query',
      columns: ['name', 'score'],
      rows: [['Alice', 92], ['Bob', 85]],
      ordered: true,
    },
    hints: [
      '先用 WHERE 过滤 score 的下限。',
      '从高到低需要 DESC，而不是默认的 ASC。',
      '最终只选择 name 和 score 两列。',
    ],
    solution: 'SELECT name, score\nFROM students\nWHERE score >= 80\nORDER BY score DESC;',
  },
  {
    id: 'sql-group-average',
    title: '统计部门均分',
    prompt: '计算每个部门的平均分，结果列命名为 department、avg_score，平均分保留 1 位小数，并按部门名升序排列。',
    difficulty: '进阶',
    skills: ['GROUP BY', 'AVG', 'ROUND'],
    seedSql: STUDENTS_SEED,
    schema: STUDENTS_SCHEMA,
    starterSql: 'SELECT department\nFROM students\n',
    expectedResult: {
      kind: 'query',
      columns: ['department', 'avg_score'],
      rows: [['Design', 78], ['Engineering', 79], ['Product', 78]],
      ordered: true,
    },
    hints: [
      '每个部门一行，需要按 department 分组。',
      'AVG(score) 负责求平均值。',
      '用 ROUND(AVG(score), 1) 并通过 AS 设置列名。',
    ],
    solution: 'SELECT department, ROUND(AVG(score), 1) AS avg_score\nFROM students\nGROUP BY department\nORDER BY department ASC;',
  },
  {
    id: 'sql-update-risk',
    title: '标记需要辅导的学员',
    prompt: "把分数低于 70 的学员 status 更新为 'needs_support'。任务会检查数据副作用，不要求返回查询结果。",
    difficulty: '挑战',
    skills: ['UPDATE', '数据副作用'],
    seedSql: STUDENTS_SEED,
    schema: STUDENTS_SCHEMA,
    starterSql: "UPDATE students\nSET status = 'needs_support'\n",
    expectedResult: {
      kind: 'state',
      columns: ['name', 'status'],
      rows: [['Dave', 'needs_support']],
      affectedRows: 1,
      verificationSql: "SELECT name, status FROM students WHERE status = 'needs_support' ORDER BY id;",
    },
    hints: [
      '这是 UPDATE 任务，不需要 SELECT。',
      'SET 决定新值，WHERE 决定哪些行会被修改。',
      '过滤条件是 score < 70；缺少 WHERE 会修改全部行。',
    ],
    solution: "UPDATE students\nSET status = 'needs_support'\nWHERE score < 70;",
  },
];

export function getSqlChallenge(id?: string | null) {
  return SQL_CHALLENGES.find((challenge) => challenge.id === id) ?? SQL_CHALLENGES[0];
}
