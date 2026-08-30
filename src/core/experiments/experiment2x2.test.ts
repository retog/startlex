import { describe, expect, it } from 'vitest';
import {
  MIN_OBSERVATIONS_PER_CONDITION,
  computeEffects,
  conditionSpecs,
  defaultDesign,
  generateConditionSequence,
  interpretEffects,
  summarizeByCondition,
  type ExperimentCondition,
} from './experiment2x2';
import { seededRandom } from '../random';
import { PredictabilityMode, intensityToAmplitude, type Trial } from '../types';

function experimentTrial(
  condition: ExperimentCondition,
  startle: number,
  distress: number,
  i: number,
): Trial {
  return {
    id: `e${condition}${i}`,
    sessionId: 's1',
    timestamp: i,
    stimulusId: 'pop-classic',
    stimulusCategory: 'balloon-pop',
    intensity: condition === 'B' || condition === 'D' ? 3 : 1,
    amplitude: intensityToAmplitude(condition === 'B' || condition === 'D' ? 3 : 1),
    predictability:
      condition === 'C' || condition === 'D'
        ? PredictabilityMode.WindowModerate
        : PredictabilityMode.UserCountdown,
    intendedDelaySec: 3,
    intendedAudioTime: 0,
    scheduledAudioTime: 0,
    userInitiated: false,
    visualContext: 'experiment',
    ratings: { startle, distress, recovery: null },
    outcome: 'completed',
    pausedDuring: false,
    experimentCondition: condition,
  };
}

describe('2x2 experiment design', () => {
  it('builds four conditions with only the intended factors varying', () => {
    const specs = conditionSpecs(defaultDesign(5));
    expect(specs.map((s) => s.condition)).toEqual(['A', 'B', 'C', 'D']);
    expect(specs[0].config.intensity).toBe(specs[2].config.intensity); // soft = soft
    expect(specs[1].config.intensity).toBe(specs[3].config.intensity); // strong = strong
    expect(specs[0].config.predictability).toBe(specs[1].config.predictability);
    expect(specs[2].config.predictability).toBe(specs[3].config.predictability);
  });

  it('respects the personal max intensity', () => {
    const design = defaultDesign(2);
    expect(design.strongIntensity).toBeLessThanOrEqual(2);
    expect(design.softIntensity).toBeGreaterThanOrEqual(1);
  });

  it('generates balanced block-randomized sequences', () => {
    const seq = generateConditionSequence(seededRandom(5), 6);
    expect(seq).toHaveLength(24);
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const c of seq) counts[c]++;
    expect(counts).toEqual({ A: 6, B: 6, C: 6, D: 6 });
    // Each block of 4 contains every condition exactly once.
    for (let b = 0; b < 6; b++) {
      const block = seq.slice(b * 4, b * 4 + 4);
      expect(new Set(block).size).toBe(4);
    }
  });

  it('randomization varies between seeds', () => {
    const a = generateConditionSequence(seededRandom(1), 4).join('');
    const b = generateConditionSequence(seededRandom(2), 4).join('');
    expect(a).not.toEqual(b);
  });
});

describe('2x2 experiment analysis', () => {
  it('computes per-condition summaries with sample sizes', () => {
    const trials = [
      experimentTrial('A', 2, 1, 1),
      experimentTrial('A', 4, 1, 2),
      experimentTrial('B', 6, 2, 3),
    ];
    const summaries = summarizeByCondition(trials);
    const a = summaries.find((s) => s.condition === 'A')!;
    expect(a.n).toBe(2);
    expect(a.meanStartle).toBe(3);
    const d = summaries.find((s) => s.condition === 'D')!;
    expect(d.n).toBe(0);
    expect(d.meanStartle).toBeNull();
  });

  it('computes main effects of intensity and predictability', () => {
    const trials: Trial[] = [];
    let i = 0;
    // Startle responds to predictability (+4), barely to intensity (+1).
    for (let k = 0; k < 5; k++) {
      trials.push(experimentTrial('A', 2, 1, i++));
      trials.push(experimentTrial('B', 3, 1, i++));
      trials.push(experimentTrial('C', 6, 2, i++));
      trials.push(experimentTrial('D', 7, 2, i++));
    }
    const effects = computeEffects(summarizeByCondition(trials));
    expect(effects.startlePredictabilityEffect).toBeCloseTo(4);
    expect(effects.startleIntensityEffect).toBeCloseTo(1);
    const interpretations = interpretEffects(effects);
    expect(
      interpretations.some((s) =>
        s.includes('startle') && s.includes('more strongly associated with unpredictability'),
      ),
    ).toBe(true);
    // Sample size disclosure is always included.
    expect(interpretations.some((s) => s.includes('rated trials per condition'))).toBe(true);
  });

  it('refuses to interpret small samples', () => {
    const trials = [
      experimentTrial('A', 2, 1, 1),
      experimentTrial('B', 3, 1, 2),
      experimentTrial('C', 6, 2, 3),
      experimentTrial('D', 7, 2, 4),
    ];
    const effects = computeEffects(summarizeByCondition(trials));
    expect(effects.minRatedPerCondition).toBeLessThan(MIN_OBSERVATIONS_PER_CONDITION);
    expect(interpretEffects(effects)).toEqual([]);
  });
});
