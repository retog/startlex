import { describe, expect, it } from 'vitest';
import { decideProgression, type AdaptiveContext } from './adaptive';
import {
  PredictabilityMode,
  intensityToAmplitude,
  predictabilityRank,
  type DifficultyConfig,
  type Trial,
  type TrialRatings,
} from '../types';

let trialCounter = 0;

function makeTrial(
  overrides: Omit<Partial<Trial>, 'ratings'> & { ratings?: Partial<TrialRatings> } = {},
): Trial {
  trialCounter += 1;
  const { ratings, ...rest } = overrides;
  return {
    id: `t${trialCounter}`,
    sessionId: 's1',
    timestamp: 1000 + trialCounter,
    stimulusId: 'pop-soft',
    stimulusCategory: 'balloon-pop',
    intensity: 2,
    amplitude: intensityToAmplitude(2),
    predictability: PredictabilityMode.UserCountdown,
    intendedDelaySec: 3,
    intendedAudioTime: 1,
    scheduledAudioTime: 1,
    userInitiated: true,
    visualContext: 'balloon-basic',
    ratings: { startle: null, distress: null, recovery: null, ...ratings },
    outcome: 'completed',
    pausedDuring: false,
    experimentCondition: null,
    ...rest,
  };
}

function ratedBlock(
  startle: number[],
  distress: number[],
  extra: Partial<Trial> = {},
): Trial[] {
  return startle.map((s, i) =>
    makeTrial({ ratings: { startle: s, distress: distress[i] ?? 0 }, ...extra }),
  );
}

function ctx(overrides: Partial<AdaptiveContext> = {}): AdaptiveContext {
  const current: DifficultyConfig = {
    intensity: 2,
    amplitude: intensityToAmplitude(2),
    predictability: PredictabilityMode.UserCountdown,
    category: 'balloon-pop',
  };
  return {
    current,
    anticipatoryAnxiety: 2,
    pauses: 0,
    lastIncreasedDimension: null,
    increasesThisSession: 0,
    previousSessionStruggled: false,
    maxIntensity: 5,
    maxPredictability: PredictabilityMode.WindowWide,
    ...overrides,
  };
}

describe('adaptive progression — increase', () => {
  it('increases exactly one dimension when ratings are low and stable', () => {
    const decision = decideProgression(ratedBlock([2, 2, 1, 2], [1, 1, 0, 1]), ctx());
    expect(decision.action).toBe('increase');
    expect(decision.dimension).toBe('predictability');
    // Intensity untouched:
    expect(decision.next.intensity).toBe(2);
    expect(decision.next.predictability).toBe(PredictabilityMode.AutoCountdown);
  });

  it('prefers predictability first (control before loudness)', () => {
    const decision = decideProgression(ratedBlock([1, 1, 1], [0, 0, 0]), ctx());
    expect(decision.dimension).toBe('predictability');
  });

  it('alternates to intensity after a predictability increase', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({ lastIncreasedDimension: 'predictability' }),
    );
    expect(decision.dimension).toBe('intensity');
    expect(decision.next.intensity).toBe(3);
    expect(decision.next.predictability).toBe(PredictabilityMode.UserCountdown);
    expect(decision.next.amplitude).toBeCloseTo(intensityToAmplitude(3));
  });

  it('never exceeds the personal max intensity', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({
        current: {
          intensity: 3,
          amplitude: intensityToAmplitude(3),
          predictability: PredictabilityMode.WindowWide,
          category: 'balloon-pop',
        },
        maxIntensity: 3,
        lastIncreasedDimension: 'predictability',
      }),
    );
    expect(decision.action).toBe('hold');
    expect(decision.next.intensity).toBe(3);
  });

  it('never exceeds the unlocked predictability cap', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({
        current: {
          intensity: 5,
          amplitude: intensityToAmplitude(5),
          predictability: PredictabilityMode.WindowWide,
          category: 'balloon-pop',
        },
        maxIntensity: 5,
      }),
    );
    expect(decision.action).toBe('hold');
    expect(predictabilityRank(decision.next.predictability)).toBe(
      predictabilityRank(PredictabilityMode.WindowWide),
    );
  });

  it('advances past window-wide to probabilistic/background when unlocked', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({
        current: {
          intensity: 2,
          amplitude: intensityToAmplitude(2),
          predictability: PredictabilityMode.WindowWide,
          category: 'balloon-pop',
        },
        maxIntensity: 2,
        maxPredictability: PredictabilityMode.Background,
      }),
    );
    expect(decision.action).toBe('increase');
    expect(decision.next.predictability).toBe(PredictabilityMode.Probabilistic);
  });

  it('changes only one dimension per decision, always', () => {
    for (const last of [null, 'intensity', 'predictability'] as const) {
      const decision = decideProgression(
        ratedBlock([1, 1, 1, 0], [0, 0, 0, 0]),
        ctx({ lastIncreasedDimension: last }),
      );
      const changedIntensity = decision.next.intensity !== 2 ? 1 : 0;
      const changedPredictability =
        decision.next.predictability !== PredictabilityMode.UserCountdown ? 1 : 0;
      const changedCategory = decision.next.category !== 'balloon-pop' ? 1 : 0;
      expect(changedIntensity + changedPredictability + changedCategory).toBeLessThanOrEqual(1);
    }
  });
});

