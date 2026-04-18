import type { HttpClient } from '../http';
import type { Session, SessionStartResult, TranscriptEntry, SessionCosts } from '../types';

export interface StartSessionOptions {
  assistantId: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  assistant_id?: string;
  status?: 'active' | 'completed' | 'error' | 'timeout';
  search?: string;
  date_from?: string;
  date_to?: string;
}

export class SessionsResource {
  constructor(private readonly http: HttpClient) {}

  start(options: StartSessionOptions): Promise<SessionStartResult> {
    const body: Record<string, unknown> = { assistant_id: options.assistantId };
    if (options.metadata) body.metadata = options.metadata;
    return this.http.post<SessionStartResult>('/sessions/start', body);
  }

  end(sessionId: string): Promise<Session> {
    return this.http.post<Session>(`/sessions/${sessionId}/end`);
  }

  get(sessionId: string): Promise<Session> {
    return this.http.get<Session>(`/sessions/${sessionId}`);
  }

  list(options: ListSessionsOptions = {}): Promise<Session[]> {
    const { limit = 50, offset = 0, assistant_id, status, search, date_from, date_to } = options;
    return this.http.get<Session[]>('/sessions', { limit, offset, assistant_id, status, search, date_from, date_to });
  }

  analysis(sessionId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/sessions/${sessionId}/analysis`);
  }

  transcript(sessionId: string): Promise<TranscriptEntry[]> {
    return this.http.get<TranscriptEntry[]>(`/sessions/${sessionId}/transcript`);
  }

  costs(sessionId: string): Promise<SessionCosts> {
    return this.http.get<SessionCosts>(`/sessions/${sessionId}/costs`);
  }

  delete(sessionId: string): Promise<void> {
    return this.http.delete(`/sessions/${sessionId}`);
  }
}
