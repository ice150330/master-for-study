import { deepseek } from '@ai-sdk/deepseek';

/**
 * DeepSeek 双模型封装。
 *
 * 模型 ID（2026-08，来自 DeepSeek 官方 API 文档）：
 *   - v4-flash（默认，快）→ `deepseek-v4-flash`
 *   - v4-pro（重任务）    → `deepseek-v4-pro`
 *
 * 旧 ID `deepseek-chat` / `deepseek-reasoner` 已于 2026-07-24 下线，勿再使用。
 * API key 由 provider 自动读取环境变量 `DEEPSEEK_API_KEY`（见 .env，勿提交）。
 */

export const fastModel = deepseek('deepseek-v4-flash');
export const proModel = deepseek('deepseek-v4-pro');
