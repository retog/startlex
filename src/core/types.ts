/**
 * Core domain types for Startle Trainer.
 *
 * Everything in `src/core` is platform-independent: no React, no DOM, no
 * Web Audio, no IndexedDB. Platform services are injected through the
 * interfaces defined in `src/core/ports.ts`.
 */

/** Relative application intensity level. NOT dB SPL — see SAFETY.md. */
export type IntensityLevel = 1 | 2 | 3 | 4 | 5;

export const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  1: 'Very soft',
  2: 'Soft',
  3: 'Moderate',
  4: 'Moderately strong',
  5: 'Strong',
};

/**
 * Predictability of stimulus onset (Dimension B).
 * Ordered from maximum user control to background/unattended events.
 */
export enum PredictabilityMode {
  /** L1 — user presses POP, sound occurs immediately. */
  UserTriggered = 'user-triggered',
  /** L2 — user initiates, visible 3-2-1 countdown, then pop. */
  UserCountdown = 'user-countdown',
  /** L3 — app initiates, fully predictable visible countdown. */
  AutoCountdown = 'auto-countdown',
  /** L4 — "pops within 3–5 s", randomized within a narrow window. */
  WindowNarrow = 'window-narrow',
  /** L5 — "pops within 3–10 s". */
  WindowModerate = 'window-moderate',
  /** L6 — unpredictable moment during a longer interval. */
  WindowWide = 'window-wide',
  /** L7 — several objects, only some produce the sound. */
  Probabilistic = 'probabilistic',
  /** L8 — unrelated visual task with occasional acoustic events. */
  Background = 'background',
}

/** Ordered ladder used by the adaptive engine. */
export const PREDICTABILITY_LADDER: PredictabilityMode[] = [
  PredictabilityMode.UserTriggered,
  PredictabilityMode.UserCountdown,
  PredictabilityMode.AutoCountdown,
  PredictabilityMode.WindowNarrow,
  PredictabilityMode.WindowModerate,
  PredictabilityMode.WindowWide,
  PredictabilityMode.Probabilistic,
  PredictabilityMode.Background,
];

export function predictabilityRank(mode: PredictabilityMode): number {
  return PREDICTABILITY_LADDER.indexOf(mode);
}

/** Onset delay windows (seconds) per predictability mode. */
export const DELAY_WINDOWS: Record<
  PredictabilityMode,
  { minDelaySec: number; maxDelaySec: number }
> = {
  [PredictabilityMode.UserTriggered]: { minDelaySec: 0, maxDelaySec: 0 },
  [PredictabilityMode.UserCountdown]: { minDelaySec: 3, maxDelaySec: 3 },
  [PredictabilityMode.AutoCountdown]: { minDelaySec: 3, maxDelaySec: 3 },
  [PredictabilityMode.WindowNarrow]: { minDelaySec: 3, maxDelaySec: 5 },
  [PredictabilityMode.WindowModerate]: { minDelaySec: 3, maxDelaySec: 10 },
  [PredictabilityMode.WindowWide]: { minDelaySec: 3, maxDelaySec: 20 },
  [PredictabilityMode.Probabilistic]: { minDelaySec: 3, maxDelaySec: 20 },
  [PredictabilityMode.Background]: { minDelaySec: 5, maxDelaySec: 30 },
};

export type StimulusCategory =
  | 'soft-pop'
  | 'balloon-pop'
  | 'champagne-cork'
  | 'dropped-light-object'
  | 'dropped-heavy-object'
  | 'door-closing'
  | 'door-slam'
  | 'distant-firework'
  | 'nearby-firework'
  | 'firecracker'
  | 'gunshot-like-synthetic';

export type StimulusSourceKind = 'synthetic' | 'recorded' | 'imported';

export interface Stimulus {
  id: string;
  category: StimulusCategory;
  description: string;
  /** Where the sound came from (synthesis parameters, license, file name…). */
  source: string;
  sourceKind: StimulusSourceKind;
  durationSec: number;
  /** Peak amplitude of the stored/rendered buffer, 0..1, before gain. */
  normalizedPeak: number;
}

/** 0–10 subjective ratings. Startle and fear/distress are NEVER merged. */
export type Rating0to10 = number;

export type RecoveryBucket =
  | 'under-5s'
  | '5-15s'
  | '15-30s'
  | '30-60s'
  | 'over-60s';

