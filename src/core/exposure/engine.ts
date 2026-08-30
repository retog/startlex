/**
 * Exposure engine — runs one block of exposure trials.
 *
 * Platform-independent: audio goes through the injected
 * `AudioStimulusScheduler`, randomness through an injected RNG, wall-clock
 * time through an injected clock, and the UI drives `tick()` (e.g. from
 * requestAnimationFrame). Nothing here touches the DOM.
 *
 * SAFETY INVARIANTS (tested in engine.test.ts):
 *  - A stimulus is only ever scheduled from `armTrial()` while the engine is
 *    in the 'running' state.
 *  - `pause()` and `stop()` cancel every not-yet-sounded stimulus.
 *  - After a pause, sound can only resume through an explicit `resume()`
 *    call, which the UI must gate behind a user gesture.
 */
import type { AudioStimulusScheduler, ClockFn, RandomFn, ScheduledStimulus } from '../ports';
import {
  DELAY_WINDOWS,
  PredictabilityMode,
  type DifficultyConfig,
  type IntensityLevel,
  type Trial,
  type TrialRatings,
} from '../types';
import { newId, uniform } from '../random';
import { RatingSampler, type SamplingConfig } from '../rating/sampling';

export type EngineState =
  | 'idle' // block not started or finished
  | 'running' // block active, no trial armed — waiting for arm
  | 'pending' // trial armed, stimulus scheduled or awaiting window
  | 'rating' // waiting for the user to submit sampled ratings
  | 'paused'; // explicitly paused — nothing scheduled

export interface TrialPlan {
  trialId: string;
  predictability: PredictabilityMode;
  intendedDelaySec: number;
  /** Displayed window (what the user is told), seconds. */
  windowSec: { min: number; max: number };
  userInitiated: boolean;
  /** Audio-clock time of intended onset. */
  intendedAudioTime: number;
}

export type EngineEvent =
  | { type: 'armed'; plan: TrialPlan }
  | { type: 'sounded'; trial: Trial }
  | { type: 'rating-requested'; trialId: string }
  | { type: 'trial-completed'; trial: Trial }
  | { type: 'paused'; reason: PauseReason }
  | { type: 'resumed' }
  | { type: 'block-completed'; trials: Trial[] }
  | { type: 'intensity-capped'; effective: IntensityLevel };

export type PauseReason = 'user' | 'visibility' | 'audio';

export interface BlockOptions {
  sessionId: string;
  config: DifficultyConfig;
  trialsPlanned: number;
  visualContext: string;
  sampling: SamplingConfig;
  /** Trials at intensity >= 4 allowed in this block (null = no cap). */
  strongStimuliBudget: number | null;
  /** Never rate (used for warm-up / cool-down). */
  suppressRatings?: boolean;
}

const STRONG_INTENSITY: IntensityLevel = 4;
/** Small scheduling lead so the audio thread has time to start the source. */
const SCHEDULE_LEAD_SEC = 0.05;

export class ExposureEngine {
  private _state: EngineState = 'idle';
  private listeners: Array<(e: EngineEvent) => void> = [];
  private options: BlockOptions | null = null;
  private sampler: RatingSampler | null = null;
  private trials: Trial[] = [];
  private currentTrial: Trial | null = null;
  private currentPlan: TrialPlan | null = null;
  private scheduled: ScheduledStimulus | null = null;
  private stimulusIdsForCategory: string[] = [];
  private strongUsed = 0;
  private pausedDuringCurrent = false;

  constructor(
    private readonly scheduler: AudioStimulusScheduler,
    private readonly rng: RandomFn,
    private readonly clock: ClockFn = () => Date.now(),
  ) {}

  get state(): EngineState {
    return this._state;
  }

  get completedTrials(): readonly Trial[] {
    return this.trials;
  }

  get plan(): TrialPlan | null {
    return this.currentPlan;
  }

  get blockOptions(): BlockOptions | null {
    return this.options;
  }

