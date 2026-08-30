/**
 * Distraction/attention task for the background predictability level:
 * shapes drift through the play area and the user taps only the stars.
 * The task exists so attention is directed at something other than the
 * next pop — mistakes are never penalized beyond not scoring.
 *
 * Pure logic; the UI layer renders and drives `spawn()` on a timer.
 */
import type { RandomFn } from '../../core/ports';

export type TaskShape = 'star' | 'circle' | 'triangle';

export interface TaskItem {
  id: string;
  shape: TaskShape;
  /** 0..1 relative position. */
  x: number;
  y: number;
  /** Wall-clock ms when the item disappears on its own. */
  expiresAt: number;
}

export interface TapResult {
  hit: boolean;
  /** Score after the tap. */
  score: number;
}

const SHAPES: TaskShape[] = ['star', 'circle', 'triangle'];
const ITEM_LIFETIME_MS = 3500;
const MAX_ITEMS = 3;

export class StarTask {
  private items = new Map<string, TaskItem>();
  private nextId = 0;
  private _score = 0;
  private _starsSpawned = 0;
  private _starsCaught = 0;

  constructor(
    private readonly rng: RandomFn,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get score(): number {
    return this._score;
  }

  get starsSpawned(): number {
    return this._starsSpawned;
  }

  get starsCaught(): number {
    return this._starsCaught;
  }

  /** Items currently alive (expired ones are pruned). */
  current(): TaskItem[] {
    const t = this.now();
    for (const [id, item] of this.items) {
      if (item.expiresAt <= t) this.items.delete(id);
    }
    return [...this.items.values()];
  }

  /** Spawn one item if there is room. Roughly half the items are stars. */
  spawn(): TaskItem | null {
    if (this.current().length >= MAX_ITEMS) return null;
    const shape: TaskShape =
      this.rng() < 0.5 ? 'star' : SHAPES[1 + Math.floor(this.rng() * 2)];
    const item: TaskItem = {
      id: `item-${this.nextId++}`,
      shape,
      x: 0.08 + this.rng() * 0.78,
      y: 0.62 + this.rng() * 0.3,
      expiresAt: this.now() + ITEM_LIFETIME_MS,
    };
    if (shape === 'star') this._starsSpawned++;
    this.items.set(item.id, item);
    return item;
  }

  /** Tap an item: stars score a point; other shapes just disappear. */
  tap(id: string): TapResult {
    const item = this.items.get(id);
    if (!item || item.expiresAt <= this.now()) {
      return { hit: false, score: this._score };
    }
    this.items.delete(id);
    if (item.shape === 'star') {
      this._score++;
      this._starsCaught++;
      return { hit: true, score: this._score };
    }
    return { hit: false, score: this._score };
  }

  reset(): void {
    this.items.clear();
    this._score = 0;
    this._starsSpawned = 0;
    this._starsCaught = 0;
  }
}
