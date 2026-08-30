# Startle Trainer

An installable, offline-first Progressive Web App for **gamified, graded
acoustic startle self-training**. The user practices with sudden sounds
(balloon pops) that start quiet, fully predictable and self-triggered, and
only gradually become less predictable and slightly stronger — while the app
separately tracks physical startle, fear/distress, recovery time and
anticipatory anxiety.

> **Not a medical device.** Startle Trainer is a self-directed training and
> experimentation tool. It does not diagnose, prevent, or treat any medical
> or psychiatric condition. See [SAFETY.md](SAFETY.md).

## Features (MVP)

- Installable PWA, fully offline after first load (service worker + precache)
- Balloon Game with the full graded predictability ladder:
  user-triggered pop → user-started 3-2-1 countdown → automatic countdown →
  randomized onset windows (3–5 s, 3–10 s, up to 20 s) → probabilistic
  (four balloons, only a hidden one pops) → background (star-catching
  distraction task while pops occur on their own)
- Relative intensity scale (Very soft … Strong) — application amplitude only;
  the system volume is never touched
- Three synthetic pop sounds, generated in-app (no recordings shipped)
- Web Audio API scheduling (audio-clock precision, preloaded buffers)
- Session structure: check-in → warm-up → training → progression suggestion →
  cool-down → summary
- Adaptive progression across blocks and sessions (one dimension at a time,
  never forced, always overridable) — see [ADAPTIVE_ALGORITHM.md](ADAPTIVE_ALGORITHM.md)
- Separate 0–10 ratings for **physical startle** and **fear/distress**
  (never combined), sampled periodically rather than after every pop,
  plus recovery-time buckets and pre-session anticipatory anxiety
- Experiment mode: 2×2 (intensity × predictability) with cautious,
  sample-size-aware descriptive results
- Progress dashboard (per-session trends, by-intensity, by-predictability,
  within-session habituation), sample sizes always shown
- Local-only data (IndexedDB), JSON + CSV export, confirmed delete-all
- Safety: ever-present STOP/PAUSE, background/visibility auto-pause with
  explicit resume, personal maximum intensity, strong-stimulus budget

## Development

Requirements: Node 20+ and npm.

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # run the unit test suite (vitest)
npm run typecheck  # TypeScript project check
npm run build      # production build into dist/ (includes service worker)
npm run preview    # serve the production build locally
```

Icons are checked in; regenerate with `node scripts/generate-icons.mjs`.

## Installing the PWA

1. Serve `dist/` over HTTPS (or use `npm run preview` / localhost).
2. Open the app in Chrome on Android (primary target) or a Chromium desktop
   browser and use “Install app” / “Add to Home screen”.
   On iOS Safari use Share → “Add to Home Screen” (see limitations below).
3. Open the app once while online; afterwards all training works offline.

Updates are picked up automatically on reload and never delete stored data.

## Documentation

| File | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Module layout, ports, platform-migration strategy |
| [DATA_MODEL.md](DATA_MODEL.md) | Entities, IndexedDB schema, migrations |
| [ADAPTIVE_ALGORITHM.md](ADAPTIVE_ALGORITHM.md) | Progression rules and thresholds |
| [SAFETY.md](SAFETY.md) | Safety rules, privacy model, claims deliberately not made |
| [docs/EXPORT_SCHEMA.md](docs/EXPORT_SCHEMA.md) | JSON/CSV export formats |
| [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) | Sound asset sources and licenses |

## Known browser limitations

- **Audio output latency is not calibrated.** Web Audio scheduling removes JS
  timer jitter, but browser + hardware latency (tens of ms, device-dependent)
  is unknown; recorded audio-clock times are for relative audit only.
- **iOS/Safari:** audio requires a user gesture per page load (handled via the
  unlock flow); PWA install is manual (“Add to Home Screen”); background
  behavior is more aggressive, which is safe here (training pauses).
- **System volume is invisible** to the web platform: the app cannot know or
  record the device media volume, only its own relative amplitude.
- Browsers may evict IndexedDB under storage pressure; use JSON export as a
  backup. (`navigator.storage.persist()` is not yet requested — future work.)

## Assumptions

- One user per device/browser profile; no multi-profile support.
- Self-paced use, a few short sessions per week; no scheduling/reminders.
- The user's device can play audio through speakers or headphones.
- 0–10 self-ratings are meaningful to the user; no physiological validation.

## Deliberately unsupported (MVP)

- Accounts, login, cloud sync, telemetry, analytics, notifications
- Realistic gunshot or violence-related sounds and imagery
- Fireworks game, extra sound categories, sound import
  (architected, not built)
- Physiological sensing (interface defined, no implementation)
- Calibrated dB SPL output

See [SAFETY.md](SAFETY.md) for the list of clinical/scientific claims this
application deliberately does **not** make.

## License

MIT — see [LICENSE](LICENSE).
