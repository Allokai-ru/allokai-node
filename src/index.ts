export { AlokaiClient } from './client';
export type { AlokaiClientOptions } from './client';

export { AlokaiError, AuthError, NotFoundError, RateLimitError, ValidationError } from './errors';

// ── Voice Client (v2 API) ─────────────────────────────────────────────────────
export { VoiceClient } from './voice-client';
export type { VoiceClientOptions, VoiceClientCallbacks } from './voice-client';

// ── Wire Protocol Types ───────────────────────────────────────────────────────
export type {
  ClientMessage,
  SessionStartMsg,
  SessionStopMsg,
  AudioInputMsg,
  TextInputMsg,
  ToolResultMsg,
  InterruptMsg,
  PingMsg,
  ServerMessage,
  SessionStartedMsg,
  TurnStartedMsg,
  TurnEndedMsg,
  SpeechStartedMsg,
  SpeechEndedMsg,
  STTPartialMsg,
  STTFinalMsg,
  LLMDeltaMsg,
  LLMDoneMsg,
  AudioOutputMsg,
  ToolCallMsg,
  InterruptedMsg,
  SessionEndedMsg,
  ErrorMsg,
  PongMsg,
  ErrorCode,
} from './wire';

export {
  parseServerMessage,
  isErrorMessage,
  isAudioOutput,
  isTurnEnded,
  KNOWN_TYPES,
} from './wire';

// ── Audio Helpers ─────────────────────────────────────────────────────────────
export { AudioPlayback, pcm16ToFloat32 } from './audio-playback';
export { buildWorkletCode, WORKLET_NAME } from './audio-worklet';

// ── REST API Types ───────────────────────────────────────────────────────────
export type {
  Assistant,
  AssistantStats,
  Session,
  SessionStartResult,
  TranscriptEntry,
  SessionCosts,
  Voice,
  KnowledgeSource,
  KnowledgeRagStatus,
  Webhook,
  WebhookDelivery,
  WebhookTestResult,
  AutoRechargeInfo,
  UsageDailyItem,
  UsageByAssistantItem,
  BillingInfo,
  Transaction,
} from './types';

export type { CreateAssistantOptions, UpdateAssistantOptions, ListAssistantsOptions } from './resources/assistants';
export type { StartSessionOptions, ListSessionsOptions } from './resources/sessions';
export type { CreateWebhookOptions, UpdateWebhookOptions } from './resources/webhooks';
export type { AutoRechargeOptions } from './resources/billing';
