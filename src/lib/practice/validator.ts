import type {
  ChallengeValidation,
  SqlChallenge,
  SqlExecutionResult,
  SqlResultSet,
  SqlValue,
} from './types';

export function validateChallenge(
  challenge: SqlChallenge,
  execution: SqlExecutionResult,
): ChallengeValidation {
  const expected = challenge.expectedResult;
  if (expected.affectedRows !== undefined && execution.affectedRows !== expected.affectedRows) {
    return {
      passed: false,
      title: '修改行数不符合任务',
      details: `预期修改 ${expected.affectedRows} 行，实际修改 ${execution.affectedRows} 行。`,
    };
  }
  const result = lastResult(expected.kind === 'state' ? execution.verification : execution.results);
  if (!result) {
    return {
      passed: false,
      title: expected.kind === 'state' ? '没有得到可验证的数据状态' : '查询没有返回结果集',
      details: '检查语句类型和筛选条件后再运行。',
    };
  }
  if (!sameColumns(result.columns, expected.columns)) {
    return {
      passed: false,
      title: '返回列不符合任务',
      details: `预期 ${expected.columns.join(', ')}；实际 ${result.columns.join(', ')}。`,
    };
  }
  const actualRows = result.values.map(normalizeRow);
  const expectedRows = expected.rows.map(normalizeRow);
  const sameRows = expected.ordered
    ? JSON.stringify(actualRows) === JSON.stringify(expectedRows)
    : JSON.stringify(sortRows(actualRows)) === JSON.stringify(sortRows(expectedRows));
  if (!sameRows) {
    return {
      passed: false,
      title: '结果内容还不正确',
      details: `预期 ${expectedRows.length} 行，实际 ${actualRows.length} 行；检查过滤、分组或排序。`,
    };
  }
  return {
    passed: true,
    title: '任务完成',
    details: expected.kind === 'state'
      ? '数据副作用、修改行数和最终状态均符合要求。'
      : '列名、行数、内容与顺序均通过验证。',
  };
}

function lastResult(results: SqlResultSet[]) {
  return results.at(-1);
}

function sameColumns(actual: string[], expected: string[]) {
  return actual.length === expected.length
    && actual.every((column, index) => column.toLocaleLowerCase() === expected[index].toLocaleLowerCase());
}

function normalizeRow(row: SqlValue[]) {
  return row.map((value) => {
    if (typeof value === 'number') return Number(value.toFixed(6));
    if (value instanceof Uint8Array) return Array.from(value);
    return value;
  });
}

function sortRows(rows: Array<Array<unknown>>) {
  return [...rows].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}
