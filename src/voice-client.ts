/**
 * VoiceClient — high-level WebSocket client for /v1/voice/ws/{session_id}.
 *
 * Auth: subprotocol-based bearer token (`allokai.bearer.<token>`).
 * Pass `token: null` for same-origin SPA cookie auth (no subprotocol sent).
 *
 * Usage:
 *   const client = new VoiceClient({ baseUrl, token, sessionId, callbacks });
 *   await client.connect();
 *   await client.startMicrophone();   // optional mic capture
 *   client.sendText('hi');
 *   client.interrupt();
 *   client.disconnect();
 */

import {
  parseServerMessage,
  type SessionStartedMsg,
  type TurnStartedMsg,
  type TurnEndedMsg,
  type SpeechStartedMsg,
  type SpeechEndedMsg,
  type STTPartialMsg,
  type STTFinalMsg,
  type LLMDeltaMsg,
  type LLMDoneMsg,
  type AudioOutputMsg,
  type ToolCallMsg,
  type InterruptedMsg,
  type SessionEndedMsg,
  type ErrorMsg,
  type ClientMessage,
} from './wire';
import { AudioPlayback } from './audio-playback';
import { buildWorkletCode, WORKLET_NAME } from './audio-worklet';

// ── Callbacks ────────────────────────────────────────────────────────────────

