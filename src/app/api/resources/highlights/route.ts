import {
  createResourceHighlight,
  deleteResourceHighlight,
  getResource,
} from '@/lib/db';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { resourceHighlightSchema } from '@/lib/validation/schemas';

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceHighlightSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.action !== 'create') {
      throw new DomainError('INVALID_ACTION', '该接口仅支持创建摘录', 400);
    }
    if (!getResource(parsed.data.resourceId)) {
      throw new DomainError('RESOURCE_NOT_FOUND', '资源不存在', 404);
    }
    return Response.json({ highlight: createResourceHighlight(parsed.data) }, { status: 201 });
  });
}

export async function DELETE(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceHighlightSchema);
    if (!parsed.success) return parsed.response;
    if (parsed.data.action !== 'delete') {
      throw new DomainError('INVALID_ACTION', '该接口仅支持删除摘录', 400);
    }
    if (!deleteResourceHighlight(parsed.data)) {
      throw new DomainError('HIGHLIGHT_NOT_FOUND', '摘录不存在', 404);
    }
    return Response.json({ ok: true });
  });
}
