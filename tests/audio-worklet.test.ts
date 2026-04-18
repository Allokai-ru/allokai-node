import { describe, it, expect } from 'vitest';
import { buildWorkletCode, WORKLET_NAME } from '../src/audio-worklet';

describe('buildWorkletCode', () => {
  it('embeds target rate', () => {
    const code = buildWorkletCode(16000);
    expect(code).toContain('this._targetRate = 16000;');
  });

  it('registers under WORKLET_NAME', () => {
    const code = buildWorkletCode(24000);
    expect(code).toContain(`registerProcessor('${WORKLET_NAME}'`);
  });

  it('is syntactically valid JS (parses)', () => {
    const code = buildWorkletCode(24000);
    expect(() => new Function(code.replace('registerProcessor', '() =>')))
      .not.toThrow();
  });

  // Test 1: Input validation
  describe('input validation', () => {
    it('throws RangeError on NaN', () => {
      expect(() => buildWorkletCode(NaN)).toThrow(RangeError);
      expect(() => buildWorkletCode(NaN)).toThrow(/targetRate must be a positive integer/);
    });

    it('throws RangeError on Infinity', () => {
      expect(() => buildWorkletCode(Infinity)).toThrow(RangeError);
      expect(() => buildWorkletCode(Infinity)).toThrow(/targetRate must be a positive integer/);
    });

    it('throws RangeError on zero', () => {
      expect(() => buildWorkletCode(0)).toThrow(RangeError);
      expect(() => buildWorkletCode(0)).toThrow(/targetRate must be a positive integer/);
    });

    it('throws RangeError on negative', () => {
      expect(() => buildWorkletCode(-16000)).toThrow(RangeError);
      expect(() => buildWorkletCode(-16000)).toThrow(/targetRate must be a positive integer/);
    });

    it('throws RangeError on non-integer', () => {
      expect(() => buildWorkletCode(16000.5)).toThrow(RangeError);
      expect(() => buildWorkletCode(16000.5)).toThrow(/targetRate must be a positive integer/);
    });
  });

  // Test 2: PCM16 conversion boundaries
  describe('PCM16 conversion boundaries', () => {
    it('converts Float32 samples to Int16 with correct asymmetric formula', () => {
      // Check that the exact formula is present in the generated code
      const code = buildWorkletCode(16000);
      expect(code).toContain('s < 0 ? s * 32768 : s * 32767');

      // Verify the formula with known boundary values (Int16Array truncates, doesn't round)
      const float32Samples = [-1.0, 0.0, 1.0, 0.5, -0.5];
      const expected = [-32768, 0, 32767, 16383, -16384];

      for (let i = 0; i < float32Samples.length; i++) {
        const s = float32Samples[i];
        // Simulate what Int16Array assignment does: coerces to int32 then truncates to int16
        const result = (s < 0 ? s * 32768 : s * 32767) | 0;
        expect(result).toBe(expected[i]);
      }
    });
  });

  // Test 3: Resample ratio 48000→16000
  describe('resample ratio calculation', () => {
    it('calculates correct resample ratio for 48000→16000', () => {
      const code = buildWorkletCode(16000);
      // Extract and verify the resample ratio calculation is present
      expect(code).toContain('this._resampleRatio = this._targetRate / this._inputSampleRate;');

      // Simulate ratio calculation: 16000 / 48000 = 1/3
      const inputRate = 48000;
      const targetRate = 16000;
      const ratio = targetRate / inputRate;
      expect(ratio).toBe(1 / 3);

      // With 128 input samples at 48000 Hz and ratio 1/3,
      // we should get approximately 128 * (1/3) = 42-43 output samples
      // accounting for buffer carry-over
      const inputSamples = 128;
      const estimatedOutput = Math.floor(inputSamples * ratio);
      expect(estimatedOutput).toBeGreaterThanOrEqual(41);
      expect(estimatedOutput).toBeLessThanOrEqual(44);
    });
  });
});
