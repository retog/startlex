import { describe, expect, it } from 'vitest';
import { synthesizePop } from './synth';
import { SYNTHETIC_STIMULI } from './stimuli';

describe('synthetic pop generation', () => {
  it('renders every MVP stimulus at the declared duration, normalized to peak 1', () => {
    for (const def of SYNTHETIC_STIMULI) {
      const samples = synthesizePop(def.params, 44100);
      expect(samples.length).toBe(Math.round(def.params.durationSec * 44100));
      let peak = 0;
      for (const s of samples) peak = Math.max(peak, Math.abs(s));
      expect(peak).toBeCloseTo(1, 3);
      // No NaN/Inf anywhere.
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = synthesizePop(SYNTHETIC_STIMULI[0].params, 44100);
    const b = synthesizePop(SYNTHETIC_STIMULI[0].params, 44100);
    expect(Array.from(a.slice(0, 100))).toEqual(Array.from(b.slice(0, 100)));
  });

  it('ends silent (fade-out against clicks)', () => {
    const samples = synthesizePop(SYNTHETIC_STIMULI[1].params, 44100);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(1e-3);
  });

  it('the three MVP pops are distinct sounds', () => {
    const [a, b, c] = SYNTHETIC_STIMULI.map((d) => synthesizePop(d.params, 44100));
    expect(Array.from(a.slice(0, 50))).not.toEqual(Array.from(b.slice(0, 50)));
    expect(Array.from(b.slice(0, 50))).not.toEqual(Array.from(c.slice(0, 50)));
  });

  it('MVP library contains three balloon-pop stimuli, all synthetic', () => {
    expect(SYNTHETIC_STIMULI).toHaveLength(3);
    for (const def of SYNTHETIC_STIMULI) {
      expect(def.stimulus.sourceKind).toBe('synthetic');
      expect(def.stimulus.category).toBe('balloon-pop');
    }
  });
});
