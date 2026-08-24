import { importWorkspaceData } from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { importRequestSchema } from '@/lib/validation/schemas';

/**
 * 全量数据导入接口（B1 备份恢复）：接收 /api/export 的 JSON 快照，
 * 事务内整库替换——先清空再插入，未知表键整笔拒绝，失败不产生半状态。
 * 导入不是学习行为，不写事件流。
 */

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, importRequestSchema);
    if (!parsed.success) return parsed.response;
    try {
      const { imported } = importWorkspaceData(parsed.data);
      const total = Object.values(imported).reduce((sum, count) => sum + count, 0);
      return Response.json({ imported, total });
    } catch (error) {
      throw new DomainError(
        'IMPORT_INVALID',
        error instanceof Error ? error.message : '导入文件无效',
        400,
      );
    }
  });
}
