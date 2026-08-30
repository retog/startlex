import type { RandomFn } from './ports';

/** Mulberry32 — small deterministic PRNG for testable scheduling. */
export function seededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform value in [min, max). */
export function uniform(rng: RandomFn, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(rng: RandomFn, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newId(prefix: string, rng: RandomFn = Math.random): string {
  const t = Date.now().toString(36);
  const r = Math.floor(rng() * 0xffffffff)
    .toString(36)
    .padStart(7, '0');
  return `${prefix}_${t}_${r}`;
}
