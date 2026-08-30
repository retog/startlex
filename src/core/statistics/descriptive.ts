/** Simple descriptive statistics. No inferential claims are made from these. */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Least-squares slope of values over their index (per-trial change).
 * Returns null with fewer than 3 points — not enough to call a trend.
 */
export function trendSlope(values: readonly number[]): number | null {
  const n = values.length;
  if (n < 3) return null;
  const xMean = (n - 1) / 2;
  const yMean = mean(values)!;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  return den === 0 ? null : num / den;
}

/**
 * Within-session habituation: mean of the first vs last third of ratings.
 * Requires at least 6 values so each third has >= 2 observations.
 */
export interface HabituationEstimate {
  firstThirdMean: number;
  lastThirdMean: number;
  change: number;
  n: number;
}

export function habituation(
  values: readonly number[],
): HabituationEstimate | null {
  if (values.length < 6) return null;
  const third = Math.floor(values.length / 3);
  const first = values.slice(0, third);
  const last = values.slice(values.length - third);
  const f = mean(first)!;
  const l = mean(last)!;
  return { firstThirdMean: f, lastThirdMean: l, change: l - f, n: values.length };
}

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}