describe('adaptive progression — hold', () => {
  it('holds with too few rated trials', () => {
    const trials = [makeTrial({ ratings: { startle: 1, distress: 0 } }), makeTrial()];
    const decision = decideProgression(trials, ctx());
    expect(decision.action).toBe('hold');
    expect(decision.next).toEqual(ctx().current);
  });

  it('holds when distress is moderate', () => {
    const decision = decideProgression(ratedBlock([2, 2, 2], [5, 4, 5]), ctx());
    expect(decision.action).toBe('hold');
  });

  it('holds when ratings trend upward', () => {
    const decision = decideProgression(ratedBlock([1, 2, 3, 3], [0, 0, 1, 1]), ctx());
    expect(decision.action).toBe('hold');
  });

  it('holds when anticipatory anxiety was high', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({ anticipatoryAnxiety: 8 }),
    );
    expect(decision.action).toBe('hold');
  });

  it('holds after one increase in the same session (gradual, multi-session)', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({ increasesThisSession: 1 }),
    );
    expect(decision.action).toBe('hold');
  });

  it('holds when the previous session struggled', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({ previousSessionStruggled: true }),
    );
    expect(decision.action).toBe('hold');
  });

  it('holds after a single pause', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [0, 0, 0]),
      ctx({ pauses: 1 }),
    );
    expect(decision.action).toBe('hold');
  });
});

describe('adaptive progression — decrease (regression to easier levels)', () => {
  it('decreases when distress is high, easing one dimension only', () => {
    const decision = decideProgression(ratedBlock([4, 5, 5], [8, 7, 8]), ctx());
    expect(decision.action).toBe('decrease');
    const easedIntensity = decision.next.intensity < 2;
    const easedPredictability =
      predictabilityRank(decision.next.predictability) <
      predictabilityRank(PredictabilityMode.UserCountdown);
    expect(Number(easedIntensity) + Number(easedPredictability)).toBe(1);
  });

  it('reverts the most recently increased dimension first', () => {
    const decision = decideProgression(
      ratedBlock([4, 5, 6], [7, 8, 8]),
      ctx({ lastIncreasedDimension: 'intensity' }),
    );
    expect(decision.action).toBe('decrease');
    expect(decision.dimension).toBe('intensity');
    expect(decision.next.intensity).toBe(1);
  });

  it('decreases when many trials were aborted, even without ratings', () => {
    const trials = [
      makeTrial({ outcome: 'aborted' }),
      makeTrial({ outcome: 'aborted' }),
      makeTrial({ ratings: { startle: 2, distress: 1 } }),
      makeTrial({ ratings: { startle: 2, distress: 1 } }),
    ];
    const decision = decideProgression(trials, ctx());
    expect(decision.action).toBe('decrease');
  });

  it('decreases when the block was paused repeatedly', () => {
    const decision = decideProgression(
      ratedBlock([1, 1, 1], [1, 1, 1]),
      ctx({ pauses: 2 }),
    );
    expect(decision.action).toBe('decrease');
  });

  it('decreases when recovery took very long', () => {
    const trials = [
      makeTrial({ ratings: { startle: 3, distress: 2, recovery: 'over-60s' } }),
      makeTrial({ ratings: { startle: 3, distress: 2, recovery: 'over-60s' } }),
    ];
    const decision = decideProgression(trials, ctx());
    expect(decision.action).toBe('decrease');
  });

  it('regression outranks progression-looking data', () => {
    // Low startle but rising distress trend → decrease wins.
    const decision = decideProgression(ratedBlock([1, 1, 1, 1, 1], [0, 1, 2, 3, 4]), ctx());
    expect(decision.action).toBe('decrease');
  });

  it('stays at the floor when already at the easiest settings', () => {
    const decision = decideProgression(
      ratedBlock([9, 9, 9], [9, 9, 9], {
        intensity: 1,
        predictability: PredictabilityMode.UserTriggered,
      }),
      ctx({
        current: {
          intensity: 1,
          amplitude: intensityToAmplitude(1),
          predictability: PredictabilityMode.UserTriggered,
          category: 'balloon-pop',
        },
      }),
    );
    expect(decision.action).toBe('decrease');
    expect(decision.next.intensity).toBe(1);
    expect(decision.next.predictability).toBe(PredictabilityMode.UserTriggered);
  });
});
