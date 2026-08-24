export const KNOWLEDGE_RELATIONS = ['part_of', 'prerequisite', 'related', 'applied_in'] as const;
export type KnowledgeRelation = (typeof KNOWLEDGE_RELATIONS)[number];

export const KNOWLEDGE_RELATION_LABELS: Record<KnowledgeRelation, string> = {
  part_of: '属于',
  prerequisite: '前置',
  related: '相关',
  applied_in: '应用于',
};

export type KnowledgeEvidence = {
  messages: number;
  notes: number;
  resources: number;
  interviews: number;
  practice: number;
  reviews: number;
};

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  kind: 'domain' | 'concept' | 'session';
  termId: string | null;
  description: string | null;
  masteryState: 'new' | 'learning' | 'reviewing' | 'relearning' | null;
  evidence: KnowledgeEvidence;
  href: string | null;
  forkedFromMessageId?: string | null;
  position: { x: number; y: number } | null;
  /** B3 目标主线：设置成长目标后，标签 / 描述命中的节点为 true */
  mainline?: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: KnowledgeRelation | 'branch';
  weight: number;
  evidenceType: string;
};

export type KnowledgeGraph = {
  mode: 'knowledge' | 'session';
  centerId: string | null;
  depth: 1 | 2;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  searchOptions: Array<{ id: string; label: string; kind: KnowledgeGraphNode['kind']; termId: string | null }>;
  totalNodes: number;
};
