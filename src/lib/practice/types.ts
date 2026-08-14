export type SqlValue = string | number | null | Uint8Array;

export type SqlResultSet = {
  columns: string[];
  values: SqlValue[][];
  truncated: boolean;
};

export type SqlExecutionResult = {
  results: SqlResultSet[];
  verification: SqlResultSet[];
  affectedRows: number;
  durationMs: number;
};

export type SqlExpectedResult = {
  kind: 'query' | 'state';
  columns: string[];
  rows: SqlValue[][];
  ordered?: boolean;
  affectedRows?: number;
  verificationSql?: string;
};

export type SqlChallenge = {
  id: string;
  title: string;
  prompt: string;
  difficulty: '基础' | '进阶' | '挑战';
  skills: string[];
  seedSql: string;
  schema: Array<{ table: string; columns: string; sample: string }>;
  starterSql: string;
  expectedResult: SqlExpectedResult;
  hints: string[];
  solution: string;
};

export type SqlWorkerRequest = {
  id: string;
  seedSql: string;
  sql: string;
  verificationSql?: string;
  rowLimit: number;
};

export type SqlWorkerResponse =
  | { id: string; ok: true; result: SqlExecutionResult }
  | { id: string; ok: false; error: string; durationMs: number };

export type ChallengeValidation = {
  passed: boolean;
  title: string;
  details: string;
};
