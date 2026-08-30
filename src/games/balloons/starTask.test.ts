import { describe, expect, it } from 'vitest';
import { StarTask } from './starTask';
import { seededRandom } from '../../core/random';

function makeTask(seed = 1) {
  let time = 0;
  const task = new StarTask(seededRandom(seed), () => time);
  return { task, advance: (ms: number) => (time += ms) };
}

describe('star distraction task', () => {
  it('spawns a mix of stars and other shapes', () => {
    const { task, advance } = makeTask(2);
    const shapes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const item = task.spawn();
      if (item) shapes.add(item.shape);
      advance(4000); // expire so there is always room
    }
    expect(shapes.has('star')).toBe(true);
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('scores only star taps', () => {
    const { task } = makeTask(3);
    let star: string | null = null;
    let other: string | null = null;
    while (star === null || other === null) {
      const item = task.spawn();
      if (!item) {
        for (const i of task.current()) if (i.id !== star && i.id !== other) task.tap(i.id);
        continue;
      }
      if (item.shape === 'star' && star === null) star = item.id;
      else if (item.shape !== 'star' && other === null) other = item.id;
    }
    expect(task.tap(other).hit).toBe(false);
    expect(task.score).toBe(0);
    expect(task.tap(star).hit).toBe(true);
    expect(task.score).toBe(1);
    // Tapping the same item twice does not double-score.
    expect(task.tap(star).hit).toBe(false);
    expect(task.score).toBe(1);
  });

  it('items expire on their own and expired taps do not score', () => {
    const { task, advance } = makeTask(4);
    let starId: string | null = null;
    while (starId === null) {
      const item = task.spawn();
      if (item?.shape === 'star') starId = item.id;
      else advance(4000);
    }
    advance(10_000);
    expect(task.current()).toHaveLength(0);
    expect(task.tap(starId).hit).toBe(false);
    expect(task.score).toBe(0);
  });

  it('never exceeds the on-screen item cap', () => {
    const { task } = makeTask(5);
    for (let i = 0; i < 10; i++) task.spawn();
    expect(task.current().length).toBeLessThanOrEqual(3);
  });

  it('reset clears items and score', () => {
    const { task } = makeTask(6);
    task.spawn();
    task.reset();
    expect(task.current()).toHaveLength(0);
    expect(task.score).toBe(0);
    expect(task.starsSpawned).toBe(0);
  });
});
