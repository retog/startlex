# Architecture

## Design goals

1. **Platform-independent core.** All exposure, adaptation, experiment,
   statistics and session logic lives in `src/core` and imports neither
   React, the DOM, Web Audio, nor IndexedDB. This keeps the logic reusable
   for a later Capacitor/native Android build and makes it unit-testable in
   plain Node.
2. **Ports and adapters.** Platform services are defined as interfaces
   ("ports") in `src/core/ports.ts` and implemented by web adapters.
3. **Safety by construction.** Stimulus scheduling has exactly one code path
   (`ExposureEngine.armTrial`), which is only reachable in an active
   training state; pause/stop/visibility-loss cancel all pending audio.

## Module layout

```
src/
  core/                     platform-independent domain logic
    types.ts                entities, scales, difficulty config
    ports.ts                AudioStimulusScheduler, SessionRepository,
                            SensorProvider, ScheduledStimulus, RandomFn
    random.ts               seeded PRNG, shuffle, id generation
    exposure/
      engine.ts             ExposureEngine — block/trial state machine
      visibilityGuard.ts    visibility → pause mapping (resume = user only)
    adaptation/
      blockStats.ts         descriptive stats over a completed block
      adaptive.ts           decideProgression() — see ADAPTIVE_ALGORITHM.md
    experiments/
      experiment2x2.ts      2×2 design, balanced randomization, effects,
                            cautious interpretation
    rating/
      sampling.ts           periodic rating sampling policy
    session/
      recovery.ts           close/mark sessions interrupted on restart
    statistics/
      descriptive.ts        mean, median, trend slope, habituation, groupBy
  audio/                    Web Audio adapter
    synth.ts                pure-math synthesis of pop sounds (testable)
    stimuli.ts              MVP stimulus definitions + synthesis params
    webAudioScheduler.ts    AudioStimulusScheduler implementation
  storage/                  persistence adapter
    db.ts                   IndexedDB open + append-only migrations
    indexedDbRepository.ts  SessionRepository implementation
    exporters.ts            JSON/CSV export (docs/EXPORT_SCHEMA.md)
    download.ts             browser file download helper
  games/                    (reserved for future game modules, e.g. fireworks)
  ui/                       React presentation layer
    appContext.ts           service singletons wired once
    styles.css              theme, accessibility, reduced-motion support
    components/             RatingScale, Balloon
    screens/                Onboarding, Calibration, Home, Session,
                            Experiment, Dashboard, Settings
  App.tsx                   screen routing + startup (settings, recovery)
  main.tsx                  React root + service worker registration
```

## The exposure engine

`ExposureEngine` runs **one block** of trials. States:

```
idle → running → pending → (rating) → running → … → idle
              ↘ paused ↗   (resume() only via explicit user action)
```

- `startBlock(options)` — begins a block (config, planned trials, sampling
  policy, strong-stimulus budget, optional rating suppression).
- `armTrial(userInitiated)` — the **only** way any sound gets scheduled.
  Chooses the delay from the predictability mode's window (seeded RNG),
  schedules on the audio clock, records intended vs scheduled time.
- `tick()` — driven by the UI (requestAnimationFrame); detects onset,
  triggers rating sampling, completes trials, ends blocks.
- `pause(reason)` / `stop()` — cancel all unsounded stimuli immediately;
  pending trials are recorded as `no-sound` / `aborted`.

The engine emits events (`armed`, `sounded`, `rating-requested`,
`trial-completed`, `paused`, `resumed`, `block-completed`,
`intensity-capped`); the UI persists trials on `trial-completed`, so the
engine itself never touches storage.

The session **phases** (check-in → warm-up → training → progression →
cool-down → summary) are orchestrated by `SessionScreen`, which runs three
engine blocks (warm-up and cool-down use the easiest config with ratings
suppressed).

## Audio path

- All MVP sounds are synthesized locally (`audio/synth.ts`) as normalized
  mono buffers — deterministic, license-free, clearly non-realistic.
- `WebAudioScheduler.preload()` renders buffers before a block starts;
  `schedule()` plays them via `AudioBufferSourceNode.start(when)` on the
  AudioContext clock, so JS timer jitter does not affect onset.
- Amplitude is a per-stimulus `GainNode` inside the app's own graph, capped
  at 1.0. System/media volume is never read or written.
- `cancelAll()` zeroes gains and stops sources; used by pause/stop and the
  visibility guard.

## Adaptivity and experiments

See [ADAPTIVE_ALGORITHM.md](ADAPTIVE_ALGORITHM.md). Both operate on plain
`Trial[]` data and pure functions — no engine or UI coupling.

## Future native migration (Capacitor readiness)

- Replace `WebAudioScheduler` with a native low-latency implementation of
  `AudioStimulusScheduler`.
- Replace `IndexedDbSessionRepository` with a SQLite-backed
  `SessionRepository`.
- Implement `SensorProvider` for smartwatch HR / accelerometer / EMG and
  correlate `PhysiologicalObservation.timestamp` with trial onset times.
- The core (`src/core`) ships unchanged. Nothing in the core assumes a DOM,
  and all timing flows through the scheduler port.
- Training sounds must never be delivered through notifications, also in a
  native build (see SAFETY.md).
