export interface Assistant {
  id: string;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  elevenlabs_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantStats {
  total_calls: number;
  successful_calls: number;
  success_rate_pct: number | null;
  avg_duration_sec: number | null;
  total_credits: number;
  period_days: number;
}

export interface Session {
  session_id: string;
  assistant_id: string;
  status: 'active' | 'completed' | 'error' | 'timeout';
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  summary: string | null;
  call_successful: 'success' | 'failure' | 'unknown' | null;
  cost_credits: number | null;
  metadata: Record<string, unknown>;
  has_audio: boolean;
  channel_type: string;
  caller_number: string | null;
  called_number: string | null;
}

export interface SessionStartResult {
  session_id: string;
  status: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SessionCosts {
  cost_credits: number | null;
  duration_sec: number | null;
  charging: Record<string, unknown> | null;
  cost_per_minute_credits: number | null;
  call_charge_pct: number | null;
  llm_charge_pct: number | null;
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
  folder: string | null;
  original_url: string | null;
  file_path: string | null;
  file_ext: string | null;
  file_size_bytes: number | null;
  chunks_count: number | null;
  auto_refresh: boolean;
  usage_mode: 'prompt' | 'auto';
  elevenlabs_document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRagStatus {
  status: string;
  progress_percentage: number;
  indexes: Record<string, unknown>[];
  is_terminal: boolean;
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
  event_type: string;
  status_code: number | null;
  response_body: string | null;
  error: string | null;
  ok: boolean;
  delivered_at: string | null;
  created_at: string;
}

export interface WebhookTestResult {
  ok: boolean;
  status_code: number | null;
  error: string | null;
}

export interface AutoRechargeInfo {
  enabled: boolean;
  threshold_rub: number | null;
  amount_rub: number | null;
}

export interface UsageDailyItem {
  date: string;
  minutes: number;
  cost_rub: number;
}

export interface UsageByAssistantItem {
  assistant_id: string;
  assistant_name: string;
  minutes: number;
  cost_rub: number;
  percentage: number;
}

export interface BillingInfo {
  balance_rub: number;
  total_spent_rub: number;
  total_minutes: number;
  month_minutes: number;
  month_spent_rub: number;
  low_balance: boolean;
  topup_min_rub: number;
  topup_max_rub: number;
  topup_presets: number[];
  credits_to_rub: number;
  auto_recharge: AutoRechargeInfo;
  usage_daily: UsageDailyItem[];
  usage_by_assistant: UsageByAssistantItem[];
  transactions: Transaction[];
  own_keys: Record<string, boolean>;
}

export interface Transaction {
  id: string;
  type: string;
  amount_rub: number;
  balance_after_rub: number;
  description: string | null;
  session_id: string | null;
  created_at: string;
}

