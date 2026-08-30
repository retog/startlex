/**
 * Experimental mode: 2 × 2 design (intensity × predictability) to explore
 * whether unpredictability or sound intensity is more strongly associated
 * with the user's reported responses.
 *
 * Conditions:
 *   A — softer  + predictable
 *   B — stronger + predictable
 *   C — softer  + unpredictable
 *   D — stronger + unpredictable
 *
 * Trials are block-randomized (each shuffled block contains every condition
 * once) so condition counts stay balanced. "Stronger" is bounded by the
 * user's personal maximum intensity.
 *
 * Interpretations are descriptive only — never diagnoses — and are withheld
 * below a minimum number of observations per condition.
 */
import type { RandomFn } from '../ports';
import { shuffle } from '../random';
import { mean } from '../statistics/descriptive';
import {
  PredictabilityMode,
  RECOVERY_BUCKET_SECONDS,
  intensityToAmplitude,
  type DifficultyConfig,
  type IntensityLevel,
  type StimulusCategory,
  type Trial,
} from '../types';

export type ExperimentCondition = 'A' | 'B' | 'C' | 'D';

export interface ExperimentConditionSpec {
  condition: ExperimentCondition;
  label: string;
  config: DifficultyConfig;
}

export interface ExperimentDesign {
  softIntensity: IntensityLevel;
  strongIntensity: IntensityLevel;
  predictableMode: PredictabilityMode;
  unpredictableMode: PredictabilityMode;
  category: StimulusCategory;
}

export function defaultDesign(
  maxIntensity: IntensityLevel,
  category: StimulusCategory = 'balloon-pop',
): ExperimentDesign {
  const strong = Math.min(maxIntensity, 3) as IntensityLevel;
  const soft = Math.max(1, strong - 2) as IntensityLevel;
  return {
    softIntensity: soft,
    strongIntensity: strong,
    predictableMode: PredictabilityMode.UserCountdown,
    unpredictableMode: PredictabilityMode.WindowModerate,
    category,
  };
}

export function conditionSpecs(design: ExperimentDesign): ExperimentConditionSpec[] {
  const mk = (
    condition: ExperimentCondition,
    label: string,
    intensity: IntensityLevel,
    predictability: PredictabilityMode,
  ): ExperimentConditionSpec => ({
    condition,
    label,
    config: {
      intensity,
      amplitude: intensityToAmplitude(intensity),
      predictability,
      category: design.category,
    },
  });
  return [
    mk('A', 'softer + predictable', design.softIntensity, design.predictableMode),
    mk('B', 'stronger + predictable', design.strongIntensity, design.predictableMode),
    mk('C', 'softer + unpredictable', design.softIntensity, design.unpredictableMode),
    mk('D', 'stronger + unpredictable', design.strongIntensity, design.unpredictableMode),
  ];
}

/**
 * Generate a balanced, block-randomized condition sequence.
 * `blocks` shuffled blocks of the 4 conditions → 4×blocks trials.
 */
export function generateConditionSequence(
  rng: RandomFn,
  blocks: number,
): ExperimentCondition[] {
  const all: ExperimentCondition[] = [];
  for (let b = 0; b < blocks; b++) {
    all.push(...shuffle(rng, ['A', 'B', 'C', 'D'] as const));
  }
  return all;
}

export interface ConditionSummary {
  condition: ExperimentCondition;
  n: number;
  nRated: number;
  meanStartle: number | null;
  meanDistress: number | null;
  meanRecoverySec: number | null;
}

