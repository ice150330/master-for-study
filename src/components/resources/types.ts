import type { ResourceStatusValue, ResourceTypeValue } from '@/lib/resources/types';

export type ResourceConceptDto = { id: string; name: string };

export type ResourceHighlightDto = {
  id: string;
  resourceId: string;
  excerpt: string;
  note: string | null;
  locator: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type ResourceDto = {
  id: string;
  workspaceId: string;
  termId: string | null;
  title: string;
  type: ResourceTypeValue;
  url: string;
  canonicalUrl: string | null;
  siteName: string | null;
  author: string | null;
  description: string | null;
  faviconUrl: string | null;
  status: ResourceStatusValue;
  progress: number;
  tags: string[];
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
  concepts: ResourceConceptDto[];
  highlights: ResourceHighlightDto[];
};

export type ResourceMetadataDto = Pick<
  ResourceDto,
  'title' | 'canonicalUrl' | 'siteName' | 'author' | 'description' | 'faviconUrl' | 'type'
>;

export type ResourceFormValue = {
  title: string;
  type: ResourceDto['type'];
  conceptIds: string[];
  tags: string[];
  note: string;
};
