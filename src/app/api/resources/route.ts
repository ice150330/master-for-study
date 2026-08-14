import {
  createResource,
  getResource,
  getTerm,
  listResources,
  updateResourceStatus,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { resourceCreateSchema, resourcePatchSchema } from '@/lib/validation/schemas';

/**
 * 资源库接口。
 *
 * GET    /api/resources —— 列出全部资源
 * POST   /api/resources —— 新增资源 { title, type, url, termId?, note? }
 * PATCH  /api/resources —— 更新状态 { id, status }
 */

export async function GET() {
  return withApiErrors(() => Response.json({ resources: listResources() }));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceCreateSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.termId && !getTerm(parsed.data.termId)) {
      throw new DomainError('TERM_NOT_FOUND', '关联术语不存在', 404);
    }
    const resource = createResource(parsed.data);
    return Response.json({ resource }, { status: 201 });
  });
}

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourcePatchSchema);
    if (!parsed.success) return parsed.response;
    if (!getResource(parsed.data.id)) {
      throw new DomainError('RESOURCE_NOT_FOUND', '资源不存在', 404);
    }
    return Response.json({ resource: updateResourceStatus(parsed.data) });
  });
}
