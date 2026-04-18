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
});