export function summarizeByCondition(trials: readonly Trial[]): ConditionSummary[] {
  const conditions: ExperimentCondition[] = ['A', 'B', 'C', 'D'];
  return conditions.map((condition) => {
    const inCondition = trials.filter(
      (t) => t.experimentCondition === condition && t.outcome === 'completed',
    );
    const startle = inCondition
      .map((t) => t.ratings.startle)
      .filter((v): v is number => v !== null);
    const distress = inCondition
      .map((t) => t.ratings.distress)
      .filter((v): v is number => v !== null);
    const recovery = inCondition
      .map((t) => t.ratings.recovery)
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .map((b) => RECOVERY_BUCKET_SECONDS[b]);
    return {
      condition,
      n: inCondition.length,
      nRated: Math.max(startle.length, distress.length),
      meanStartle: mean(startle),
      meanDistress: mean(distress),
      meanRecoverySec: mean(recovery),
    };
  });
}

export interface ExperimentEffects {
  /** (stronger − softer), averaged over predictability. */
  startleIntensityEffect: number | null;
  /** (unpredictable − predictable), averaged over intensity. */
  startlePredictabilityEffect: number | null;
  distressIntensityEffect: number | null;
  distressPredictabilityEffect: number | null;
  minRatedPerCondition: number;
}

/** Observations of each condition required before any interpretation. */
export const MIN_OBSERVATIONS_PER_CONDITION = 4;

export function computeEffects(summaries: ConditionSummary[]): ExperimentEffects {
  const byCondition = new Map(summaries.map((s) => [s.condition, s]));
  const a = byCondition.get('A')!;
  const b = byCondition.get('B')!;
  const c = byCondition.get('C')!;
  const d = byCondition.get('D')!;
  const minRated = Math.min(a.nRated, b.nRated, c.nRated, d.nRated);

  const effect = (
    hi1: number | null, hi2: number | null,
    lo1: number | null, lo2: number | null,
  ): number | null => {
    if (hi1 === null || hi2 === null || lo1 === null || lo2 === null) return null;
    return (hi1 + hi2) / 2 - (lo1 + lo2) / 2;
  };

  return {
    startleIntensityEffect: effect(b.meanStartle, d.meanStartle, a.meanStartle, c.meanStartle),
    startlePredictabilityEffect: effect(c.meanStartle, d.meanStartle, a.meanStartle, b.meanStartle),
    distressIntensityEffect: effect(b.meanDistress, d.meanDistress, a.meanDistress, c.meanDistress),
    distressPredictabilityEffect: effect(c.meanDistress, d.meanDistress, a.meanDistress, b.meanDistress),
    minRatedPerCondition: minRated,
  };
}

/**
 * Cautious, descriptive interpretation. Returns [] when there is not enough
 * data. Wording avoids causal or diagnostic claims by design.
 */
export function interpretEffects(effects: ExperimentEffects): string[] {
  if (effects.minRatedPerCondition < MIN_OBSERVATIONS_PER_CONDITION) return [];
  const out: string[] = [];
  const describe = (
    name: 'startle' | 'distress',
    intensityEffect: number | null,
    predictabilityEffect: number | null,
  ) => {
    if (intensityEffect === null || predictabilityEffect === null) return;
    const ai = Math.abs(intensityEffect);
    const ap = Math.abs(predictabilityEffect);
    if (ai < 0.5 && ap < 0.5) {
      out.push(
        `Your reported ${name} ratings were similar across intensity and predictability conditions so far.`,
      );
    } else if (ap > ai + 0.5) {
      out.push(
        `Your reported ${name} ratings appear more strongly associated with unpredictability than with sound intensity.`,
      );
    } else if (ai > ap + 0.5) {
      out.push(
        `Your reported ${name} ratings appear more strongly associated with sound intensity than with unpredictability.`,
      );
    } else {
      out.push(
        `Sound intensity and unpredictability appear similarly associated with your reported ${name} ratings.`,
      );
    }
  };
  describe('startle', effects.startleIntensityEffect, effects.startlePredictabilityEffect);
  describe('distress', effects.distressIntensityEffect, effects.distressPredictabilityEffect);
  out.push(
    `These are descriptive observations based on at least ${effects.minRatedPerCondition} rated trials per condition — not a diagnosis or a medical conclusion.`,
  );
  return out;
}
