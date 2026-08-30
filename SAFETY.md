# Safety, privacy, and scope

## What this application is

Startle Trainer is a self-directed training and experimentation tool built
around graded exposure and habituation ideas: quiet, fully controlled sounds
first; predictability and intensity change gradually, one dimension at a
time; stopping is always allowed and never punished.

## What this application is NOT

**Not a medical device.** It does not diagnose, prevent, or treat any
medical or psychiatric disorder.

### Clinical/scientific claims deliberately NOT made

- No claim to diagnose or rule out hyperacusis, phonophobia, misophonia,
  PTSD, neurological disorders, or hearing disorders.
- No claim that training will reduce startle, fear, or distress — outcomes
  are tracked, not promised.
- No claim that an exaggerated startle response is "all psychological";
  the app never says or implies this.
- No claim of millisecond-accurate stimulus timing (browser/hardware audio
  latency is uncalibrated).
- No claim that app intensity levels correspond to dB SPL.
- No claim of statistical significance anywhere; experiment-mode results
  are descriptive, always shown with sample sizes, and withheld entirely
  below 4 rated observations per condition.
- No claim that phone/watch sensors measure startle (no sensing shipped).

## Sound safety rules (enforced in code)

1. **Sounds play only inside an explicitly started session.** The only
   scheduling code path (`ExposureEngine.armTrial`) requires an active
   training block; tested.
2. **Never from notifications, at app open, or in the background.** No
   notification code exists; losing page visibility pauses the engine and
   cancels every unsounded stimulus (`VisibilityGuard`); tested.
3. **Resume requires an explicit user action.** Regaining visibility never
   restarts exposure; tested.
4. **STOP/PAUSE is always visible** on every training screen; stopping ends
   sound immediately and is never penalized in scoring or language.
5. **System volume is never touched.** Intensity is only an application
   gain (0..1) inside the app's own audio graph, below whatever ceiling the
   user's media volume sets.
6. **Autoplay policies are respected**, never circumvented: the audio
   context is unlocked only from a user gesture.
7. **Personal maximum intensity** (user setting) is a hard ceiling for the
   adaptive algorithm, and a per-session budget caps the number of stronger
   (level 4–5) stimuli.
8. **Volume calibration before first training**, with an explicit warning
   not to set speakers/headphones to uncomfortable or unsafe levels.

## Onboarding screening

Before first use the app asks (checkbox, optional) about physical pain from
ordinary sounds, tinnitus worsening, hearing difficulties, dizziness/vertigo,
other unusual auditory symptoms, and trauma/PTSD-linked reactions to sudden
sounds. If anything is selected, the app advises discussing deliberate sound
exposure with a healthcare professional before intensive training. The
answers are stored locally only and never interpreted as a diagnosis.

## Psychological design choices

- Startle (physical) and fear/distress (emotional) are always separate
  measures — in storage, algorithm, UI, charts and exports.
- Ratings are sampled periodically, not after every stimulus, to avoid
  constant symptom monitoring.
- Neutral language throughout: no "FAILED", no "you could not complete the
  level"; interruptions are recorded factually.
- The optimization target is gradual improvement across sessions (lower
  anticipatory anxiety, lower distress, faster recovery, more tolerance of
  unpredictability) — not "stop startling as fast as possible". A strong
  reflex with improving fear/recovery is treated as a valid trajectory.

## Privacy model

- No account, no login, no server, no cloud sync, no advertising, no
  tracking, no third-party analytics, no telemetry. The app makes no
  network requests beyond fetching its own static assets.
- All data lives in the browser's IndexedDB on the device.
- Export (JSON/CSV) downloads files locally; nothing is transmitted.
- Delete All Data requires explicit confirmation and wipes every store.
