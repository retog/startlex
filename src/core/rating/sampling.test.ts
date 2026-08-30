import { describe, expect, it } from 'vitest';
import { RatingSampler } from './sampling';
import { seededRandom } from '../random';

describe('RatingSampler', () => {
  it('samples roughly 1/N of trials over many trials', () => {
    const sampler = new RatingSampler({ everyNTrials: 4, minGap: 0 }, seededRandom(1));
    let sampled = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) if (sampler.shouldSample()) sampled++;
    const rate = sampled / total;
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.4);
  });

  it('never samples two trials within the minimum gap', () => {
    const sampler = new RatingSampler({ everyNTrials: 2, minGap: 2 }, seededRandom(2));
    const samples: number[] = [];
    for (let i = 0; i < 500; i++) if (sampler.shouldSample()) samples.push(i);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i] - samples[i - 1]).toBeGreaterThan(2);
    }
  });

  it('does not sample every trial (rating fatigue guard)', () => {
    const sampler = new RatingSampler({ everyNTrials: 4, minGap: 2 }, seededRandom(3));
    const results = Array.from({ length: 20 }, () => sampler.shouldSample());
    expect(results.filter(Boolean).length).toBeLessThan(10);
  });

  it('guarantees a sample early in the block', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sampler = new RatingSampler({ everyNTrials: 6, minGap: 0 }, seededRandom(seed));
      const first4 = [
        sampler.shouldSample(),
        sampler.shouldSample(),
        sampler.shouldSample(),
        sampler.shouldSample(),
      ];
      expect(first4.some(Boolean)).toBe(true);
    }
  });

  it('everyNTrials=1 samples every trial', () => {
    const sampler = new RatingSampler({ everyNTrials: 1, minGap: 0 }, seededRandom(4));
    for (let i = 0; i < 10; i++) expect(sampler.shouldSample()).toBe(true);
  });
});
