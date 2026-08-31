/**
 * Stimulus library: all sounds synthesized in-app. See docs/ASSET_MANIFEST.md.
 * No recordings are shipped; gunshot-like sounds are deliberately absent.
 * Categories: balloon-pop, door-closing, dropped-light-object,
 * distant-firework.
 */
import type { Stimulus } from '../core/types';
import type { PopParams } from './synth';

export interface SyntheticStimulusDef {
  stimulus: Stimulus;
  params: PopParams;
}

export const SYNTHETIC_STIMULI: SyntheticStimulusDef[] = [
  {
    stimulus: {
      id: 'pop-soft',
      category: 'balloon-pop',
      description: 'Soft muffled pop with a gentle attack',
      source: 'synthesized in-app (audio/synth.ts, seed 101)',
      sourceKind: 'synthetic',
      durationSec: 0.28,
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.28,
      noiseFreqHz: 650,
      noiseQ: 1.2,
      noiseDecaySec: 0.05,
      bodyFreqHz: 120,
      bodyDecaySec: 0.09,
      bodyMix: 0.5,
      attackSec: 0.008,
      seed: 101,
    },
  },
  {
    stimulus: {
      id: 'pop-classic',
      category: 'balloon-pop',
      description: 'Classic sharp balloon pop',
      source: 'synthesized in-app (audio/synth.ts, seed 202)',
      sourceKind: 'synthetic',
      durationSec: 0.22,
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.22,
      noiseFreqHz: 1600,
      noiseQ: 0.9,
      noiseDecaySec: 0.03,
      bodyFreqHz: 180,
      bodyDecaySec: 0.05,
      bodyMix: 0.35,
      attackSec: 0.001,
      seed: 202,
    },
  },
  {
    stimulus: {
      id: 'pop-deep',
      category: 'balloon-pop',
      description: 'Deeper, rounder pop',
      source: 'synthesized in-app (audio/synth.ts, seed 303)',
      sourceKind: 'synthetic',
      durationSec: 0.35,
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.35,
      noiseFreqHz: 380,
      noiseQ: 1.5,
      noiseDecaySec: 0.06,
      bodyFreqHz: 85,
      bodyDecaySec: 0.14,
      bodyMix: 0.7,
      attackSec: 0.004,
      seed: 303,
    },
  },
  {
    stimulus: {
      id: 'door-soft',
      category: 'door-closing',
      description: 'Door closing gently with a soft latch click',
      source: 'synthesized in-app (audio/synth.ts, seed 404)',
      sourceKind: 'synthetic',
      durationSec: 0.49, // 0.42 s impulse + 70 ms latch offset
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.42,
      noiseFreqHz: 280,
      noiseQ: 1.1,
      noiseDecaySec: 0.05,
      bodyFreqHz: 110,
      bodyDecaySec: 0.16,
      bodyMix: 0.9,
      attackSec: 0.006,
      seed: 404,
      secondTransient: { delaySec: 0.07, gain: 0.45 },
    },
  },
  {
    stimulus: {
      id: 'door-firm',
      category: 'door-closing',
      description: 'Door closing firmly',
      source: 'synthesized in-app (audio/synth.ts, seed 505)',
      sourceKind: 'synthetic',
      durationSec: 0.5, // 0.45 s impulse + 50 ms latch offset
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.45,
      noiseFreqHz: 500,
      noiseQ: 0.9,
      noiseDecaySec: 0.045,
      bodyFreqHz: 90,
      bodyDecaySec: 0.13,
      bodyMix: 0.8,
      attackSec: 0.002,
      seed: 505,
      secondTransient: { delaySec: 0.05, gain: 0.35 },
    },
  },
  {
    stimulus: {
      id: 'drop-wood',
      category: 'dropped-light-object',
      description: 'Light wooden object dropped, with one bounce',
      source: 'synthesized in-app (audio/synth.ts, seed 606)',
      sourceKind: 'synthetic',
      durationSec: 0.48, // 0.3 s impulse + 180 ms bounce offset
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.3,
      noiseFreqHz: 700,
      noiseQ: 1.4,
      noiseDecaySec: 0.035,
      bodyFreqHz: 160,
      bodyDecaySec: 0.07,
      bodyMix: 0.55,
      attackSec: 0.002,
      seed: 606,
      secondTransient: { delaySec: 0.18, gain: 0.5 },
    },
  },
  {
    stimulus: {
      id: 'drop-metal',
      category: 'dropped-light-object',
      description: 'Small metal object dropped, with a ringing bounce',
      source: 'synthesized in-app (audio/synth.ts, seed 707)',
      sourceKind: 'synthetic',
      durationSec: 0.5, // 0.35 s impulse + 150 ms bounce offset
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.35,
      noiseFreqHz: 2400,
      noiseQ: 3.5,
      noiseDecaySec: 0.05,
      bodyFreqHz: 320,
      bodyDecaySec: 0.09,
      bodyMix: 0.3,
      attackSec: 0.001,
      seed: 707,
      secondTransient: { delaySec: 0.15, gain: 0.55 },
    },
  },
  {
    stimulus: {
      id: 'firework-far',
      category: 'distant-firework',
      description: 'Distant firework boom, muffled with a long soft tail',
      source: 'synthesized in-app (audio/synth.ts, seed 808)',
      sourceKind: 'synthetic',
      durationSec: 0.9,
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.9,
      noiseFreqHz: 180,
      noiseQ: 0.8,
      noiseDecaySec: 0.22,
      bodyFreqHz: 65,
      bodyDecaySec: 0.35,
      bodyMix: 1.0,
      attackSec: 0.015,
      seed: 808,
    },
  },
  {
    stimulus: {
      id: 'firework-burst',
      category: 'distant-firework',
      description: 'Distant firework burst with a faint echo',
      source: 'synthesized in-app (audio/synth.ts, seed 909)',
      sourceKind: 'synthetic',
      durationSec: 0.95, // 0.7 s impulse + 250 ms echo offset
      normalizedPeak: 1,
    },
    params: {
      durationSec: 0.7,
      noiseFreqHz: 420,
      noiseQ: 0.9,
      noiseDecaySec: 0.12,
      bodyFreqHz: 80,
      bodyDecaySec: 0.28,
      bodyMix: 0.85,
      attackSec: 0.008,
      seed: 909,
      secondTransient: { delaySec: 0.25, gain: 0.3 },
    },
  },
];
