import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit 配置：SQLite 方言，schema 位于 src/lib/db/schema.ts，
 * 迁移文件输出到 drizzle/。
 */
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/mentor.db',
  },
});
