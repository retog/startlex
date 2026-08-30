/**
 * MVP stimulus library: three synthetic pops. See docs/ASSET_MANIFEST.md.
 * No recordings are shipped; gunshot-like sounds are deliberately absent.
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
];
