import { exportWorkspaceData } from '@/lib/db';
import { withApiErrors } from '@/lib/validation/api';

/**
 * 全量数据导出接口：JSON 附件下载，用于本地备份与迁移（蓝图 §1 私有原则）。
 * 导出不是学习行为，不写事件流。
 */

export async function GET() {
  return withApiErrors(() => {
    const payload = exportWorkspaceData();
    const json = JSON.stringify(
      payload,
      // Date → ISO 字符串，保证导出文件可长期保存、跨机器可读
      (_key, value: unknown) => (value instanceof Date ? value.toISOString() : value),
    );
    const date = payload.generatedAt.toISOString().slice(0, 10);
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="mentor-export-${date}.json"`,
      },
    });
  });
}
