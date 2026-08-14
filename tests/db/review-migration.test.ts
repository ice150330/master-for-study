import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDir: string;
let db: Database.Database;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mentor-review-migration-'));
  db = new Database(path.join(tempDir, 'migration.db'));
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE workspaces (id text PRIMARY KEY, title text NOT NULL, goal text, created_at integer NOT NULL);
    CREATE TABLE terms (id text PRIMARY KEY, name text NOT NULL, definition text NOT NULL, created_at integer NOT NULL);
    CREATE TABLE term_masteries (
      id text PRIMARY KEY,
      term_id text NOT NULL UNIQUE REFERENCES terms(id),
      state text NOT NULL,
      stability real,
      difficulty real,
      due_at integer,
      last_reviewed_at integer
    );
    INSERT INTO workspaces VALUES ('workspace-1', '旧工作区', NULL, 1700000000000);
    INSERT INTO terms VALUES ('term-1', '旧术语', '迁移前已经存在。', 1700000000000);
    INSERT INTO term_masteries VALUES (
      'mastery-1', 'term-1', 'reviewing', 12.4, 5.2, 1701000000000, 1700000000000
    );
  `);
  runMigration('0008_rare_tiger_shark.sql');
  runMigration('0009_previous_wallow.sql');
});

afterAll(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runMigration(name: string) {
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'drizzle', name), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint')) {
    if (statement.trim()) db.exec(statement);
  }
}

describe('正式 FSRS 数据迁移', () => {
  it('把旧掌握度回填为完整 ReviewCard', () => {
    const card = db.prepare('SELECT * FROM review_cards WHERE term_id = ?').get('term-1') as Record<string, unknown>;
    expect(card).toMatchObject({
      workspace_id: 'workspace-1',
      state: 'reviewing',
      stability: 12.4,
      difficulty: 5.2,
      scheduled_days: 12,
      reps: 1,
      lapses: 0,
      due_at: 1701000000000,
      last_review_at: 1700000000000,
    });
  });

  it('建立到期队列与日志回放索引', () => {
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'review_%_idx'")
      .all()
      .map((row) => (row as { name: string }).name);
    expect(indexes).toEqual(expect.arrayContaining([
      'review_cards_due_at_idx',
      'review_logs_card_review_idx',
      'review_logs_term_review_idx',
    ]));
  });
});
