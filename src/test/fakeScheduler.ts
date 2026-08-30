/**
 * Deterministic in-memory AudioStimulusScheduler for tests.
 * Time advances only via `advance()`.
 */
import type { AudioStimulusScheduler, ScheduledStimulus } from '../core/ports';
import type { Stimulus } from '../core/types';
import { SYNTHETIC_STIMULI } from '../audio/stimuli';

export interface FakeScheduledRecord {
  stimulusId: string;
  when: number;
  amplitude: number;
  cancelled: boolean;
}

export class FakeScheduler implements AudioStimulusScheduler {
  time = 0;
  scheduledRecords: FakeScheduledRecord[] = [];
  preloaded: string[] = [];
  cancelAllCalls = 0;

  advance(seconds: number): void {
    this.time += seconds;
  }

  async unlock(): Promise<void> {}

  async preload(stimulusIds: string[]): Promise<void> {
    this.preloaded.push(...stimulusIds);
  }

  now(): number {
    return this.time;
  }

  schedule(stimulusId: string, when: number, amplitude: number): ScheduledStimulus {
    const record: FakeScheduledRecord = {
      stimulusId,
      when,
      amplitude,
      cancelled: false,
    };
    this.scheduledRecords.push(record);
    return {
      intendedTime: when,
      scheduledTime: Math.max(when, this.time),
      cancel: () => {
        if (when > this.time) record.cancelled = true;
      },
    };
  }

  cancelAll(): void {
    this.cancelAllCalls += 1;
    for (const r of this.scheduledRecords) {
      if (r.when > this.time) r.cancelled = true;
    }
  }

  listStimuli(): Stimulus[] {
    return SYNTHETIC_STIMULI.map((d) => d.stimulus);
  }

  /** Records that actually sounded (not cancelled, time reached). */
  get sounded(): FakeScheduledRecord[] {
    return this.scheduledRecords.filter((r) => !r.cancelled && r.when <= this.time);
  }
}
