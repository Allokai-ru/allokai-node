export interface Assistant {
  id: string;
  name: string;
  config: Record<string, unknown>;
  elevenlabs_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantStats {
  total_sessions: number;
  completed_sessions: number;
  avg_duration_sec: number | null;
  success_rate: number | null;
  period_days: number;
}

export interface Session {
  session_id: string;
  assistant_id: string;
  status: 'active' | 'completed' | 'failed';
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  summary: string | null;
  cost_credits: number | null;
}

export interface SessionStartResult {
  session_id: string;
  status: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionCosts {
  cost_credits: number | null;
  cost_rub: number | null;
  pct_of_balance: number | null;
}

export interface Voice {
  id: string;
  voice_id: string;
  name: string;
  language: string;
  gender: string | null;
  preview_url: string | null;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'file' | 'url' | 'text';
  status: string;
  is_terminal: boolean;
  file_ext: string | null;
  usage_mode: 'prompt' | 'auto';
  created_at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  status: 'success' | 'failed';
  status_code: number | null;
  response: string | null;
  error: string | null;
  created_at: string;
}

export interface WebhookTestResult {
  ok: boolean;
  status_code: number | null;
  error: string | null;
}

export interface BillingInfo {
  balance_rub: number;
  low_balance: boolean;
  auto_recharge_enabled: boolean;
  auto_recharge_threshold_rub: number | null;
  auto_recharge_amount_rub: number | null;
  pricing_per_min_rub: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount_rub: number;
  balance_after_rub: number;
  description: string | null;
  created_at: string;
}

// WebSocket server → client message types
export type ServerEvent =
  | { type: 'status'; status: 'ready' | 'listening' | 'thinking' | 'speaking' }
  | { type: 'transcript'; role: 'user'; text: string }
  | { type: 'bot_text'; text: string; done: boolean }
  | { type: 'audio'; data: ArrayBuffer }
  | { type: 'tool_call'; tool_call_id: string; tool_name: string; parameters: Record<string, unknown> }
  | { type: 'metadata'; conversation_id: string; agent_id: string }
  | { type: 'error'; message: string }
  | { type: 'session_ended' };
