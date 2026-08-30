/**
 * Platform service interfaces ("ports"). Web implementations live in
 * `src/audio` and `src/storage`; a future Capacitor/native build replaces
 * them without touching the core logic.
 */
import type {
  PhysiologicalObservation,
  Session,
  Stimulus,
  Trial,
  UserSettings,
} from './types';

/** Result of scheduling one stimulus on the audio clock. */
export interface ScheduledStimulus {
  /** Audio-clock seconds the engine asked for. */
  intendedTime: number;
  /** Audio-clock seconds actually passed to the scheduler. */
  scheduledTime: number;
  /** Cancel this stimulus if it has not sounded yet. */
  cancel(): void;
}

/**
 * Schedules exposure stimuli on a high-precision audio clock.
 * Implemented by `WebAudioScheduler`; replaceable with a native scheduler.
 */
export interface AudioStimulusScheduler {
  /** Resume/create audio infrastructure. Must be called from a user gesture. */
  unlock(): Promise<void>;
  /** Decode/render and cache all buffers before a block starts. */
  preload(stimulusIds: string[]): Promise<void>;
  /** Current audio-clock time in seconds. */
  now(): number;
  /**
   * Schedule a stimulus at an absolute audio-clock time with an
   * application-level amplitude (0..1). Never touches system volume.
   */
  schedule(stimulusId: string, when: number, amplitude: number): ScheduledStimulus;
  /** Cancel every stimulus that has not sounded yet. */
  cancelAll(): void;
  /** List available stimuli. */
  listStimuli(): Stimulus[];
}

export interface SessionRepository {
  saveSession(session: Session): Promise<void>;
  getSession(id: string): Promise<Session | undefined>;
  listSessions(): Promise<Session[]>;
  saveTrial(trial: Trial): Promise<void>;
  listTrials(sessionId?: string): Promise<Trial[]>;
  getSettings(): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
  deleteAllData(): Promise<void>;
}

/** Future physiological sources (smartwatch HR, accelerometer, EMG…). */
export interface SensorProvider {
  readonly source: string;
  observations(fromTimestamp: number): AsyncIterable<PhysiologicalObservation>;
}

/** Deterministic random source; seeded in tests. */
export type RandomFn = () => number;

/** Clock abstraction (wall clock, ms since epoch). */
export type ClockFn = () => number;
