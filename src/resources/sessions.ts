import type { HttpClient } from '../http';
import type { Session, SessionStartResult, TranscriptEntry, SessionCosts } from '../types';
import { VoiceSession, type VoiceSessionCallbacks } from '../voice-session';
import { AlokaiError } from '../errors';

const WS_READY_TIMEOUT_MS = 10_000;

export interface StartSessionOptions {
  assistantId: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  status?: 'active' | 'completed' | 'failed';
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
    const { limit = 50, offset = 0, status, search, date_from, date_to } = options;
    return this.http.get<Session[]>('/sessions', { limit, offset, status, search, date_from, date_to });
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

  /**
   * Open a WebSocket voice session and wait for the "ready" status.
   * Returns a connected VoiceSession for sending/receiving audio.
   *
   * @example
   * const session = await client.sessions.start({ assistantId: 'YOUR_ID' });
   * const voice = await client.sessions.connect(session.session_id, {
   *   onTranscript: (text) => console.log('User:', text),
   *   onBotText: (text, done) => done && console.log('Bot:', text),
   *   onAudio: (pcm16) => playAudio(pcm16),
   * });
   * voice.sendText('Привет!');
   */
  connect(sessionId: string, callbacks: VoiceSessionCallbacks = {}): Promise<VoiceSession> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.http.wsUrl(`/sessions/${sessionId}/ws`)}?token=${this.http.getApiKey()}`;
      const ws = new WebSocket(wsUrl);

      let settled = false;
      const settle = (fn: () => void) => {
        if (!settled) { settled = true; fn(); }
      };

      const timeout = setTimeout(() => {
        settle(() => {
          ws.close();
          reject(new AlokaiError(`WebSocket did not receive "ready" within ${WS_READY_TIMEOUT_MS / 1000}s`));
        });
      }, WS_READY_TIMEOUT_MS);

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // Send API key in first message as auth (bearer token via WS query param above)
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        settle(() => reject(new AlokaiError('WebSocket connection failed')));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        settle(() => reject(new AlokaiError('WebSocket closed before ready')));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as { type: string; status?: string };
            if (msg.type === 'status' && msg.status === 'ready') {
              clearTimeout(timeout);
              settle(() => {
                // Hand off to VoiceSession for normal message routing
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                resolve(new VoiceSession(ws, callbacks));
              });
            }
          } catch {
            // ignore non-JSON during handshake
          }
        }
      };
    });
  }
}
