import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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
  startTimes: number[] = [];
  connect = vi.fn();
  start = vi.fn((when: number) => {
    this.started = true;
    this.startTimes.push(when);
  });
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
  sources: FakeBufferSource[] = [];
  createBufferSource() {
    const src = new FakeBufferSource();
    this.sources.push(src);
    return src;
  }
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
    vi.useFakeTimers();
    ctx = new FakeAudioContext();
    playback = new AudioPlayback(ctx as unknown as AudioContext, 24000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules chunks with monotonic start times', () => {
    const pcm = new Int16Array(24000 * 0.1);   // 100ms at 24kHz
    playback.enqueue(pcm.buffer);
    playback.enqueue(pcm.buffer);

    const startTimes = ctx.sources.map(s => s.startTimes[0]);
    expect(startTimes).toHaveLength(2);
    // Second chunk starts after first chunk ends.
    expect(startTimes[1]).toBeGreaterThan(startTimes[0]);
  });

  it('interrupt fades gain and stops sources after 200ms', () => {
    const pcm = new Int16Array(24000 * 0.1);
    playback.enqueue(pcm.buffer);
    const [src] = ctx.sources;

    playback.interrupt();

    // Source not stopped yet — timer is pending.
    expect(src.stopped).toBe(false);

    vi.advanceTimersByTime(200);

    expect(src.stopped).toBe(true);
  });

  it('close shuts down AudioContext', async () => {
    await playback.close();
    expect(ctx.closed).toBe(true);
  });

  it('regression: second interrupt cancels first timer so gain is not restored prematurely', () => {
    const gain = (playback as unknown as { gainNode: FakeGain }).gainNode.gain;
    const pcm = new Int16Array(24000 * 0.1);

    // First interrupt: schedules timer1 which would restore gain.value = 1 at +200ms.
    playback.enqueue(pcm.buffer);
    playback.interrupt();

    // Second interrupt at +100ms (before timer1 fires): schedules timer2.
    // timer1 must be cancelled — otherwise it fires at +200ms and resets gain to 1,
    // clobbering any subsequent fade started by timer2.
    vi.advanceTimersByTime(100);
    playback.enqueue(pcm.buffer);
    playback.interrupt();

    // Simulate gain being set to 0 by the second fade (as would happen in real AudioContext).
    gain.value = 0;

    // Advance 200ms past the second interrupt (total ~300ms from start).
    // timer1 must NOT fire — it was cleared. Only timer2 fires, which stops secondSrc
    // and restores gain.
    vi.advanceTimersByTime(200);

    const [firstSrc, secondSrc] = ctx.sources;

    // firstSrc stopped by timer2 would be wrong (timer2 has secondSrc). firstSrc was
    // snapshotted by interrupt1 → timer1 was cleared, so firstSrc.stop() was never called.
    // secondSrc was snapshotted by interrupt2 → timer2 fires and stops it.
    expect(firstSrc.stopped).toBe(false); // orphan timer1 was cancelled
    expect(secondSrc.stopped).toBe(true); // timer2 fires normally
    // Gain was restored by timer2 (no orphan stomp).
    expect(gain.value).toBe(1);
  });
});