  on(listener: (e: EngineEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(e: EngineEvent) {
    for (const l of [...this.listeners]) l(e);
  }

  /** Begin a block. Stimuli for the category must already be preloaded. */
  startBlock(options: BlockOptions): void {
    if (this._state !== 'idle') {
      throw new Error(`Cannot start block in state ${this._state}`);
    }
    const available = this.scheduler
      .listStimuli()
      .filter((s) => s.category === options.config.category)
      .map((s) => s.id);
    if (available.length === 0) {
      throw new Error(`No stimuli available for category ${options.config.category}`);
    }
    this.options = options;
    this.stimulusIdsForCategory = available;
    this.sampler = new RatingSampler(options.sampling, this.rng);
    this.trials = [];
    this.strongUsed = 0;
    this._state = 'running';
  }

  /** Number of trials still to run in this block. */
  get trialsRemaining(): number {
    if (!this.options) return 0;
    return Math.max(0, this.options.trialsPlanned - this.trials.length);
  }

  /**
   * Arm the next trial and schedule its stimulus.
   * For user-controlled modes the UI calls this from the user's gesture.
   * This is the ONLY code path that schedules a stimulus.
   */
  armTrial(userInitiated: boolean): TrialPlan {
    if (this._state !== 'running') {
      throw new Error(`Cannot arm trial in state ${this._state}`);
    }
    const options = this.options!;
    let config = options.config;

    // Enforce the per-session budget of stronger stimuli.
    if (
      config.intensity >= STRONG_INTENSITY &&
      options.strongStimuliBudget !== null &&
      this.strongUsed >= options.strongStimuliBudget
    ) {
      const capped: DifficultyConfig = {
        ...config,
        intensity: 3,
        amplitude: Math.min(config.amplitude, 0.16),
      };
      config = capped;
      this.emit({ type: 'intensity-capped', effective: 3 });
    }

    const window = DELAY_WINDOWS[config.predictability];
    const delay =
      window.minDelaySec === window.maxDelaySec
        ? window.minDelaySec
        : uniform(this.rng, window.minDelaySec, window.maxDelaySec);

    const stimulusId =
      this.stimulusIdsForCategory[
        Math.floor(this.rng() * this.stimulusIdsForCategory.length)
      ];

    const now = this.scheduler.now();
    const intendedAudioTime = now + SCHEDULE_LEAD_SEC + delay;
    const scheduled = this.scheduler.schedule(
      stimulusId,
      intendedAudioTime,
      config.amplitude,
    );

    if (config.intensity >= STRONG_INTENSITY) this.strongUsed += 1;

    const trialId = newId('trial');
    const plan: TrialPlan = {
      trialId,
      predictability: config.predictability,
      intendedDelaySec: delay,
      windowSec: { min: window.minDelaySec, max: window.maxDelaySec },
      userInitiated,
      intendedAudioTime,
    };

    this.currentTrial = {
      id: trialId,
      sessionId: options.sessionId,
      timestamp: this.clock(),
      stimulusId,
      stimulusCategory: config.category,
      intensity: config.intensity,
      amplitude: config.amplitude,
      predictability: config.predictability,
      intendedDelaySec: delay,
      intendedAudioTime: scheduled.intendedTime,
      scheduledAudioTime: scheduled.scheduledTime,
      userInitiated,
      visualContext: options.visualContext,
      ratings: { startle: null, distress: null, recovery: null },
      outcome: 'no-sound',
      pausedDuring: false,
      experimentCondition: null,
    };
    this.scheduled = scheduled;
    this.currentPlan = plan;
    this.pausedDuringCurrent = false;
    this._state = 'pending';
    this.emit({ type: 'armed', plan });
    return plan;
  }

  /** Seconds until intended onset for the pending trial (may be negative). */
  timeToOnset(): number | null {
    if (!this.currentPlan || this._state !== 'pending') return null;
    return this.currentPlan.intendedAudioTime - this.scheduler.now();
  }

  /**
   * Advance the engine. The UI calls this frequently (e.g. every animation
   * frame). Detects that a scheduled stimulus has sounded and moves on.
   */
  tick(): void {
    if (this._state !== 'pending' || !this.currentPlan || !this.currentTrial) return;
    if (this.scheduler.now() >= this.currentPlan.intendedAudioTime) {
      const trial = this.currentTrial;
      trial.outcome = 'completed';
      this.scheduled = null;
      this.emit({ type: 'sounded', trial: { ...trial } });
      const wantsRating =
        !this.options?.suppressRatings && this.sampler!.shouldSample();
      if (wantsRating) {
        this._state = 'rating';
        this.emit({ type: 'rating-requested', trialId: trial.id });
      } else {
        this.finishTrial();
      }
    }
  }

  /** Submit sampled ratings for the current trial. */
  submitRatings(ratings: TrialRatings): void {
    if (this._state !== 'rating' || !this.currentTrial) {
      throw new Error(`Cannot submit ratings in state ${this._state}`);
    }
    this.currentTrial.ratings = ratings;
    this.finishTrial();
  }

  /** User declined to rate — never punished. */
  skipRating(): void {
    if (this._state !== 'rating') return;
    this.finishTrial();
  }

  private finishTrial(): void {
    const trial = this.currentTrial!;
    trial.pausedDuring = this.pausedDuringCurrent;
    this.trials.push(trial);
    this.currentTrial = null;
    this.currentPlan = null;
    this.emit({ type: 'trial-completed', trial: { ...trial } });
    if (this.trials.length >= this.options!.trialsPlanned) {
      this._state = 'idle';
      this.emit({ type: 'block-completed', trials: [...this.trials] });
    } else {
      this._state = 'running';
    }
  }

  /**
   * Pause immediately: cancels any not-yet-sounded stimulus. The pending
   * trial is recorded as aborted ('no-sound'). Safe to call from any state.
   */
  pause(reason: PauseReason): void {
    if (this._state === 'paused' || this._state === 'idle') {
      // Still cancel defensively — e.g. visibility loss racing block end.
      this.scheduler.cancelAll();
      return;
    }
    this.scheduled?.cancel();
    this.scheduler.cancelAll();
    this.scheduled = null;
    if (this.currentTrial && this._state === 'pending') {
      const trial = this.currentTrial;
      trial.outcome = 'no-sound';
      trial.pausedDuring = true;
      this.trials.push(trial);
      this.emit({ type: 'trial-completed', trial: { ...trial } });
    }
    this.currentTrial = null;
    this.currentPlan = null;
    this.pausedDuringCurrent = true;
    this._state = 'paused';
    this.emit({ type: 'paused', reason });
  }

  /** Resume after pause. UI must call this from an explicit user gesture. */
  resume(): void {
    if (this._state !== 'paused') return;
    this._state = 'running';
    this.emit({ type: 'resumed' });
  }

  /** Abort the pending trial without pausing the block. */
  abortTrial(): void {
    if (this._state !== 'pending' || !this.currentTrial) return;
    this.scheduled?.cancel();
    this.scheduled = null;
    const trial = this.currentTrial;
    trial.outcome = 'aborted';
    this.trials.push(trial);
    this.currentTrial = null;
    this.currentPlan = null;
    this._state = 'running';
    this.emit({ type: 'trial-completed', trial: { ...trial } });
  }

  /** Stop the block entirely. Cancels all pending audio. */
  stop(): Trial[] {
    this.scheduled?.cancel();
    this.scheduler.cancelAll();
    this.scheduled = null;
    if (this.currentTrial) {
      const trial = this.currentTrial;
      trial.outcome = 'aborted';
      this.trials.push(trial);
      this.emit({ type: 'trial-completed', trial: { ...trial } });
      this.currentTrial = null;
      this.currentPlan = null;
    }
    const trials = [...this.trials];
    this._state = 'idle';
    this.options = null;
    return trials;
  }
}
