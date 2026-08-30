/** Descriptive statistics over one completed block of trials. */
import { mean, median, trendSlope } from '../statistics/descriptive';
import { RECOVERY_BUCKET_SECONDS, type Trial } from '../types';

export interface BlockStats {
  totalTrials: number;
  completedTrials: number;
  abortedTrials: number;
  unsoundedTrials: number;
  ratedTrials: number;
  meanStartle: number | null;
  medianStartle: number | null;
  meanDistress: number | null;
  medianDistress: number | null;
  startleTrend: number | null;
  distressTrend: number | null;
  meanRecoverySec: number | null;
}

export function computeBlockStats(trials: readonly Trial[]): BlockStats {
  const completed = trials.filter((t) => t.outcome === 'completed');
  const aborted = trials.filter((t) => t.outcome === 'aborted');
  const unsounded = trials.filter((t) => t.outcome === 'no-sound');

  const startle = completed
    .map((t) => t.ratings.startle)
    .filter((v): v is number => v !== null);
  const distress = completed
    .map((t) => t.ratings.distress)
    .filter((v): v is number => v !== null);
  const recovery = completed
    .map((t) => t.ratings.recovery)
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .map((b) => RECOVERY_BUCKET_SECONDS[b]);

  const rated = completed.filter(
    (t) => t.ratings.startle !== null || t.ratings.distress !== null,
  ).length;

  return {
    totalTrials: trials.length,
    completedTrials: completed.length,
    abortedTrials: aborted.length,
    unsoundedTrials: unsounded.length,
    ratedTrials: rated,
    meanStartle: mean(startle),
    medianStartle: median(startle),
    meanDistress: mean(distress),
    medianDistress: median(distress),
    startleTrend: trendSlope(startle),
    distressTrend: trendSlope(distress),
    meanRecoverySec: mean(recovery),
  };
}
