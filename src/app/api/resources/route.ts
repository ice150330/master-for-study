import {
  createResource,
  deleteResource,
  findResourceByCanonicalUrl,
  getResource,
  getResourceDetail,
  getTerm,
  listResourceDetails,
  mergeResource,
  updateResource,
  updateResourceStatus,
} from '@/lib/db';
import { normalizeResourceUrl } from '@/lib/resources/url';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import {
  resourceCreateSchema,
  resourceDeleteSchema,
  resourcePatchSchema,
} from '@/lib/validation/schemas';

export async function GET() {
  return withApiErrors(() => Response.json({ resources: listResourceDetails() }));
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceCreateSchema);
    if (!parsed.success) return parsed.response;
    const conceptIds = [...new Set([
      ...parsed.data.conceptIds,
      ...(parsed.data.termId ? [parsed.data.termId] : []),
    ])];
    assertConcepts(conceptIds);
    const canonicalUrl = normalizeResourceUrl(parsed.data.canonicalUrl ?? parsed.data.url);
    const existing = findResourceByCanonicalUrl(canonicalUrl);
    if (existing) {
      const resource = mergeResource({
        id: existing.id,
        conceptIds,
        tags: parsed.data.tags,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      return Response.json({ resource, duplicate: true });
    }
    const created = createResource({ ...parsed.data, conceptIds, canonicalUrl });
    return Response.json({ resource: getResourceDetail(created.id), duplicate: false }, { status: 201 });
  });
}

export async function PATCH(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourcePatchSchema);
    if (!parsed.success) return parsed.response;
    if (!getResource(parsed.data.id)) {
      throw new DomainError('RESOURCE_NOT_FOUND', '资源不存在', 404);
    }
    if ('action' in parsed.data) {
      assertConcepts(parsed.data.conceptIds);
      return Response.json({ resource: updateResource(parsed.data) });
    }
    const updated = updateResourceStatus(parsed.data);
    return Response.json({ resource: getResourceDetail(updated.id) });
  });
}

export async function DELETE(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceDeleteSchema);
    if (!parsed.success) return parsed.response;
    if (!deleteResource(parsed.data)) {
      throw new DomainError('RESOURCE_NOT_FOUND', '资源不存在', 404);
    }
    return Response.json({ ok: true });
  });
}

function assertConcepts(conceptIds: string[]) {
  const missing = conceptIds.find((id) => !getTerm(id));
  if (missing) throw new DomainError('TERM_NOT_FOUND', '关联 Concept 不存在', 404);
}
