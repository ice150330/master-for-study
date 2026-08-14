import { deepseek } from '@ai-sdk/deepseek';

/**
 * DeepSeek 双模型封装。
 *
 * 项目代号与实际模型 ID 映射：
 *   - v4-flash（默认，快）→ `deepseek-chat`
 *   - v4-pro（重任务）    → `deepseek-reasoner`
 *
 * API key 由 provider 自动读取环境变量 `DEEPSEEK_API_KEY`（见 .env，勿提交）。
 */

export const fastModel = deepseek('deepseek-chat');
export const proModel = deepseek('deepseek-reasoner');
