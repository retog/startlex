/**
 * Adaptive exposure progression.
 *
 * Full rule documentation: ADAPTIVE_ALGORITHM.md. Key principles:
 *  - Decisions are made per BLOCK, never per trial.
 *  - At most ONE major dimension changes at a time, so the effect of each
 *    change on the user's response stays interpretable.
 *  - Regression (easing) always outranks progression.
 *  - At most one increase per session; progression is spread across sessions.
 *  - The user's personal maximum intensity is never exceeded, and the user
 *    can always override any recommendation manually.
 */
import {
  PREDICTABILITY_LADDER,
  PredictabilityMode,
  intensityToAmplitude,
  predictabilityRank,
  type DifficultyConfig,
  type IntensityLevel,
  type Trial,
} from '../types';
import type { AdaptiveDimension } from '../types';
import { computeBlockStats, type BlockStats } from './blockStats';

export type { AdaptiveDimension };

export interface AdaptiveContext {
  /** Difficulty the block was run at. */
  current: DifficultyConfig;
  /** Anticipatory anxiety reported at session check-in (0–10) or null. */
  anticipatoryAnxiety: number | null;
  /** Number of pauses during the block. */
  pauses: number;
  /** Dimension changed by the most recent increase, if any. */
  lastIncreasedDimension: AdaptiveDimension | null;
  /** Increases already granted in this session. */
  increasesThisSession: number;
  /** Whether the previous session ended with a decrease or interruption. */
  previousSessionStruggled: boolean;
  /** Personal ceiling from user settings. */
  maxIntensity: IntensityLevel;
  /** Highest predictability level currently unlocked by the app build. */
  maxPredictability: PredictabilityMode;
}

export interface AdaptiveDecision {
  action: 'increase' | 'hold' | 'decrease';
  dimension: AdaptiveDimension | null;
  next: DifficultyConfig;
  rationale: string[];
  stats: BlockStats;
}

/* Thresholds — see ADAPTIVE_ALGORITHM.md for the documented rationale. */
const DISTRESS_DECREASE = 7;
const STARTLE_DECREASE = 8;
const ABORT_FRACTION_DECREASE = 0.25;
const PAUSES_DECREASE = 2;
const DISTRESS_TREND_DECREASE = 0.5; // rating points per trial
const RECOVERY_DECREASE_SEC = 60;

const DISTRESS_HOLD = 4;
const STARTLE_HOLD = 6;
const ANXIETY_HOLD = 7;
const TREND_HOLD = 0.15;

const MIN_RATED_FOR_INCREASE = 2;

function stepIntensity(level: IntensityLevel, delta: 1 | -1): IntensityLevel {
  return Math.min(5, Math.max(1, level + delta)) as IntensityLevel;
}

function stepPredictability(
  mode: PredictabilityMode,
  delta: 1 | -1,
): PredictabilityMode {
  const rank = predictabilityRank(mode);
  const next = Math.min(
    PREDICTABILITY_LADDER.length - 1,
    Math.max(0, rank + delta),
  );
  return PREDICTABILITY_LADDER[next];
}

function withIntensity(c: DifficultyConfig, level: IntensityLevel): DifficultyConfig {
  return { ...c, intensity: level, amplitude: intensityToAmplitude(level) };
}

