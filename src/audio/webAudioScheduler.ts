/**
 * Web Audio implementation of AudioStimulusScheduler.
 *
 * - Buffers are synthesized and cached up-front (`preload`) so decoding
 *   never happens at stimulus time.
 * - Stimuli are scheduled on the AudioContext clock (`source.start(when)`),
 *   so JS timer jitter does not determine onset.
 * - Amplitude is applied via per-stimulus GainNodes inside the app's own
 *   signal chain. The system/media volume is NEVER touched.
 * - `cancelAll()` silences and stops everything not yet sounded — used by
 *   pause/stop and the visibility guard.
 *
 * Note: browser + hardware output latency is not calibrated, so recorded
 * audio-clock times are for relative audit only, not millisecond claims.
 */
import type { AudioStimulusScheduler, ScheduledStimulus } from '../core/ports';
import type { Stimulus } from '../core/types';
import { SYNTHETIC_STIMULI } from './stimuli';
import { synthesizePop } from './synth';

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  when: number;
  cancelled: boolean;
}

export class WebAudioScheduler implements AudioStimulusScheduler {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private active = new Set<ActiveSource>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Must be called from a user gesture (autoplay policy is respected). */
  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async preload(stimulusIds: string[]): Promise<void> {
    const ctx = this.ensureContext();
    for (const id of stimulusIds) {
      if (this.buffers.has(id)) continue;
      const def = SYNTHETIC_STIMULI.find((d) => d.stimulus.id === id);
      if (!def) throw new Error(`Unknown stimulus: ${id}`);
      const samples = synthesizePop(def.params, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(new Float32Array(samples), 0);
      this.buffers.set(id, buffer);
    }
  }

  now(): number {
    return this.ensureContext().currentTime;
  }

  schedule(stimulusId: string, when: number, amplitude: number): ScheduledStimulus {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(stimulusId);
    if (!buffer) throw new Error(`Stimulus not preloaded: ${stimulusId}`);
    const clampedAmplitude = Math.min(1, Math.max(0, amplitude));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = clampedAmplitude;
    source.connect(gain);
    gain.connect(this.master!);

    const scheduledTime = Math.max(when, ctx.currentTime);
    source.start(scheduledTime);

    const entry: ActiveSource = { source, gain, when: scheduledTime, cancelled: false };
    this.active.add(entry);
    source.onended = () => {
      this.active.delete(entry);
      source.disconnect();
      gain.disconnect();
    };

    const cancel = () => {
      if (entry.cancelled) return;
      entry.cancelled = true;
      // Silence instantly in case stop() lands a hair late.
      gain.gain.setValueAtTime(0, ctx.currentTime);
      try {
        source.stop(0);
      } catch {
        // Already stopped — fine.
      }
      this.active.delete(entry);
    };

    return { intendedTime: when, scheduledTime, cancel };
  }

  cancelAll(): void {
    for (const entry of [...this.active]) {
      if (!this.ctx) break;
      entry.cancelled = true;
      entry.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      try {
        entry.source.stop(0);
      } catch {
        // Already stopped — fine.
      }
    }
    this.active.clear();
  }

  listStimuli(): Stimulus[] {
    return SYNTHETIC_STIMULI.map((d) => d.stimulus);
  }
}
