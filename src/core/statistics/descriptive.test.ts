import { describe, expect, it } from 'vitest';
import { habituation, mean, median, trendSlope } from './descriptive';

describe('descriptive statistics', () => {
  it('mean/median handle empty input', () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
  });

  it('computes mean and median', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 9])).toBe(2);
  });

  it('trendSlope needs at least 3 points', () => {
    expect(trendSlope([1, 2])).toBeNull();
    expect(trendSlope([1, 2, 3])).toBeCloseTo(1);
    expect(trendSlope([3, 2, 1])).toBeCloseTo(-1);
    expect(trendSlope([2, 2, 2, 2])).toBeCloseTo(0);
  });

  it('habituation compares first vs last third', () => {
    expect(habituation([5, 5])).toBeNull(); // too short
    const h = habituation([6, 6, 5, 4, 3, 2, 2, 2, 1]);
    expect(h).not.toBeNull();
    expect(h!.firstThirdMean).toBeCloseTo(17 / 3);
    expect(h!.lastThirdMean).toBeCloseTo(5 / 3);
    expect(h!.change).toBeLessThan(0);
    expect(h!.n).toBe(9);
  });
});
