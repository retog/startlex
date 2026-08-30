/**
 * Synthetic impulse-sound generation.
 *
 * All MVP sounds are generated locally — nothing is downloaded and no
 * recordings are shipped, so there are no licensing constraints and the
 * sounds are clearly "training sounds", not realistic recordings
 * (see docs/ASSET_MANIFEST.md).
 *
 * Pure sample math (no Web Audio dependency) so synthesis is unit-testable
 * in Node. A pop = sharp band-passed noise burst + a low "body" thump,
 * both with exponential decay, normalized to peak 1.0.
 */
import type { RandomFn } from '../core/ports';

export interface PopParams {
  /** Total duration in seconds. */
  durationSec: number;
  /** Band-pass center frequency of the noise burst (Hz). */
  noiseFreqHz: number;
  /** Band-pass Q — higher = more tonal "snap". */
  noiseQ: number;
  /** Noise burst decay time constant (seconds). */
  noiseDecaySec: number;
  /** Low-frequency body thump frequency (Hz). */
  bodyFreqHz: number;
  /** Body decay time constant (seconds). */
  bodyDecaySec: number;
  /** Body level relative to noise burst (0..1). */
  bodyMix: number;
  /** Attack time (seconds) — softens the onset for gentler pops. */
  attackSec: number;
  /** Seed for the deterministic noise source. */
  seed: number;
}

/** Two-pole resonant band-pass filter (constant-skirt biquad). */
function makeBandpass(sampleRate: number, freqHz: number, q: number) {
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(omega);
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x0: number): number => {
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    return y0;
  };
}

function mulberry(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synthesizePop(params: PopParams, sampleRate = 44100): Float32Array {
  const n = Math.max(1, Math.round(params.durationSec * sampleRate));
  const out = new Float32Array(n);
  const rng = mulberry(params.seed);
  const bandpass = makeBandpass(sampleRate, params.noiseFreqHz, params.noiseQ);
  const attackSamples = Math.max(1, Math.round(params.attackSec * sampleRate));

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const attack = i < attackSamples ? i / attackSamples : 1;
    const noise = (rng() * 2 - 1) * Math.exp(-t / params.noiseDecaySec);
    const filtered = bandpass(noise);
    const body =
      Math.sin(2 * Math.PI * params.bodyFreqHz * t) *
      Math.exp(-t / params.bodyDecaySec) *
      params.bodyMix;
    out[i] = attack * (filtered + body);
  }

  // Normalize to peak 1.0; application amplitude is applied later via gain.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) {
    for (let i = 0; i < n; i++) out[i] /= peak;
  }
  // Short fade-out to avoid an end click.
  const fade = Math.min(n, Math.round(0.005 * sampleRate));
  for (let i = 0; i < fade; i++) {
    out[n - 1 - i] *= i / fade;
  }
  return out;
}
