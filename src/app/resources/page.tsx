import { ResourcesView } from '@/components/resources/ResourcesView';
import type { ResourceDto } from '@/components/resources/types';
import { listResourceDetails, listTerms, type ResourceDetail } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>;
}) {
  const params = await searchParams;
  const resources = listResourceDetails().map(serializeResource);
  const initialResourceId = params.resource && resources.some((resource) => resource.id === params.resource)
    ? params.resource
    : null;
  return <ResourcesView initialResources={resources} initialTerms={listTerms()} initialResourceId={initialResourceId} />;
}

function serializeResource(resource: ResourceDetail): ResourceDto {
  return {
    ...resource,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt?.toISOString() ?? null,
    highlights: resource.highlights.map((highlight) => ({
      ...highlight,
      createdAt: highlight.createdAt.toISOString(),
      updatedAt: highlight.updatedAt.toISOString(),
    })),
  };
}
