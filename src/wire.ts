/**
 * Wire protocol types for /v1/voice/ws/{session_id}.
 *
 * SOURCE OF TRUTH: server/src/models/wire/browser_ws.py. Keep this file in
 * sync manually when backend types change.
 */

// ── Client → Server ─────────────────────────────────────────────────────────

export interface SessionStartMsg {
  type: 'session.start';
  dynamic_variables?: Record<string, string>;
}

export interface SessionStopMsg {
  type: 'session.stop';
}

export interface AudioInputMsg {
  type: 'audio.input';
  /** base64-encoded PCM16 little-endian */
  data: string;
  sample_rate: number;
}

export interface TextInputMsg {
  type: 'text.input';
  text: string;
}

export interface ToolResultMsg {
  type: 'tool.result';
  call_id: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface InterruptMsg {
  type: 'interrupt';
}

export interface PingMsg {
  type: 'ping';
}

export type ClientMessage =
  | SessionStartMsg
  | SessionStopMsg
  | AudioInputMsg
  | TextInputMsg
  | ToolResultMsg
  | InterruptMsg
  | PingMsg;

// ── Server → Client ─────────────────────────────────────────────────────────

export interface SessionStartedMsg {
  type: 'session.started';
  session_id: string;
  audio_in_rate: number;
  audio_out_rate: number;
  audio_format: 'json_b64';
}

export interface TurnStartedMsg {
  type: 'turn.started';
  turn_index: number;
}

export interface TurnEndedMsg {
  type: 'turn.ended';
  turn_index: number;
  interrupted: boolean;
  benchmarks: Record<string, unknown>;
}

export interface SpeechStartedMsg {
  type: 'speech.started';
  turn_index: number;
}

export interface SpeechEndedMsg {
  type: 'speech.ended';
  turn_index: number;
}

export interface STTPartialMsg {
  type: 'stt.partial';
  turn_index: number;
  text: string;
}

export interface STTFinalMsg {
  type: 'stt.final';
  turn_index: number;
  text: string;
}

export interface LLMDeltaMsg {
  type: 'llm.delta';
  turn_index: number;
  text: string;
}

export interface LLMDoneMsg {
  type: 'llm.done';
  turn_index: number;
  text: string;
  tokens_in: number;
  tokens_out: number;
}

export interface AudioOutputMsg {
  type: 'audio.output';
  turn_index: number;
  /** base64-encoded PCM16 little-endian */
  data: string;
  sample_rate: number;
}

export interface ToolCallMsg {
  type: 'tool.call';
  call_id: string;
  turn_index: number;
  name: string;
  arguments: Record<string, unknown>;
}

export interface InterruptedMsg {
  type: 'interrupted';
  turn_index: number;
  reason: string;
}

export interface SessionEndedMsg {
  type: 'session.ended';
  reason: string;
  duration_sec: number;
  summary?: string;
}

export type ErrorCode =
  | 'AUTH_INVALID' | 'AUTH_EXPIRED' | 'QUOTA_EXCEEDED' | 'ASSISTANT_NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE' | 'SESSION_EXPIRED' | 'SESSION_TIMEOUT'
  | 'TOOL_TIMEOUT' | 'INTERNAL_ERROR';

export interface ErrorMsg {
  type: 'error';
  code: ErrorCode;
  message: string;
  turn_index?: number;
}

export interface PongMsg {
  type: 'pong';
}

export type ServerMessage =
  | SessionStartedMsg | TurnStartedMsg | TurnEndedMsg
  | SpeechStartedMsg | SpeechEndedMsg
  | STTPartialMsg | STTFinalMsg
  | LLMDeltaMsg | LLMDoneMsg
  | AudioOutputMsg | ToolCallMsg
  | InterruptedMsg | SessionEndedMsg | ErrorMsg | PongMsg;

// ── Parsing + guards ────────────────────────────────────────────────────────

export const KNOWN_TYPES = new Set([
  'session.started', 'turn.started', 'turn.ended',
  'speech.started', 'speech.ended',
  'stt.partial', 'stt.final',
  'llm.delta', 'llm.done',
  'audio.output', 'tool.call',
  'interrupted', 'session.ended', 'error', 'pong',
]);

/**
 * Parse a raw JSON text frame into a ServerMessage. Returns null on
 * malformed JSON or unknown discriminator (forward-compat: ignore unknown
 * events).
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== 'string' || !KNOWN_TYPES.has(type)) return null;
  return parsed as ServerMessage;
}

export function isErrorMessage(msg: ServerMessage): msg is ErrorMsg {
  return msg.type === 'error';
}

export function isAudioOutput(msg: ServerMessage): msg is AudioOutputMsg {
  return msg.type === 'audio.output';
}

export function isTurnEnded(msg: ServerMessage): msg is TurnEndedMsg {
  return msg.type === 'turn.ended';
}
