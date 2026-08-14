import {
  createResource,
  listResources,
  updateResourceStatus,
  type ResourceStatus,
  type ResourceType,
} from '@/lib/db';

/**
 * 资源库接口。
 *
 * GET    /api/resources —— 列出全部资源
 * POST   /api/resources —— 新增资源 { title, type, url, termId?, note? }
 * PATCH  /api/resources —— 更新状态 { id, status }
 */

export async function GET() {
  const resources = listResources();
  return Response.json({ resources });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title?: string;
    type?: ResourceType;
    url?: string;
    termId?: string | null;
    note?: string | null;
  };

  if (!body.title?.trim() || !body.type || !body.url?.trim()) {
    return Response.json({ error: '标题、类型、链接为必填' }, { status: 400 });
  }

  const resource = createResource({
    title: body.title.trim(),
    type: body.type,
    url: body.url.trim(),
    termId: body.termId ?? null,
    note: body.note ?? null,
  });
  return Response.json({ resource }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { id?: string; status?: ResourceStatus };

  if (!body.id || !body.status) {
    return Response.json({ error: '缺少 id 或 status' }, { status: 400 });
  }

  updateResourceStatus(body.id, body.status);
  return Response.json({ ok: true });
}
