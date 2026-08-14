export const LEARNING_EVENT_ACTIONS = [
  'legacy',
  'session_created',
  'session_renamed',
  'session_pinned',
  'session_archived',
  'session_restored',
  'session_deleted',
  'message_sent',
  'term_seen',
  'note_created',
  'note_updated',
  'interview_question_created',
  'interview_answered',
  'reviewed',
  'resource_created',
  'resource_status_changed',
  'code_run',
] as const;

export const PUBLIC_EVENT_ACTIONS = ['code_run'] as const;

export const LEARNING_OBJECT_TYPES = [
  'unknown',
  'workspace',
  'session',
  'message',
  'term',
  'note',
  'interview',
  'term_mastery',
  'resource',
  'practice',
] as const;

export type LearningEventAction = (typeof LEARNING_EVENT_ACTIONS)[number];
export type LearningObjectType = (typeof LEARNING_OBJECT_TYPES)[number];

export const LEARNING_EVENT_SCHEMA_VERSION = 1;
