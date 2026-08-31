# Adaptive progression algorithm

Implemented in `src/core/adaptation/adaptive.ts`
(`decideProgression(trials, context)`), tested in
`src/core/adaptation/adaptive.test.ts`.

## Principles

1. **Block-level decisions.** The algorithm never reacts to a single trial;
   it evaluates a completed block (default 8 trials) plus session context.
2. **One dimension at a time.** A change touches exactly one of
   {intensity, predictability, sound}, so the effect of each change on the
   user's response stays interpretable.
3. **Easing outranks progression.** Regression checks run first and cannot
   be overridden by good-looking averages.
4. **Gradual across sessions.** At most one increase per session; a
   difficult previous session blocks increases in the current one.
5. **Never forced.** The output is a *suggestion*; the UI always offers
   "keep current level" and "choose easier level", and the user's personal
   maximum intensity is a hard ceiling.

## Inputs

Per block: mean/median startle, mean/median distress, startle trend,
distress trend (least-squares slope per trial, needs ≥3 rated trials),
mean recovery seconds (bucket midpoints), counts of completed / aborted /
unsounded trials, number of rated trials.
Context: anticipatory anxiety (check-in), pauses during the block, last
increased dimension, increases already granted this session, whether the
previous session struggled, personal max intensity, unlocked predictability
cap (currently `background`, the top of the ladder).

## Decision rules (in order)

### 1. Decrease — any of:

| Condition | Threshold |
| --- | --- |
| Mean distress | ≥ 7 |
| Mean startle | ≥ 8 |
| Aborted fraction | > 25 % of trials |
| Pauses in block | ≥ 2 |
| Distress trend | > +0.5 points/trial |
| Mean recovery | > 60 s |

Easing reverts the **most recently increased dimension** one step when
possible; otherwise the further-advanced of predictability/intensity. At
the floor (level 1, user-triggered) the config stays put — settings are
never punished further.

### 2. Hold — any of (when no decrease fired):

- fewer than 2 rated trials in the block (insufficient data)
- mean distress ≥ 4, or mean startle ≥ 6
- startle or distress trend > +0.15 points/trial
- anticipatory anxiety ≥ 7 at check-in
- any pause or any aborted trial in the block
- the previous session struggled (consolidate first)
- an increase was already granted this session

### 3. Increase — otherwise:

Ratings were low and stable. Exactly one dimension steps up, following the
rotation **predictability → intensity → sound → predictability → …**:

- **Predictability first** ("control before loudness"): while below the
  unlocked predictability cap, timing becomes one step less predictable and
  loudness stays put.
- **Then intensity:** after a predictability increase, intensity steps up
  next (if it has headroom) — successive changes alternate so effects
  remain attributable.
- **Then sound:** after an intensity increase, the next unexplored category
  from the sound ladder (balloons → door → dropped object → distant
  fireworks) is introduced with loudness and timing unchanged. The ladder
  is variety for generalization, not a loudness ordering.
- **Ceilings:** intensity never exceeds the user's personal maximum;
  predictability never exceeds the unlocked cap; the sound ladder ends at
  its last category. With every dimension at its cap the decision is a hold.

Easing reverts the most recently increased dimension — including a sound
introduction, which returns to the previous, more familiar category.

Amplitude is always derived from the intensity level via the fixed mapping
(`intensityToAmplitude`), so an intensity change is exactly one step on the
relative scale.

## Session integration

- The decision is computed after the training block and shown with its
  rationale (plain, non-judgmental language).
- Accepted decisions persist to settings (`progression`) and apply from the
  next session's training block; warm-up and cool-down always use the
  easiest configuration.
- A decrease (or the user choosing an easier level) marks
  `lastSessionStruggled`, which blocks increases in the following session.

## Per-session safety caps (engine level, not part of the decision)

- `strongStimuliBudget`: trials at intensity ≥ 4 beyond the configured
  per-session budget are automatically capped to level 3 (event
  `intensity-capped`).

## Deliberate non-goals

- No "success streak" fast-tracking, no difficulty maximization within a
  session, no penalties for stopping, and no combined startle+distress
  score anywhere in the algorithm.
