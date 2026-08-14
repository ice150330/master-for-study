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
  'interview_session_started',
  'interview_question_created',
  'interview_followup_created',
  'interview_answered',
  'reviewed',
  'review_undone',
  'review_card_flagged',
  'practice_attempted',
  'resource_created',
  'resource_duplicate_merged',
  'resource_updated',
  'resource_status_changed',
  'resource_highlight_created',
  'resource_highlight_deleted',
  'resource_deleted',
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
  'interview_session',
  'interview',
  'interview_attempt',
  'term_mastery',
  'review_card',
  'review_log',
  'resource',
  'resource_highlight',
  'practice',
  'practice_attempt',
] as const;

export type LearningEventAction = (typeof LEARNING_EVENT_ACTIONS)[number];
export type LearningObjectType = (typeof LEARNING_OBJECT_TYPES)[number];

export const LEARNING_EVENT_SCHEMA_VERSION = 1;
