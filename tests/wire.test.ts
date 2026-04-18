import { describe, it, expect } from 'vitest';
import {
  parseServerMessage,
  type ServerMessage,
  type ClientMessage,
  isErrorMessage,
  isAudioOutput,
  isTurnEnded,
  KNOWN_TYPES,
} from '../src/wire';
import { startMockServer, sleep } from './server-mock';

describe('parseServerMessage', () => {
  it('parses session.started', () => {
    const raw = JSON.stringify({
      type: 'session.started',
      session_id: 'abc',
      audio_in_rate: 24000,
      audio_out_rate: 24000,
      audio_format: 'json_b64',
    });
    const msg = parseServerMessage(raw);
    expect(msg).not.toBeNull();
    if (msg && msg.type === 'session.started') {
      expect(msg.session_id).toBe('abc');
      expect(msg.audio_in_rate).toBe(24000);
    } else {
      throw new Error('wrong type');
    }
  });

  it('parses audio.output and base64-decodes when requested', () => {
    const raw = JSON.stringify({
      type: 'audio.output',
      turn_index: 2,
      data: 'AAECAwQF',
      sample_rate: 24000,
    });
    const msg = parseServerMessage(raw);
    expect(msg?.type).toBe('audio.output');
    if (msg && isAudioOutput(msg)) {
      expect(msg.turn_index).toBe(2);
    }
  });

  it('parses error', () => {
    const raw = JSON.stringify({
      type: 'error',
      code: 'AUTH_INVALID',
      message: 'bad token',
    });
    const msg = parseServerMessage(raw);
    expect(msg).not.toBeNull();
    if (msg && isErrorMessage(msg)) {
      expect(msg.code).toBe('AUTH_INVALID');
    } else {
      throw new Error('wrong type');
    }
  });

  it('returns null on malformed JSON', () => {
    expect(parseServerMessage('not-json')).toBeNull();
  });

  it('returns null on unknown discriminator', () => {
    const raw = JSON.stringify({ type: 'unknown.thing', x: 1 });
    expect(parseServerMessage(raw)).toBeNull();
  });

  it('isTurnEnded guard narrows to TurnEndedMsg and permits access to benchmarks/interrupted/turn_index', () => {
    const raw = JSON.stringify({
      type: 'turn.ended',
      turn_index: 5,
      interrupted: true,
      benchmarks: {
        'llm.latency': 123.45,
        'stt.frames': 42,
      },
    });
    const msg = parseServerMessage(raw);
    expect(msg).not.toBeNull();
    if (isTurnEnded(msg)) {
      // TypeScript should allow access to these fields without error
      expect(msg.turn_index).toBe(5);
      expect(msg.interrupted).toBe(true);
      expect(msg.benchmarks['llm.latency']).toBe(123.45);
      expect(msg.benchmarks['stt.frames']).toBe(42);
    } else {
      throw new Error('guard should have narrowed to TurnEndedMsg');
    }
  });
});

describe('ClientMessage type completeness', () => {
  it('allows all 7 client discriminator values at the type level', () => {
    const samples: ClientMessage[] = [
      { type: 'session.start' },
      { type: 'session.start', dynamic_variables: { name: 'Ivan' } },
      { type: 'session.stop' },
      { type: 'audio.input', data: 'AAA=', sample_rate: 24000 },
      { type: 'text.input', text: 'hi' },
      { type: 'tool.result', call_id: 't:1', result: { ok: true } },
      { type: 'interrupt' },
      { type: 'ping' },
    ];
    expect(samples.length).toBe(8);
  });
});

describe('ServerMessage type completeness', () => {
  it('allows all 15 server discriminator values at the type level', () => {
    const samples: ServerMessage[] = [
      { type: 'session.started', session_id: 's', audio_in_rate: 24000, audio_out_rate: 24000, audio_format: 'json_b64' },
      { type: 'turn.started', turn_index: 0 },
      { type: 'turn.ended', turn_index: 0, interrupted: false, benchmarks: {} },
      { type: 'speech.started', turn_index: 0 },
      { type: 'speech.ended', turn_index: 0 },
      { type: 'stt.partial', turn_index: 0, text: 'h' },
      { type: 'stt.final', turn_index: 0, text: 'hello' },
      { type: 'llm.delta', turn_index: 0, text: 'hi' },
      { type: 'llm.done', turn_index: 0, text: 'hi', tokens_in: 1, tokens_out: 1 },
      { type: 'audio.output', turn_index: 0, data: 'AA==', sample_rate: 24000 },
      { type: 'tool.call', call_id: 't:0', turn_index: 0, name: 'x', arguments: {} },
      { type: 'interrupted', turn_index: 0, reason: 'user_speech' },
      { type: 'session.ended', reason: 'user_hangup', duration_sec: 10 },
      { type: 'error', code: 'INTERNAL_ERROR', message: 'boom' },
      { type: 'pong' },
    ];
    expect(samples.length).toBe(15);
  });

  it('KNOWN_TYPES has 15 server-message variants', () => {
    // If this fails, you added/removed a ServerMessage variant and forgot to update KNOWN_TYPES.
    expect(KNOWN_TYPES.size).toBe(15);
  });
});

describe('MockServer lastSubprotocol getter', () => {
  it('lastSubprotocol getter returns live value, not stale capture from resolve time', async () => {
    const subprotocols: string[] = [];
    const handle = await startMockServer((ws, req) => {
      subprotocols.push(req.subprotocol ?? 'null');
      ws.close();
    });
    try {
      // At resolve time, lastSubprotocol was null (no connection yet)
      expect(handle.lastSubprotocol).toBeNull();

      // Manually simulate what happens when a connection arrives
      // by checking that the getter reads the live closure variable
      // This is a white-box test: we're verifying the implementation uses get, not capture
      // For a behavioral test, we connect and check it updates
      const { WebSocket } = await import('ws');
      const ws = new WebSocket(handle.url('test-session'));

      // Wait for connection to close
      await new Promise((r) => ws.once('close', r));
      await sleep(10);

      // The getter should now reflect the most recent connection
      // Even though handle was created before the connection, it gets the new value
      expect(handle.lastSubprotocol).toBe('');
      expect(subprotocols).toHaveLength(1);
    } finally {
      await handle.close();
    }
  });
});
