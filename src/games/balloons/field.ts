/**
 * Balloon field model for the probabilistic and background predictability
 * levels: several balloons are on screen, exactly one (hidden from the
 * user) is the target that pops when the trial's stimulus sounds; decoys
 * never pop. Pure logic — rendering lives in the UI layer.
 *
 * Note on semantics: every armed trial produces exactly one acoustic event.
 * "Balloons that never pop" are decoys within a trial (and may visually
 * drift away), not silent trials, so trial accounting stays unambiguous.
 */
import type { RandomFn } from '../../core/ports';

export type BalloonRole = 'target' | 'decoy';

export interface FieldBalloon {
  id: string;
  /** 0..1 relative position inside the game area. */
  x: number;
  y: number;
  colorIndex: number;
  role: BalloonRole;
}

export interface FieldOptions {
  /** Total balloons on screen (>= 1). */
  count: number;
  /** Number of colors available for colorIndex. */
  colorCount: number;
}

const MIN_DISTANCE = 0.24; // keep balloons visually separated (relative units)
const X_RANGE = { min: 0.05, max: 0.72 };
const Y_RANGE = { min: 0.08, max: 0.55 };

/**
 * Spawn a field of `count` balloons at non-overlapping positions with
 * exactly one target chosen uniformly at random.
 */
export function spawnField(rng: RandomFn, options: FieldOptions): FieldBalloon[] {
  const count = Math.max(1, options.count);
  const positions: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  while (positions.length < count && attempts < 300) {
    attempts++;
    const candidate = {
      x: X_RANGE.min + rng() * (X_RANGE.max - X_RANGE.min),
      y: Y_RANGE.min + rng() * (Y_RANGE.max - Y_RANGE.min),
    };
    const tooClose = positions.some(
      (p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < MIN_DISTANCE,
    );
    if (!tooClose) positions.push(candidate);
  }
  // Fallback: if space ran out, place remaining on a loose grid.
  while (positions.length < count) {
    const i = positions.length;
    positions.push({
      x: X_RANGE.min + (i % 3) * 0.3,
      y: Y_RANGE.min + Math.floor(i / 3) * 0.28,
    });
  }
  const targetIndex = Math.floor(rng() * count);
  return positions.map((p, i) => ({
    id: `balloon-${i}`,
    x: p.x,
    y: p.y,
    colorIndex: Math.floor(rng() * options.colorCount),
    role: i === targetIndex ? 'target' : 'decoy',
  }));
}

export function targetOf(field: readonly FieldBalloon[]): FieldBalloon {
  const target = field.find((b) => b.role === 'target');
  if (!target) throw new Error('Field has no target balloon');
  return target;
}
