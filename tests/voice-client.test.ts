import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startMockServer, sleep, type MockServerHandle } from './server-mock';
import { VoiceClient } from '../src/voice-client';
import type { WebSocket as WsServerSocket } from 'ws';

// Swap jsdom's WebSocket for node's `ws` (jsdom ships one but only works in browser).
import { WebSocket as NodeWS } from 'ws';
(globalThis as unknown as { WebSocket: typeof NodeWS }).WebSocket = NodeWS;

describe('VoiceClient (new wire)', () => {
  let server: MockServerHandle;
  let serverSocket: WsServerSocket | null = null;

  beforeEach(async () => {
    serverSocket = null;
    server = await startMockServer((ws) => { serverSocket = ws; });
  });

  afterEach(async () => {
    await server.close();
  });

  it('connects to /v1/voice/ws/{session_id} with allokai.bearer subprotocol', async () => {
    const url = new URL(server.url('session-xyz'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak_test_abc',
      sessionId: 'session-xyz',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    expect(serverSocket).not.toBeNull();
    expect((serverSocket as unknown as { protocol: string }).protocol)
      .toBe('allokai.bearer.ak_test_abc');
    client.disconnect();
  });

  it('sends session.start on connect', async () => {
    const received: string[] = [];
    await server.close();
    server = await startMockServer((ws) => {
      ws.on('message', (data) => received.push(data.toString()));
    });

    const url = new URL(server.url('s1'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak_x',
      sessionId: 's1',
      callbacks: {},
    });
    await client.connect();
    await sleep(30);
    const starts = received.filter((s) => s.includes('"session.start"'));
    expect(starts.length).toBe(1);
    client.disconnect();
  });

  it('dispatches server messages to callbacks by type', async () => {
    let startedId: string | null = null;
    let agentTurns = 0;
    let agentDelta = '';
    let errored: string | null = null;
    let ended = false;

    const url = new URL(server.url('s2'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's2',
      callbacks: {
        onSessionStarted: (m) => { startedId = m.session_id; },
        onAgentDelta: (m) => { agentDelta += m.text; },
        onAgentTurn: () => { agentTurns += 1; },
        onError: (m) => { errored = m.message; },
        onEnded: () => { ended = true; },
      },
    });
    await client.connect();
    await sleep(20);
    serverSocket!.send(JSON.stringify({
      type: 'session.started', session_id: 's2',
      audio_in_rate: 24000, audio_out_rate: 24000, audio_format: 'json_b64',
    }));
    serverSocket!.send(JSON.stringify({ type: 'llm.delta', turn_index: 0, text: 'Hi ' }));
    serverSocket!.send(JSON.stringify({ type: 'llm.delta', turn_index: 0, text: 'there' }));
    serverSocket!.send(JSON.stringify({
      type: 'llm.done', turn_index: 0, text: 'Hi there',
      tokens_in: 3, tokens_out: 2,
    }));
    serverSocket!.send(JSON.stringify({
      type: 'turn.ended', turn_index: 0, interrupted: false,
      benchmarks: { perceived_ms: 420 },
    }));
    serverSocket!.send(JSON.stringify({
      type: 'error', code: 'INTERNAL_ERROR', message: 'boom',
    }));
    serverSocket!.send(JSON.stringify({
      type: 'session.ended', reason: 'user_hangup', duration_sec: 5,
    }));
    await sleep(40);

    expect(startedId).toBe('s2');
    expect(agentDelta).toBe('Hi there');
    expect(agentTurns).toBe(1);
    expect(errored).toBe('boom');
    expect(ended).toBe(true);
    client.disconnect();
  });

  it('sendText emits text.input frame', async () => {
    const received: string[] = [];
    await server.close();
    server = await startMockServer((ws) => {
      ws.on('message', (d) => received.push(d.toString()));
    });
    const url = new URL(server.url('s3'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's3',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    client.sendText('привет');
    await sleep(20);
    const txt = received.find((s) => s.includes('"text.input"'));
    expect(txt).toBeTruthy();
    expect(JSON.parse(txt!)).toMatchObject({ type: 'text.input', text: 'привет' });
    client.disconnect();
  });

  it('interrupt emits interrupt frame', async () => {
    const received: string[] = [];
    await server.close();
    server = await startMockServer((ws) => {
      ws.on('message', (d) => received.push(d.toString()));
    });
    const url = new URL(server.url('s4'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's4',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    client.interrupt();
    await sleep(20);
    const ir = received.find((s) => s.includes('"interrupt"'));
    expect(ir).toBeTruthy();
    client.disconnect();
  });

  it('sendToolResult emits tool.result frame', async () => {
    const received: string[] = [];
    await server.close();
    server = await startMockServer((ws) => {
      ws.on('message', (d) => received.push(d.toString()));
    });
    const url = new URL(server.url('s5'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's5',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    client.sendToolResult('tool-1', { status: 'ok' });
    await sleep(20);
    const tr = received.find((s) => s.includes('"tool.result"'));
    expect(tr).toBeTruthy();
    expect(JSON.parse(tr!)).toMatchObject({
      type: 'tool.result', call_id: 'tool-1', result: { status: 'ok' },
    });
    client.disconnect();
  });

  it('null token connects without subprotocol (cookie/SPA mode)', async () => {
    const url = new URL(server.url('s6'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: null,
      sessionId: 's6',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    expect(serverSocket).not.toBeNull();
    // No subprotocol — ws will echo an empty string for no subprotocol
    expect((serverSocket as unknown as { protocol: string }).protocol).toBe('');
    client.disconnect();
  });

  it('readyState reflects WS state: OPEN after connect, CLOSED after disconnect', async () => {
    const url = new URL(server.url('s7'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's7',
      callbacks: {},
    });
    expect(client.readyState).toBe(WebSocket.CLOSED);
    await client.connect();
    expect(client.readyState).toBe(WebSocket.OPEN);
    client.disconnect();
    await sleep(20);
    expect(client.readyState).toBe(WebSocket.CLOSED);
  });

  it('dispatches interrupted event and fires onInterrupted callback', async () => {
    let interruptedReason: string | null = null;
    const url = new URL(server.url('s8'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's8',
      callbacks: {
        onInterrupted: (m) => { interruptedReason = m.reason; },
      },
    });
    await client.connect();
    await sleep(20);
    serverSocket!.send(JSON.stringify({
      type: 'interrupted', turn_index: 0, reason: 'user_speech',
    }));
    await sleep(20);
    expect(interruptedReason).toBe('user_speech');
    client.disconnect();
  });

  it('dispatches tool.call to onToolCall callback', async () => {
    let toolName: string | null = null;
    let toolArgs: Record<string, unknown> | null = null;
    const url = new URL(server.url('s9'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's9',
      callbacks: {
        onToolCall: (m) => { toolName = m.name; toolArgs = m.arguments; },
      },
    });
    await client.connect();
    await sleep(20);
    serverSocket!.send(JSON.stringify({
      type: 'tool.call', call_id: 'c:1', turn_index: 0,
      name: 'get_weather', arguments: { city: 'Moscow' },
    }));
    await sleep(20);
    expect(toolName).toBe('get_weather');
    expect(toolArgs).toMatchObject({ city: 'Moscow' });
    client.disconnect();
  });

  it('disconnect is idempotent (no error on double disconnect)', async () => {
    const url = new URL(server.url('s10'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's10',
      callbacks: {},
    });
    await client.connect();
    client.disconnect();
    expect(() => client.disconnect()).not.toThrow();
  });

  it('audio.output with no AudioContext in env does not throw', async () => {
    const url = new URL(server.url('s11'));
    const client = new VoiceClient({
      baseUrl: `${url.protocol.replace('ws', 'http')}//${url.host}/v1`,
      token: 'ak',
      sessionId: 's11',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);

    // Send a tiny 2-byte PCM frame (1 int16 sample = 0) encoded as base64.
    // In test env, AudioContext is not available, so handleAudio should silently skip.
    const pcm = new Int16Array([0]);
    const b64 = Buffer.from(pcm.buffer).toString('base64');
    expect(() => {
      serverSocket!.send(JSON.stringify({
        type: 'audio.output', turn_index: 0,
        data: b64, sample_rate: 24000,
      }));
    }).not.toThrow();
    await sleep(20);
    client.disconnect();
  });

  it('WS URL contains session_id and uses ws: scheme for http: baseUrl', async () => {
    let receivedUrl = '';
    await server.close();
    server = await startMockServer((_ws, req) => { receivedUrl = req.url; });
    const url = new URL(server.url('my-session'));
    const client = new VoiceClient({
      baseUrl: `http://${url.host}/v1`,
      token: 'ak',
      sessionId: 'my-session',
      callbacks: {},
    });
    await client.connect();
    await sleep(20);
    expect(receivedUrl).toBe('/v1/voice/ws/my-session');
    client.disconnect();
  });
});
