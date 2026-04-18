export const WORKLET_NAME = 'allokai-mic-processor';

/**
 * Returns the source code of an AudioWorkletProcessor that downsamples the
 * browser's native-rate mic Float32 input to Int16 PCM at `targetRate`, and
 * posts Int16Array buffers back to the main thread on every frame.
 *
 * The processor is registered globally under WORKLET_NAME.
 */
export function buildWorkletCode(targetRate: number): string {
  return `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inputSampleRate = sampleRate;
    this._targetRate = ${targetRate};
    this._resampleRatio = this._targetRate / this._inputSampleRate;
    this._resampleBuffer = [];
    this._resampleIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const samples = input[0];

    if (this._inputSampleRate === this._targetRate) {
      const int16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
      return true;
    }

    for (let i = 0; i < samples.length; i++) {
      this._resampleBuffer.push(samples[i]);
    }

    const outputSamples = [];
    while (this._resampleIndex < this._resampleBuffer.length - 1) {
      const idx = Math.floor(this._resampleIndex);
      const frac = this._resampleIndex - idx;
      const s = this._resampleBuffer[idx] * (1 - frac) + this._resampleBuffer[idx + 1] * frac;
      outputSamples.push(s);
      this._resampleIndex += 1 / this._resampleRatio;
    }

    const consumed = Math.floor(this._resampleIndex);
    this._resampleBuffer = this._resampleBuffer.slice(consumed);
    this._resampleIndex -= consumed;

    if (outputSamples.length > 0) {
      const int16 = new Int16Array(outputSamples.length);
      for (let i = 0; i < outputSamples.length; i++) {
        const s = Math.max(-1, Math.min(1, outputSamples[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }

    return true;
  }
}

registerProcessor('${WORKLET_NAME}', MicProcessor);
`;
}
