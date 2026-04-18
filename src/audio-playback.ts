/**
 * Gapless PCM16 playback queue for a single AudioContext.
 *
 * Chunks are scheduled back-to-back using AudioBufferSourceNode.start(when)
 * with a running cursor. On interrupt(), all sources are stopped after a
 * 150ms gain fadeout to avoid mid-word clicks.
 */

export function pcm16ToFloat32(int16: Int16Array): Float32Array {
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    f32[i] = int16[i] / 32768;
  }
  return f32;
}

export class AudioPlayback {
  private readonly ctx: AudioContext;
  private readonly sampleRate: number;
  private readonly gainNode: GainNode;
  private nextStart = 0;
  private scheduled: AudioBufferSourceNode[] = [];

  constructor(ctx: AudioContext, sampleRate: number) {
    this.ctx = ctx;
    this.sampleRate = sampleRate;
    this.gainNode = ctx.createGain();
    this.gainNode.connect(ctx.destination);
  }

  get queueDepth(): number {
    return this.scheduled.length;
  }

  enqueue(pcmBuffer: ArrayBuffer): void {
    if (pcmBuffer.byteLength < 2) return;

    const int16 = new Int16Array(pcmBuffer);
    const f32 = pcm16ToFloat32(int16);

    const buf = this.ctx.createBuffer(1, f32.length, this.sampleRate);
    buf.getChannelData(0).set(f32);

    const now = this.ctx.currentTime;
    if (this.nextStart < now) this.nextStart = now;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gainNode);
    src.start(this.nextStart);
    this.nextStart += buf.duration;

    this.scheduled.push(src);

    src.onended = () => {
      const idx = this.scheduled.indexOf(src);
      if (idx !== -1) this.scheduled.splice(idx, 1);
    };
  }

  interrupt(): void {
    const sources = this.scheduled;
    this.scheduled = [];
    this.nextStart = 0;

    const now = this.ctx.currentTime;
    try {
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    } catch {
      // AudioContext closed
    }

    setTimeout(() => {
      for (const src of sources) {
        try { src.stop(); } catch { /* already stopped */ }
      }
      try { this.gainNode.gain.value = 1; } catch { /* closed */ }
    }, 200);
  }

  async close(): Promise<void> {
    this.interrupt();
    try { await this.ctx.close(); } catch { /* already closed */ }
  }
}
