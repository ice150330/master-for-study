import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDir: string;
let dbPath: string;
let repository: typeof import('../../src/lib/db');

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-db-health-'));
  dbPath = path.join(tempDir, 'health.db');
  process.env.MENTOR_DB_PATH = dbPath;
  repository = await import('../../src/lib/db');
  repository.resetDbForTests();
});

afterAll(() => {
  repository.resetDbForTests();
  delete process.env.MENTOR_DB_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('SQLite 全迁移与健康检查', () => {
  it('全量迁移可重复执行且数据库与外键保持完整', () => {
    repository.ensureWorkspace();
    repository.resetDbForTests();

    const first = inspectDatabase();
    expect(first.quickCheck).toBe('ok');
    expect(first.foreignKeyViolations).toEqual([]);
    expect(first.migrationCount).toBe(migrationFileCount());

    repository.ensureWorkspace();
    repository.resetDbForTests();

    const second = inspectDatabase();
    expect(second).toEqual(first);
  });
});

function inspectDatabase() {
  const db = new Database(dbPath, { readonly: true });
  try {
    const quickCheck = (db.pragma('quick_check') as Array<{ quick_check: string }>)[0]?.quick_check;
    const foreignKeyViolations = db.pragma('foreign_key_check');
    const migrationCount = (db
      .prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
      .get() as { count: number }).count;
    return { quickCheck, foreignKeyViolations, migrationCount };
  } finally {
    db.close();
  }
}

function migrationFileCount() {
  return fs.readdirSync(path.resolve(process.cwd(), 'drizzle'))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .length;
}
