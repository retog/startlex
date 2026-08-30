import { describe, expect, it } from 'vitest';
import { ExposureEngine, type BlockOptions, type EngineEvent } from './engine';
import { VisibilityGuard } from './visibilityGuard';
import { FakeScheduler } from '../../test/fakeScheduler';
import { seededRandom } from '../random';
import {
  DELAY_WINDOWS,
  PredictabilityMode,
  intensityToAmplitude,
  type DifficultyConfig,
} from '../types';

function makeEngine(seed = 42) {
  const scheduler = new FakeScheduler();
  const engine = new ExposureEngine(scheduler, seededRandom(seed), () => 1_000_000);
  const events: EngineEvent[] = [];
  engine.on((e) => events.push(e));
  return { scheduler, engine, events };
}

function config(overrides: Partial<DifficultyConfig> = {}): DifficultyConfig {
  return {
    intensity: 2,
    amplitude: intensityToAmplitude(2),
    predictability: PredictabilityMode.UserTriggered,
    category: 'balloon-pop',
    ...overrides,
  };
}

function options(overrides: Partial<BlockOptions> = {}): BlockOptions {
  return {
    sessionId: 's1',
    config: config(overrides.config ? overrides.config : {}),
    trialsPlanned: 3,
    visualContext: 'balloon-basic',
    sampling: { everyNTrials: 1, minGap: 0 },
    strongStimuliBudget: null,
    ...overrides,
  };
}

describe('ExposureEngine — basic lifecycle', () => {
  it('runs a full user-triggered block', () => {
    const { scheduler, engine, events } = makeEngine();
    engine.startBlock(options({ sampling: { everyNTrials: 99, minGap: 99 }, suppressRatings: true }));
    expect(engine.state).toBe('running');

    for (let i = 0; i < 3; i++) {
      engine.armTrial(true);
      expect(engine.state).toBe('pending');
      scheduler.advance(0.1); // past the schedule lead
      engine.tick();
    }
    expect(engine.state).toBe('idle');
    const completed = events.filter((e) => e.type === 'trial-completed');
    expect(completed).toHaveLength(3);
    expect(events.some((e) => e.type === 'block-completed')).toBe(true);
    expect(scheduler.sounded).toHaveLength(3);
  });

  it('cannot arm a trial before a block starts or while pending', () => {
    const { engine } = makeEngine();
    expect(() => engine.armTrial(true)).toThrow();
    engine.startBlock(options());
    engine.armTrial(true);
    expect(() => engine.armTrial(true)).toThrow();
  });

  it('records amplitude and delay on the scheduled stimulus', () => {
    const { scheduler, engine } = makeEngine();
    engine.startBlock(
      options({
        config: config({
          predictability: PredictabilityMode.UserCountdown,
          intensity: 3,
          amplitude: intensityToAmplitude(3),
        }),
      }),
    );
    const plan = engine.armTrial(true);
    expect(plan.intendedDelaySec).toBe(3);
    const record = scheduler.scheduledRecords[0];
    expect(record.amplitude).toBeCloseTo(intensityToAmplitude(3));
    expect(record.when).toBeCloseTo(3.05, 5); // 3 s countdown + 50 ms lead
  });
});

