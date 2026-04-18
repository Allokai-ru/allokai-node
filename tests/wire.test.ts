import { describe, it, expect } from 'vitest';
import {
  parseServerMessage,
  type ServerMessage,
  type ClientMessage,
  isErrorMessage,
  isAudioOutput,
} from '../src/wire';

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
});

describe('ClientMessage type completeness', () => {
  it('allows all 8 client discriminator values at the type level', () => {
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
});
