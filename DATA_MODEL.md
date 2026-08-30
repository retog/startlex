# Data model

All data is stored locally in IndexedDB (database `startle-trainer`).
Timestamps are stored as milliseconds since epoch and exported as ISO 8601.

## Entities

### Session (`sessions` store, key `id`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `session_<base36>` |
| `startedAt` | number | ms epoch |
| `endedAt` | number \| null | null while running; set on end or by recovery |
| `mode` | `'balloon' \| 'experiment'` | |
| `anticipatoryAnxiety` | 0–10 \| null | asked at check-in |
| `difficulty` | DifficultyConfig | intensity, amplitude, predictability, category |
| `note` | string \| null | optional user note |
| `interrupted` | boolean | set by restart recovery |

### Trial (`trials` store, key `id`, index `bySession` on `sessionId`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `sessionId` | string | |
| `timestamp` | number | ms epoch when the trial was armed |
| `stimulusId` | string | e.g. `pop-classic` |
| `stimulusCategory` | StimulusCategory | e.g. `balloon-pop` |
| `intensity` | 1–5 | relative level (see below) |
| `amplitude` | 0..1 | application amplitude actually applied |
| `predictability` | PredictabilityMode | see below |
| `intendedDelaySec` | number | delay chosen by the exposure engine |
| `intendedAudioTime` | number \| null | audio-clock seconds requested |
| `scheduledAudioTime` | number \| null | audio-clock seconds actually scheduled |
| `userInitiated` | boolean | |
| `visualContext` | string | e.g. `balloon-basic`, `experiment` |
| `ratings.startle` | 0–10 \| null | **physical startle** — null when not sampled |
| `ratings.distress` | 0–10 \| null | **fear/distress** — separate by design |
| `ratings.recovery` | bucket \| null | `under-5s`, `5-15s`, `15-30s`, `30-60s`, `over-60s` |
| `outcome` | `'completed' \| 'aborted' \| 'no-sound'` | `no-sound` = cancelled before onset |
| `pausedDuring` | boolean | |
| `experimentCondition` | `'A'..'D'` \| null | 2×2 condition, null for training |

System media volume is **not** recorded: browsers do not expose it.

### Settings (`settings` store, single row `user-settings`)

`maxIntensity`, `maxStrongStimuliPerSession`, `ratingSamplingEveryNTrials`,
`onboardingCompleted`, `calibrationCompleted`, `screeningFlags`,
`progression` (current DifficultyConfig, last increased dimension, whether
the last session struggled). Loaded values are merged over defaults so new
fields introduced by app updates get sane values without a DB migration.

### Stimulus (`stimuli` store)

Reserved for future imported sounds. MVP stimuli are code-defined
(`src/audio/stimuli.ts`) with category, description, source, kind
(`synthetic`), duration and normalization metadata.

### PhysiologicalObservation (future, not stored yet)

`{ timestamp, source, measurementType, value, unit, quality }` — interface
defined in `src/core/types.ts` for later sensor ingestion; correlate with
trial timestamps.

## Scales

- **Intensity (1–5):** relative application amplitude, mapped
  1→0.02, 2→0.06, 3→0.16, 4→0.40, 5→1.00 (≈9 dB steps on the app's own
  scale). Never expressed as dB SPL.
- **Predictability ladder:** `user-triggered` → `user-countdown` →
  `auto-countdown` → `window-narrow` (3–5 s) → `window-moderate` (3–10 s) →
  `window-wide` (≤20 s) → `probabilistic` → `background` (last two are
  post-MVP).
- **Startle and distress are separate 0–10 scales and are never combined
  into a single score anywhere** — storage, algorithm, UI, or export.

## Migrations

`src/storage/db.ts` holds an append-only `MIGRATIONS` list; each has a
`version` and a `migrate(db, tx)` function, applied in order for versions
greater than the on-disk version. Rules:

1. Never edit or remove an existing migration — add a new one.
2. Migrations must preserve existing rows (tested by reopening in tests).
3. Prefer additive changes; for field renames, migrate rows in the upgrade
   transaction.

Current version: **1** (creates `sessions`, `trials` + `bySession` index,
`settings`, `stimuli`).