describe('ExposureEngine — randomized delay windows', () => {
  it.each([
    [PredictabilityMode.WindowNarrow],
    [PredictabilityMode.WindowModerate],
    [PredictabilityMode.WindowWide],
  ])('keeps every %s delay inside the declared window', (mode) => {
    const window = DELAY_WINDOWS[mode];
    for (let seed = 1; seed <= 50; seed++) {
      const { scheduler, engine } = makeEngine(seed);
      engine.startBlock(
        options({ config: config({ predictability: mode }), trialsPlanned: 1 }),
      );
      const plan = engine.armTrial(false);
      expect(plan.intendedDelaySec).toBeGreaterThanOrEqual(window.minDelaySec);
      expect(plan.intendedDelaySec).toBeLessThan(window.maxDelaySec);
      expect(plan.windowSec).toEqual({
        min: window.minDelaySec,
        max: window.maxDelaySec,
      });
      scheduler.advance(window.maxDelaySec + 1);
      engine.tick();
      expect(engine.state).not.toBe('pending');
    }
  });

  it('produces varying delays across trials', () => {
    const { scheduler, engine } = makeEngine(7);
    engine.startBlock(
      options({
        config: config({ predictability: PredictabilityMode.WindowModerate }),
        trialsPlanned: 10,
        sampling: { everyNTrials: 99, minGap: 99 }, suppressRatings: true,
      }),
    );
    const delays: number[] = [];
    for (let i = 0; i < 10; i++) {
      const plan = engine.armTrial(false);
      delays.push(plan.intendedDelaySec);
      scheduler.advance(11);
      engine.tick();
    }
    expect(new Set(delays.map((d) => d.toFixed(3))).size).toBeGreaterThan(5);
  });
});

describe('ExposureEngine — SAFETY: pause, stop, visibility', () => {
  it('pause cancels the pending stimulus so it never sounds', () => {
    const { scheduler, engine } = makeEngine();
    engine.startBlock(
      options({ config: config({ predictability: PredictabilityMode.WindowNarrow }) }),
    );
    engine.armTrial(false);
    engine.pause('user');
    scheduler.advance(60);
    engine.tick();
    expect(scheduler.sounded).toHaveLength(0);
    expect(scheduler.scheduledRecords[0].cancelled).toBe(true);
    expect(engine.state).toBe('paused');
  });

  it('never schedules stimuli while paused, and resume requires an explicit call', () => {
    const { scheduler, engine } = makeEngine();
    engine.startBlock(options());
    engine.pause('user');
    expect(() => engine.armTrial(true)).toThrow();
    expect(scheduler.scheduledRecords).toHaveLength(0);
    engine.resume();
    expect(engine.state).toBe('running');
    engine.armTrial(true);
    expect(scheduler.scheduledRecords).toHaveLength(1);
  });

  it('visibility loss pauses training and cancels pending sound', () => {
    const { scheduler, engine } = makeEngine();
    const guard = new VisibilityGuard(engine);
    engine.startBlock(
      options({ config: config({ predictability: PredictabilityMode.WindowWide }) }),
    );
    engine.armTrial(false);
    guard.handleVisibilityChange(false);
    scheduler.advance(120);
    engine.tick();
    expect(scheduler.sounded).toHaveLength(0);
    expect(engine.state).toBe('paused');
    expect(guard.interrupted).toBe(true);
    // Regaining visibility must NOT resume by itself.
    guard.handleVisibilityChange(true);
    expect(engine.state).toBe('paused');
  });

  it('records a paused pending trial as no-sound', () => {
    const { engine, events } = makeEngine();
    engine.startBlock(
      options({ config: config({ predictability: PredictabilityMode.WindowNarrow }) }),
    );
    engine.armTrial(false);
    engine.pause('visibility');
    const completed = events.filter((e) => e.type === 'trial-completed');
    expect(completed).toHaveLength(1);
    const trial = completed[0].type === 'trial-completed' ? completed[0].trial : null;
    expect(trial?.outcome).toBe('no-sound');
    expect(trial?.pausedDuring).toBe(true);
  });

  it('stop cancels everything and returns the trials', () => {
    const { scheduler, engine } = makeEngine();
    engine.startBlock(
      options({ config: config({ predictability: PredictabilityMode.WindowNarrow }) }),
    );
    engine.armTrial(false);
    const trials = engine.stop();
    expect(trials).toHaveLength(1);
    expect(trials[0].outcome).toBe('aborted');
    scheduler.advance(60);
    engine.tick();
    expect(scheduler.sounded).toHaveLength(0);
    expect(engine.state).toBe('idle');
  });

  it('no stimulus can be scheduled outside an active block (idle state)', () => {
    const { scheduler, engine } = makeEngine();
    expect(() => engine.armTrial(true)).toThrow();
    engine.startBlock(options({ trialsPlanned: 1, sampling: { everyNTrials: 99, minGap: 99 }, suppressRatings: true }));
    engine.armTrial(true);
    scheduler.advance(1);
    engine.tick();
    expect(engine.state).toBe('idle');
    expect(() => engine.armTrial(true)).toThrow();
    expect(scheduler.scheduledRecords).toHaveLength(1);
  });
});

