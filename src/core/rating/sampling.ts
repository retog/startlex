/**
 * Periodic rating sampling.
 *
 * Ratings are deliberately NOT collected after every stimulus: constant
 * prompts interrupt habituation and push attention onto the next startle.
 * Instead roughly one in `everyNTrials` trials is sampled, with jitter, a
 * minimum gap between prompts, and a guaranteed sample early in the block.
 */
import type { RandomFn } from '../ports';

export interface SamplingConfig {
  /** Roughly one prompt every N trials (N >= 1; 1 = every trial). */
  everyNTrials: number;
  /** Never prompt twice within this many trials of each other. */
  minGap: number;
}

export const DEFAULT_SAMPLING: SamplingConfig = { everyNTrials: 4, minGap: 2 };

export class RatingSampler {
  private trialsSinceLast = Infinity;
  private trialIndex = 0;

  constructor(
    private readonly config: SamplingConfig,
    private readonly rng: RandomFn,
  ) {}

  /** Decide whether the trial that just finished should be rated. */
  shouldSample(): boolean {
    this.trialIndex += 1;
    if (this.config.everyNTrials <= 1) {
      this.trialsSinceLast = 0;
      return true;
    }
    if (this.trialsSinceLast < this.config.minGap) {
      this.trialsSinceLast += 1;
      return false;
    }
    // Always sample the second trial so short blocks yield at least one rating
    // without making the very first pop feel like a test.
    const probability =
      this.trialIndex === 2 ? 1 : 1 / this.config.everyNTrials;
    if (this.rng() < probability) {
      this.trialsSinceLast = 0;
      return true;
    }
    this.trialsSinceLast += 1;
    return false;
  }
}