export interface VoiceClientCallbacks {
  onSessionStarted?: (msg: SessionStartedMsg) => void;
  onTurnStarted?: (msg: TurnStartedMsg) => void;
  onTurnEnded?: (msg: TurnEndedMsg) => void;
  onSpeechStarted?: (msg: SpeechStartedMsg) => void;
  onSpeechEnded?: (msg: SpeechEndedMsg) => void;
  onUserPartial?: (msg: STTPartialMsg) => void;
  onUserTurn?: (msg: STTFinalMsg) => void;
  onAgentDelta?: (msg: LLMDeltaMsg) => void;
  onAgentTurn?: (msg: LLMDoneMsg) => void;
  onAudio?: (msg: AudioOutputMsg) => void;
  onToolCall?: (msg: ToolCallMsg) => void;
  onInterrupted?: (msg: InterruptedMsg) => void;
  onError?: (msg: ErrorMsg) => void;
  onEnded?: (msg: SessionEndedMsg) => void;
  onPong?: () => void;
  onClose?: (ev: { code: number; reason: string }) => void;
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface VoiceClientOptions {
  /**
   * Base REST URL, e.g. `https://api.allokai.ru/v1`.
   * Used to derive the WebSocket URL: http→ws, https→wss,
   * then appends `/voice/ws/{sessionId}`.
   */
  baseUrl: string;
  /**
   * Bearer API key (`ak_live_...`).
   * Pass `null` to use SPA cookie auth (same-origin `credentials:include`).
   * When null, no subprotocol is negotiated.
   */
  token: string | null;
  sessionId: string;
  callbacks: VoiceClientCallbacks;
  /** Target input (mic) sample rate. Default 24000. */
  inputSampleRate?: number;
  /** Target output (playback) sample rate. Default 24000. */
  outputSampleRate?: number;
}

// ── Internal type helpers ─────────────────────────────────────────────────────

type GlobalWithAudioContext = typeof globalThis & {
  AudioContext?: typeof AudioContext;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_SAMPLE_RATE = 24000;
const SUBPROTOCOL_PREFIX = 'allokai.bearer.';

// ── VoiceClient ───────────────────────────────────────────────────────────────

export class VoiceClient {
  private readonly opts: Required<VoiceClientOptions>;
  private ws: WebSocket | null = null;
  private playback: AudioPlayback | null = null;
  private mediaStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private disposed = false;

  // Bound handlers stored so we can remove them on disconnect.
  private readonly boundMessage: (ev: MessageEvent) => void;
  private readonly boundClose: (ev: CloseEvent) => void;

  constructor(options: VoiceClientOptions) {
    this.opts = {
      inputSampleRate: DEFAULT_SAMPLE_RATE,
      outputSampleRate: DEFAULT_SAMPLE_RATE,
      ...options,
    } as Required<VoiceClientOptions>;

    this.boundMessage = (ev: MessageEvent) => this.handleMessage(ev);
    this.boundClose = (ev: CloseEvent) => {
      // Fire user callback BEFORE teardown so it receives the close event.
      this.opts.callbacks.onClose?.({ code: ev.code, reason: ev.reason });
      // Server-initiated close: tear everything down (idempotent via disposed guard).
      this.disconnect();
    };
  }

  /**
   * Derives the WebSocket URL from `baseUrl`.
   * `http://host/v1` → `ws://host/v1/voice/ws/{sessionId}`
   * `https://host/v1` → `wss://host/v1/voice/ws/{sessionId}`
   */
  private wsUrl(): string {
    const base = this.opts.baseUrl.replace(/\/+$/, '');
    const ws = base
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://');
    return `${ws}/voice/ws/${encodeURIComponent(this.opts.sessionId)}`;
  }

  /**
   * Open the WebSocket, negotiate the subprotocol, and emit `session.start`.
   * Does NOT start the microphone — call `startMicrophone()` separately.
   *
   * Resolves when the socket is OPEN.
   * Rejects on connection failure.
   * Throws if already connected.
   */
  async connect(): Promise<void> {
    if (this.ws) throw new Error('VoiceClient already connected');
    if (this.disposed) throw new Error('VoiceClient was disconnected; create a new instance');

    const url = this.wsUrl();
    const subprotocols: string[] = this.opts.token
      ? [`${SUBPROTOCOL_PREFIX}${this.opts.token}`]
      : [];

    const ws = new WebSocket(url, subprotocols);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const onOpen = () => {
        if (settled) return;
        settled = true;
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onCloseBefore);
        // If disconnect() was called before the socket opened, clean up and bail.
        if (this.disposed) {
          this.ws = null;
          ws.close();
          resolve();
          return;
        }
        resolve();
      };

      const onError = (ev: Event) => {
        if (settled) return;
        settled = true;
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onCloseBefore);
        // Null out ws so the next connect() call is not blocked.
        this.ws = null;
        // If dispose() closed the socket intentionally, treat as clean resolution.
        if (this.disposed) { resolve(); return; }
        const msg = (ev as ErrorEvent).message ?? 'unknown';
        reject(new Error(`WebSocket failed to open: ${msg}`));
      };

      // If the socket closes before it ever opens (e.g. connection refused),
      // treat it as a connection failure so the client remains retryable.
      const onCloseBefore = (ev: CloseEvent) => {
        if (settled) return;
        settled = true;
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        ws.removeEventListener('close', onCloseBefore);
        this.ws = null;
        // If disconnect() closed the socket intentionally, treat as clean resolution.
        if (this.disposed) { resolve(); return; }
        reject(new Error(`WebSocket closed before open: code=${ev.code}`));
      };

      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
      ws.addEventListener('close', onCloseBefore);
    });

    // disposed check: if disconnect() raced with onOpen resolution
    if (this.disposed || !this.ws) return;

    ws.addEventListener('message', this.boundMessage);
    ws.addEventListener('close', this.boundClose);

    this.send({ type: 'session.start' });
  }

  // ── Message dispatch ────────────────────────────────────────────────────────

  private handleMessage(ev: MessageEvent): void {
    if (typeof ev.data !== 'string') return;
    const msg = parseServerMessage(ev.data);
    if (!msg) return;

    const cb = this.opts.callbacks;

    switch (msg.type) {
      case 'session.started':
        cb.onSessionStarted?.(msg);
        break;
      case 'turn.started':
        cb.onTurnStarted?.(msg);
        break;
      case 'turn.ended':
        cb.onTurnEnded?.(msg);
        break;
      case 'speech.started':
        cb.onSpeechStarted?.(msg);
        // Barge-in: stop agent audio when user starts speaking.
        this.playback?.interrupt();
        break;
      case 'speech.ended':
        cb.onSpeechEnded?.(msg);
        break;
      case 'stt.partial':
        cb.onUserPartial?.(msg);
        break;
      case 'stt.final':
        cb.onUserTurn?.(msg);
        break;
      case 'llm.delta':
        cb.onAgentDelta?.(msg);
        break;
      case 'llm.done':
        cb.onAgentTurn?.(msg);
        break;
      case 'audio.output':
        this.handleAudio(msg);
        cb.onAudio?.(msg);
        break;
      case 'tool.call':
        cb.onToolCall?.(msg);
        break;
      case 'interrupted':
        this.playback?.interrupt();
        cb.onInterrupted?.(msg);
        break;
      case 'error':
        cb.onError?.(msg);
        break;
      case 'session.ended':
        cb.onEnded?.(msg);
        break;
      case 'pong':
        cb.onPong?.();
        break;
    }
  }

  private handleAudio(msg: AudioOutputMsg): void {
    const bytes = base64ToBytes(msg.data);
    if (bytes.byteLength < 2) return;

    if (!this.playback) {
      const Ctor = (globalThis as GlobalWithAudioContext).AudioContext;
      if (!Ctor) return; // No AudioContext in test/non-browser env — skip silently.
      const ctx = new Ctor({ sampleRate: this.opts.outputSampleRate });
      this.playback = new AudioPlayback(ctx, this.opts.outputSampleRate);
    }

    // bytes.buffer is ArrayBufferLike (may be SharedArrayBuffer); cast to ArrayBuffer.
    this.playback.enqueue(bytes.buffer as ArrayBuffer);
  }

  // ── Microphone capture ────────────────────────────────────────────────────

  /**
   * Request microphone permission, set up an AudioWorkletNode for
   * resampling, and start streaming `audio.input` frames to the server.
   *
   * Safe to call after `connect()`. Idempotent (no-op if already started).
   */
  async startMicrophone(): Promise<void> {
    if (this.mediaStream) return;

    // Capture resources into locals first; only commit to this.* after full success.
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const micCtx = new AudioContext();

    try {
      const blob = new Blob([buildWorkletCode(this.opts.inputSampleRate)], {
        type: 'application/javascript',
      });
      const workletUrl = URL.createObjectURL(blob);
      await micCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const src = micCtx.createMediaStreamSource(mediaStream);
      const workletNode = new AudioWorkletNode(micCtx, WORKLET_NAME);

      workletNode.port.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const b64 = bytesToBase64(new Uint8Array(ev.data));
        this.send({
          type: 'audio.input',
          data: b64,
          sample_rate: this.opts.inputSampleRate,
        });
      };

      src.connect(workletNode);
      workletNode.connect(micCtx.destination);

      // All steps succeeded — commit to instance fields.
      this.mediaStream = mediaStream;
      this.micCtx = micCtx;
      this.workletNode = workletNode;
    } catch (err) {
      // Partial failure: clean up local resources to avoid leaks.
      mediaStream.getTracks().forEach((t) => t.stop());
      micCtx.close().catch(() => { /* ignore */ });
      throw err;
    }
  }

  // ── Outbound messages ─────────────────────────────────────────────────────

  sendText(text: string): void {
    this.assertConnected();
    this.send({ type: 'text.input', text });
  }

  sendToolResult(
    callId: string,
    result?: Record<string, unknown>,
    error?: string,
  ): void {
    this.assertConnected();
    const msg: import('./wire').ToolResultMsg = {
      type: 'tool.result',
      call_id: callId,
      ...(result !== undefined && { result }),
      ...(error !== undefined && { error }),
    };
    this.send(msg);
  }

  interrupt(): void {
    this.send({ type: 'interrupt' });
    this.playback?.interrupt();
  }

  ping(): void {
    this.assertConnected();
    this.send({ type: 'ping' });
  }

  /**
   * Throws if there is no WebSocket at all (never connected or after error).
   * Warns (once per connection) if the socket exists but is not yet OPEN.
   */
  private assertConnected(): void {
    if (!this.ws) throw new Error('VoiceClient not connected');
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[VoiceClient] send called while WebSocket is not OPEN (readyState=%d); message dropped', this.ws.readyState);
    }
  }

  private send(msg: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  // ── Teardown ─────────────────────────────────────────────────────────────

  /**
   * Close the WebSocket, stop mic tracks, close AudioContext and AudioPlayback.
   * Idempotent — safe to call multiple times.
   */
  disconnect(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Best-effort: send session.stop before closing.
    try { this.send({ type: 'session.stop' }); } catch { /* ws may already be closing */ }

    if (this.ws) {
      this.ws.removeEventListener('message', this.boundMessage);
      this.ws.removeEventListener('close', this.boundClose);
      try { this.ws.close(); } catch { /* already closed */ }
      this.ws = null;
    }

    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch { /* ignore */ }
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.micCtx) {
      this.micCtx.close().catch(() => { /* ignore */ });
      this.micCtx = null;
    }

    if (this.playback) {
      this.playback.close().catch(() => { /* ignore */ });
      this.playback = null;
    }
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** WebSocket readyState. Returns CLOSED (3) when not connected. */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// ── Base64 helpers ────────────────────────────────────────────────────────────
// Using atob/btoa for isomorphic browser + Node 18+ compatibility.

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}
