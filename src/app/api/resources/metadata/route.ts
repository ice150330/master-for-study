import { fetchResourceMetadata } from '@/lib/resources/metadata';
import { DomainError, parseJson, withApiErrors } from '@/lib/validation/api';
import { resourceMetadataSchema } from '@/lib/validation/schemas';

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const parsed = await parseJson(req, resourceMetadataSchema);
    if (!parsed.success) return parsed.response;
    try {
      return Response.json({ metadata: await fetchResourceMetadata(parsed.data.url) });
    } catch (error) {
      throw new DomainError(
        'RESOURCE_METADATA_FAILED',
        error instanceof Error ? error.message : '无法读取网页元数据',
        422,
      );
    }
  });
}