export function decideProgression(
  trials: readonly Trial[],
  ctx: AdaptiveContext,
): AdaptiveDecision {
  const stats = computeBlockStats(trials);
  const current = ctx.current;

  const abortFraction =
    stats.totalTrials > 0 ? stats.abortedTrials / stats.totalTrials : 0;

  /* ---- 1. Regression checks (always first, never overridden) ---- */
  const decreaseReasons: string[] = [];
  if (stats.meanDistress !== null && stats.meanDistress >= DISTRESS_DECREASE)
    decreaseReasons.push(`mean distress ${stats.meanDistress.toFixed(1)} was high`);
  if (stats.meanStartle !== null && stats.meanStartle >= STARTLE_DECREASE)
    decreaseReasons.push(`mean startle ${stats.meanStartle.toFixed(1)} was very high`);
  if (abortFraction > ABORT_FRACTION_DECREASE)
    decreaseReasons.push(`${stats.abortedTrials} of ${stats.totalTrials} trials were stopped early`);
  if (ctx.pauses >= PAUSES_DECREASE)
    decreaseReasons.push(`the block was paused ${ctx.pauses} times`);
  if (stats.distressTrend !== null && stats.distressTrend > DISTRESS_TREND_DECREASE)
    decreaseReasons.push('distress rose across the block');
  if (stats.meanRecoverySec !== null && stats.meanRecoverySec > RECOVERY_DECREASE_SEC)
    decreaseReasons.push('recovery took over a minute on average');

  if (decreaseReasons.length > 0) {
    const eased = easeOneDimension(current, ctx);
    return {
      action: 'decrease',
      dimension: eased.dimension,
      next: eased.next,
      rationale: decreaseReasons.concat(eased.note),
      stats,
    };
  }

  /* ---- 2. Hold checks ---- */
  const holdReasons: string[] = [];
  if (stats.ratedTrials < MIN_RATED_FOR_INCREASE)
    holdReasons.push('not enough rated trials yet to judge progression');
  if (stats.meanDistress !== null && stats.meanDistress >= DISTRESS_HOLD)
    holdReasons.push('distress is still moderate');
  if (stats.meanStartle !== null && stats.meanStartle >= STARTLE_HOLD)
    holdReasons.push('startle is still fairly strong');
  if (
    (stats.startleTrend !== null && stats.startleTrend > TREND_HOLD) ||
    (stats.distressTrend !== null && stats.distressTrend > TREND_HOLD)
  )
    holdReasons.push('ratings were trending upward');
  if (ctx.anticipatoryAnxiety !== null && ctx.anticipatoryAnxiety >= ANXIETY_HOLD)
    holdReasons.push('anticipatory anxiety was high today');
  if (ctx.pauses > 0) holdReasons.push('the block was paused');
  if (abortFraction > 0) holdReasons.push('some trials were stopped early');
  if (ctx.previousSessionStruggled)
    holdReasons.push('the previous session was difficult — consolidating first');
  if (ctx.increasesThisSession >= 1)
    holdReasons.push('difficulty already changed once this session');

  if (holdReasons.length > 0) {
    return { action: 'hold', dimension: null, next: current, rationale: holdReasons, stats };
  }

  /* ---- 3. Progression: raise exactly ONE dimension by one step ---- */
  const raised = raiseOneDimension(current, ctx);
  if (raised === null) {
    return {
      action: 'hold',
      dimension: null,
      next: current,
      rationale: ['already at the configured maximum for every dimension'],
      stats,
    };
  }
  return {
    action: 'increase',
    dimension: raised.dimension,
    next: raised.next,
    rationale: [
      'ratings were low and stable across the block',
      raised.note,
    ],
    stats,
  };
}

/**
 * Pick the single dimension to raise. Control is reduced before loudness:
 * predictability advances first; once at the unlocked predictability cap,
 * intensity advances (never above the user's ceiling). The dimension raised
 * last time is avoided when an alternative is available, so successive
 * changes alternate and stay interpretable.
 */
function raiseOneDimension(
  current: DifficultyConfig,
  ctx: AdaptiveContext,
): { dimension: AdaptiveDimension; next: DifficultyConfig; note: string } | null {
  const canRaisePredictability =
    predictabilityRank(current.predictability) <
    predictabilityRank(ctx.maxPredictability);
  const canRaiseIntensity = current.intensity < ctx.maxIntensity;

  const preferIntensity =
    ctx.lastIncreasedDimension === 'predictability' && canRaiseIntensity;

  if (canRaisePredictability && !preferIntensity) {
    return {
      dimension: 'predictability',
      next: { ...current, predictability: stepPredictability(current.predictability, 1) },
      note: 'keeping loudness the same and making timing slightly less predictable',
    };
  }
  if (canRaiseIntensity) {
    return {
      dimension: 'intensity',
      next: withIntensity(current, stepIntensity(current.intensity, 1)),
      note: 'keeping timing the same and making the sound slightly stronger',
    };
  }
  if (canRaisePredictability) {
    return {
      dimension: 'predictability',
      next: { ...current, predictability: stepPredictability(current.predictability, 1) },
      note: 'keeping loudness the same and making timing slightly less predictable',
    };
  }
  return null;
}

/**
 * Ease exactly one dimension. Prefer reverting the most recently increased
 * dimension; otherwise ease whichever dimension is further along.
 */
function easeOneDimension(
  current: DifficultyConfig,
  ctx: AdaptiveContext,
): { dimension: AdaptiveDimension; next: DifficultyConfig; note: string } {
  const easePredictability = () => ({
    dimension: 'predictability' as const,
    next: { ...current, predictability: stepPredictability(current.predictability, -1) },
    note: 'easing back to a more predictable timing',
  });
  const easeIntensity = () => ({
    dimension: 'intensity' as const,
    next: withIntensity(current, stepIntensity(current.intensity, -1)),
    note: 'easing back to a softer sound',
  });

  if (ctx.lastIncreasedDimension === 'intensity' && current.intensity > 1)
    return easeIntensity();
  if (
    ctx.lastIncreasedDimension === 'predictability' &&
    predictabilityRank(current.predictability) > 0
  )
    return easePredictability();
  // No recent increase to revert: ease the further-advanced dimension.
  if (predictabilityRank(current.predictability) >= current.intensity - 1 &&
      predictabilityRank(current.predictability) > 0)
    return easePredictability();
  if (current.intensity > 1) return easeIntensity();
  if (predictabilityRank(current.predictability) > 0) return easePredictability();
  return {
    dimension: 'intensity',
    next: current,
    note: 'already at the easiest settings — staying there',
  };
}