export const RECOVERY_BUCKETS: RecoveryBucket[] = [
  'under-5s',
  '5-15s',
  '15-30s',
  '30-60s',
  'over-60s',
];

/** Midpoint seconds per recovery bucket, for descriptive statistics only. */
export const RECOVERY_BUCKET_SECONDS: Record<RecoveryBucket, number> = {
  'under-5s': 2.5,
  '5-15s': 10,
  '15-30s': 22.5,
  '30-60s': 45,
  'over-60s': 75,
};

export type TrainingMode = 'balloon' | 'experiment';

/** Difficulty configuration for a training block. */
export interface DifficultyConfig {
  intensity: IntensityLevel;
  /** Fine-grained continuous amplitude 0..1 actually applied. */
  amplitude: number;
  predictability: PredictabilityMode;
  category: StimulusCategory;
}

export interface Session {
  id: string;
  /** ms since epoch */
  startedAt: number;
  endedAt: number | null;
  mode: TrainingMode;
  anticipatoryAnxiety: Rating0to10 | null;
  difficulty: DifficultyConfig;
  note: string | null;
  /** Set when the session was ended by an interruption (visibility loss…). */
  interrupted: boolean;
}

export type TrialOutcome = 'completed' | 'aborted' | 'no-sound';

export interface TrialRatings {
  startle: Rating0to10 | null;
  distress: Rating0to10 | null;
  recovery: RecoveryBucket | null;
}

export interface Trial {
  id: string;
  sessionId: string;
  /** ms since epoch when the trial started (was armed). */
  timestamp: number;
  stimulusId: string;
  stimulusCategory: StimulusCategory;
  intensity: IntensityLevel;
  /** Application-level amplitude 0..1 (relative, not dB SPL). */
  amplitude: number;
  predictability: PredictabilityMode;
  /** Delay chosen by the exposure engine, seconds from arm to intended onset. */
  intendedDelaySec: number;
  /**
   * Web Audio clock time (AudioContext.currentTime seconds) at which the
   * stimulus was actually scheduled, and the intended time, for audit.
   * Browser/hardware output latency is NOT calibrated; see SAFETY.md.
   */
  intendedAudioTime: number | null;
  scheduledAudioTime: number | null;
  userInitiated: boolean;
  visualContext: string;
  /** Present only when this trial was sampled for ratings. */
  ratings: TrialRatings;
  outcome: TrialOutcome;
  pausedDuring: boolean;
  /** Experimental-mode condition label (e.g. 'A'..'D'), null otherwise. */
  experimentCondition: string | null;
}

/** Extensible future physiological ingestion — NOT implemented in MVP. */
export interface PhysiologicalObservation {
  timestamp: number;
  source: string;
  measurementType: string;
  value: number;
  unit: string;
  quality: 'good' | 'uncertain' | 'poor' | 'unknown';
}

/** Which major dimension an adaptive change touched. */
export type AdaptiveDimension = 'intensity' | 'predictability' | 'sound';

/** Persisted adaptive progression state across sessions. */
export interface ProgressionState {
  current: DifficultyConfig;
  lastIncreasedDimension: AdaptiveDimension | null;
  /** True when the last session ended with a decrease or interruption. */
  lastSessionStruggled: boolean;
}

/** Persisted user settings. */
export interface UserSettings {
  /** Personal ceiling: the adaptive engine never exceeds this. */
  maxIntensity: IntensityLevel;
  /** Optional cap of stronger (level >= 4) stimuli per session. */
  maxStrongStimuliPerSession: number | null;
  /** Rating sampling: roughly one prompt every N trials. */
  ratingSamplingEveryNTrials: number;
  onboardingCompleted: boolean;
  calibrationCompleted: boolean;
  /** Screening answers (advisory only — never a diagnosis). */
  screeningFlags: string[];
  /** Adaptive progression state; null until the first session. */
  progression: ProgressionState | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  maxIntensity: 3,
  maxStrongStimuliPerSession: 5,
  ratingSamplingEveryNTrials: 4,
  onboardingCompleted: false,
  calibrationCompleted: false,
  screeningFlags: [],
  progression: null,
};

/** Map the coarse 1–5 intensity level to an application amplitude (0..1). */
export function intensityToAmplitude(level: IntensityLevel): number {
  // Perceptually spaced (~9 dB steps on the relative scale).
  const table: Record<IntensityLevel, number> = {
    1: 0.02,
    2: 0.06,
    3: 0.16,
    4: 0.4,
    5: 1.0,
  };
  return table[level];
}
