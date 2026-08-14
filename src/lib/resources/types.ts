export const RESOURCE_TYPES = ['教程', '文档', '书籍', '视频', '博客', 'GitHub'] as const;
export const RESOURCE_STATUSES = ['想读', '在读', '已读'] as const;

export type ResourceTypeValue = (typeof RESOURCE_TYPES)[number];
export type ResourceStatusValue = (typeof RESOURCE_STATUSES)[number];

export type ResourceMetadata = {
  title: string;
  canonicalUrl: string;
  siteName: string | null;
  author: string | null;
  description: string | null;
  faviconUrl: string | null;
  type: ResourceTypeValue;
};

export const RESOURCE_STATUS_LABELS: Record<ResourceStatusValue, string> = {
  想读: '收件箱',
  在读: '在读',
  已读: '已完成',
};
