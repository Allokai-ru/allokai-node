export { AlokaiClient } from './client';
export type { AlokaiClientOptions } from './client';

export { AlokaiError, AuthError, NotFoundError, RateLimitError, ValidationError } from './errors';

export { VoiceSession } from './voice-session';
export type { VoiceSessionCallbacks } from './voice-session';

export type {
  Assistant,
  AssistantStats,
  Session,
  SessionStartResult,
  TranscriptEntry,
  SessionCosts,
  Voice,
  KnowledgeSource,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
  BillingInfo,
  Transaction,
  ServerEvent,
} from './types';

export type { CreateAssistantOptions, UpdateAssistantOptions, ListAssistantsOptions } from './resources/assistants';
export type { StartSessionOptions, ListSessionsOptions } from './resources/sessions';
export type { CreateWebhookOptions, UpdateWebhookOptions } from './resources/webhooks';
export type { AutoRechargeOptions } from './resources/billing';
