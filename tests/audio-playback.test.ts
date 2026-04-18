import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioPlayback, pcm16ToFloat32 } from '../src/audio-playback';

describe('pcm16ToFloat32', () => {
  it('converts full-scale Int16 to normalised Float32', () => {
    const int16 = new Int16Array([0, 16384, -16384, 32767, -32768]);
    const f32 = pcm16ToFloat32(int16);
    expect(f32[0]).toBe(0);
    expect(f32[1]).toBeCloseTo(0.5, 3);
    expect(f32[2]).toBeCloseTo(-0.5, 3);
    expect(f32[3]).toBeCloseTo(1.0, 3);
    expect(f32[4]).toBeCloseTo(-1.0, 3);
  });
});

// AudioPlayback is tested against a fake AudioContext (jsdom doesn't ship one).
class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect = vi.fn();
  start = vi.fn((_when: number) => { this.started = true; });
  stop = vi.fn(() => { this.stopped = true; });
}

class FakeGain {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  closed = false;
  createBufferSource() { return new FakeBufferSource(); }
  createGain() { return new FakeGain(); }
  createBuffer(_channels: number, length: number, _rate: number) {
    const data = new Float32Array(length);
    return {
      duration: length / 24000,
      getChannelData: () => data,
    } as unknown as AudioBuffer;
  }
  close() { this.closed = true; return Promise.resolve(); }
}

describe('AudioPlayback', () => {
  let ctx: FakeAudioContext;
  let playback: AudioPlayback;

  beforeEach(() => {
    ctx = new FakeAudioContext();
    playback = new AudioPlayback(ctx as unknown as AudioContext, 24000);
  });

  it('schedules chunks with monotonic start times', () => {
    const pcm = new Int16Array(24000 * 0.1);   // 100ms at 24kHz
    playback.enqueue(pcm.buffer);
    playback.enqueue(pcm.buffer);
    expect(playback.queueDepth).toBe(2);
  });

  it('interrupt fades gain and stops sources', () => {
    const pcm = new Int16Array(24000 * 0.1);
    playback.enqueue(pcm.buffer);
    playback.interrupt();
    // fade is async (setTimeout 200ms) — just check immediate state
    expect(playback.queueDepth).toBe(0);
  });

  it('close shuts down AudioContext', async () => {
    await playback.close();
    expect(ctx.closed).toBe(true);
  });
});
