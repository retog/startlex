import { describe, expect, it } from 'vitest';
import { spawnField, targetOf } from './field';
import { seededRandom } from '../../core/random';

describe('balloon field', () => {
  it('spawns the requested number of balloons with exactly one target', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const field = spawnField(seededRandom(seed), { count: 4, colorCount: 5 });
      expect(field).toHaveLength(4);
      expect(field.filter((b) => b.role === 'target')).toHaveLength(1);
      expect(targetOf(field).role).toBe('target');
    }
  });

  it('keeps balloons inside the play area and visually separated', () => {
    const field = spawnField(seededRandom(9), { count: 4, colorCount: 5 });
    for (const b of field) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(0.9);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(0.9);
    }
    for (let i = 0; i < field.length; i++) {
      for (let j = i + 1; j < field.length; j++) {
        const d = Math.hypot(field[i].x - field[j].x, field[i].y - field[j].y);
        expect(d).toBeGreaterThan(0.1);
      }
    }
  });

  it('picks varying targets across spawns (unpredictable which balloon pops)', () => {
    const targets = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      targets.add(targetOf(spawnField(seededRandom(seed), { count: 4, colorCount: 5 })).id);
    }
    expect(targets.size).toBeGreaterThan(1);
  });

  it('colorIndex stays within the palette', () => {
    const field = spawnField(seededRandom(3), { count: 6, colorCount: 5 });
    for (const b of field) {
      expect(b.colorIndex).toBeGreaterThanOrEqual(0);
      expect(b.colorIndex).toBeLessThan(5);
    }
  });
});
