import type { ServerEvent } from './types';

export interface VoiceSessionCallbacks {
  onStatus?: (status: 'ready' | 'listening' | 'thinking' | 'speaking') => void;
  onTranscript?: (text: string) => void;
  onBotText?: (text: string, done: boolean) => void;
  onAudio?: (data: ArrayBuffer) => void;
  onToolCall?: (toolCallId: string, toolName: string, parameters: Record<string, unknown>) => void;
  onMetadata?: (conversationId: string, agentId: string) => void;
  onError?: (message: string) => void;
  onSessionEnded?: () => void;
}

/**
 * Low-level WebSocket voice session.
 * Connect via `sessions.connect(sessionId, callbacks)`.
 */
export class VoiceSession {
  private readonly ws: WebSocket;

  /** @internal */
  constructor(ws: WebSocket, callbacks: VoiceSessionCallbacks) {
    this.ws = ws;
    this.ws.binaryType = 'arraybuffer';

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        callbacks.onAudio?.(event.data);
      } else if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data) as ServerEvent;
          this.dispatch(msg, callbacks);
        } catch {
          // ignore malformed frames
        }
      }
    };

    this.ws.onerror = () => {
      callbacks.onError?.('WebSocket connection error');
    };

    this.ws.onclose = () => {
      callbacks.onSessionEnded?.();
    };
  }

  private dispatch(msg: ServerEvent, cb: VoiceSessionCallbacks): void {
    switch (msg.type) {
      case 'status':
        cb.onStatus?.(msg.status);
        break;
      case 'transcript':
        cb.onTranscript?.(msg.text);
        break;
      case 'bot_text':
        cb.onBotText?.(msg.text, msg.done);
        break;
      case 'tool_call':
        cb.onToolCall?.(msg.tool_call_id, msg.tool_name, msg.parameters);
        break;
      case 'metadata':
        cb.onMetadata?.(msg.conversation_id, msg.agent_id);
        break;
      case 'error':
        cb.onError?.(msg.message);
        break;
      case 'session_ended':
        cb.onSessionEnded?.();
        break;
    }
  }

  /** Send raw PCM16 16kHz mono audio bytes to the agent. */
  sendAudio(pcm16Bytes: ArrayBuffer): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcm16Bytes);
    }
  }

  /** Send a text message to the agent (no microphone input needed). */
  sendText(text: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text_message', text }));
    }
  }

  /** Send a contextual update (does not interrupt the agent). */
  sendContextUpdate(text: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'context_update', text }));
    }
  }

  /** Respond to a tool_call event from the agent. */
  sendToolResult(toolCallId: string, result: string, isError = false): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'tool_result',
        tool_call_id: toolCallId,
        result,
        is_error: isError,
      }));
    }
  }

  /** Close the WebSocket connection. */
  close(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }

  get readyState(): number {
    return this.ws.readyState;
  }
}
