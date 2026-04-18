import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';

export interface MockServerHandle {
  url: (sessionId: string) => string;
  close: () => Promise<void>;
  connections: WebSocket[];
  readonly lastSubprotocol: string | null;
}

/**
 * Starts a local WebSocket server that mirrors /v1/voice/ws/{session_id}.
 * Records the subprotocol sent by the client, exposes connections so tests
 * can assert on client messages and push canned server messages.
 */
export function startMockServer(
  onConnect: (ws: WebSocket, req: { url: string; subprotocol: string | null }) => void,
): Promise<MockServerHandle> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0 }, () => {
      const port = (wss.address() as AddressInfo).port;
      const connections: WebSocket[] = [];
      let lastSubprotocol: string | null = null;

      wss.on('connection', (ws, req) => {
        lastSubprotocol = (ws as unknown as { protocol?: string }).protocol ?? null;
        connections.push(ws);
        onConnect(ws, { url: req.url ?? '', subprotocol: lastSubprotocol });
      });

      resolve({
        url: (sessionId: string) => `ws://127.0.0.1:${port}/v1/voice/ws/${sessionId}`,
        close: () => new Promise((r) => wss.close(() => r())),
        connections,
        get lastSubprotocol() {
          return lastSubprotocol;
        },
      });
    });
  });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
