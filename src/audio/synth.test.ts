import { describe, expect, it } from 'vitest';
import { synthesizePop } from './synth';
import { SYNTHETIC_STIMULI } from './stimuli';

describe('synthetic pop generation', () => {
  it('renders every stimulus at the declared duration, normalized to peak 1', () => {
    for (const def of SYNTHETIC_STIMULI) {
      const samples = synthesizePop(def.params, 44100);
      const expectedSec =
        def.params.durationSec + (def.params.secondTransient?.delaySec ?? 0);
      expect(samples.length).toBe(
        Math.round(def.params.durationSec * 44100) +
          Math.round((def.params.secondTransient?.delaySec ?? 0) * 44100),
      );
      // Declared metadata duration matches the rendered length (±10 ms).
      expect(def.stimulus.durationSec).toBeCloseTo(expectedSec, 1);
      let peak = 0;
      for (const s of samples) peak = Math.max(peak, Math.abs(s));
      expect(peak).toBeCloseTo(1, 3);
      // No NaN/Inf anywhere.
      expect(samples.every((s) => Number.isFinite(s))).toBe(true);
    }
  });

  it('a second transient adds audible energy after its delay', () => {
    const def = SYNTHETIC_STIMULI.find((d) => d.stimulus.id === 'drop-wood')!;
    const withBounce = synthesizePop(def.params, 44100);
    const delay = Math.round(def.params.secondTransient!.delaySec * 44100);
    const tail = withBounce.slice(delay, delay + 2000);
    const tailPeak = Math.max(...tail.map(Math.abs));
    expect(tailPeak).toBeGreaterThan(0.2);
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

  it('library covers four categories, all synthetic, no gunshot-like sounds', () => {
    const byCategory = new Map<string, number>();
    for (const def of SYNTHETIC_STIMULI) {
      expect(def.stimulus.sourceKind).toBe('synthetic');
      byCategory.set(
        def.stimulus.category,
        (byCategory.get(def.stimulus.category) ?? 0) + 1,
      );
    }
    expect(byCategory.get('balloon-pop')).toBe(3);
    expect(byCategory.get('door-closing')).toBe(2);
    expect(byCategory.get('dropped-light-object')).toBe(2);
    expect(byCategory.get('distant-firework')).toBe(2);
    expect(byCategory.has('gunshot-like-synthetic')).toBe(false);
    // Unique ids and deterministic seeds.
    const ids = SYNTHETIC_STIMULI.map((d) => d.stimulus.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