describe('ExposureEngine — ratings', () => {
  it('requests ratings only for sampled trials and stores them', () => {
    const { scheduler, engine, events } = makeEngine(3);
    engine.startBlock(
      options({ trialsPlanned: 6, sampling: { everyNTrials: 3, minGap: 1 } }),
    );
    for (let i = 0; i < 6; i++) {
      engine.armTrial(true);
      scheduler.advance(1);
      engine.tick();
      if (engine.state === 'rating') {
        engine.submitRatings({ startle: 4, distress: 2, recovery: '5-15s' });
      }
    }
    const requested = events.filter((e) => e.type === 'rating-requested').length;
    expect(requested).toBeGreaterThan(0);
    expect(requested).toBeLessThan(6);
    const rated = engine.completedTrials.filter((t) => t.ratings.startle !== null);
    expect(rated).toHaveLength(requested);
    expect(rated[0].ratings).toEqual({ startle: 4, distress: 2, recovery: '5-15s' });
  });

  it('suppresses ratings in warm-up/cool-down blocks', () => {
    const { scheduler, engine, events } = makeEngine();
    engine.startBlock(
      options({ trialsPlanned: 4, suppressRatings: true, sampling: { everyNTrials: 1, minGap: 0 } }),
    );
    for (let i = 0; i < 4; i++) {
      engine.armTrial(true);
      scheduler.advance(1);
      engine.tick();
    }
    expect(events.filter((e) => e.type === 'rating-requested')).toHaveLength(0);
    expect(engine.state).toBe('idle');
  });

  it('skipping a rating is allowed and completes the trial', () => {
    const { scheduler, engine } = makeEngine();
    engine.startBlock(options({ trialsPlanned: 2, sampling: { everyNTrials: 1, minGap: 0 } }));
    engine.armTrial(true);
    scheduler.advance(1);
    engine.tick();
    expect(engine.state).toBe('rating');
    engine.skipRating();
    expect(engine.state).toBe('running');
    expect(engine.completedTrials[0].ratings.startle).toBeNull();
    expect(engine.completedTrials[0].outcome).toBe('completed');
  });
});

describe('ExposureEngine — strong stimulus budget', () => {
  it('caps intensity once the strong budget is exhausted', () => {
    const { scheduler, engine, events } = makeEngine();
    engine.startBlock(
      options({
        config: config({ intensity: 4, amplitude: intensityToAmplitude(4) }),
        trialsPlanned: 4,
        strongStimuliBudget: 2,
        sampling: { everyNTrials: 99, minGap: 99 }, suppressRatings: true,
      }),
    );
    for (let i = 0; i < 4; i++) {
      engine.armTrial(true);
      scheduler.advance(1);
      engine.tick();
    }
    const amplitudes = scheduler.scheduledRecords.map((r) => r.amplitude);
    expect(amplitudes[0]).toBeCloseTo(intensityToAmplitude(4));
    expect(amplitudes[1]).toBeCloseTo(intensityToAmplitude(4));
    expect(amplitudes[2]).toBeLessThanOrEqual(intensityToAmplitude(3));
    expect(amplitudes[3]).toBeLessThanOrEqual(intensityToAmplitude(3));
    expect(events.filter((e) => e.type === 'intensity-capped')).toHaveLength(2);
    const trials = engine.completedTrials;
    expect(trials[2].intensity).toBe(3);
  });
});
