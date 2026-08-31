import { useCallback, useEffect, useRef, useState } from 'react';
import { ExposureEngine, type EngineEvent, type TrialPlan } from '../../core/exposure/engine';
import { VisibilityGuard } from '../../core/exposure/visibilityGuard';
import { decideProgression, type AdaptiveDecision } from '../../core/adaptation/adaptive';
import { newId, seededRandom } from '../../core/random';
import { mean } from '../../core/statistics/descriptive';
import {
  CATEGORY_LABELS,
  INTENSITY_LABELS,
  PredictabilityMode,
  SOUND_LADDER,
  intensityToAmplitude,
  type DifficultyConfig,
  type Session,
  type StimulusCategory,
  type Trial,
  type TrialRatings,
  type UserSettings,
} from '../../core/types';
import { repository, scheduler } from '../appContext';
import { spawnField, targetOf, type FieldBalloon } from '../../games/balloons/field';
import { StarTask, type TaskItem } from '../../games/balloons/starTask';
import { Balloon, BALLOON_COLORS } from '../components/Balloon';
import { ContextVisual, type VisualState } from '../components/ContextVisual';
import { RatingScale } from '../components/RatingScale';
import { TaskShapeButton } from '../components/TaskShape';

type Phase =
  | 'checkin'
  | 'warmup'
  | 'training'
  | 'progression'
  | 'cooldown'
  | 'summary';

const WARMUP_TRIALS = 3;
const TRAINING_TRIALS = 8;
const COOLDOWN_TRIALS = 2;

const EASY_CONFIG: DifficultyConfig = {
  intensity: 1,
  amplitude: intensityToAmplitude(1),
  predictability: PredictabilityMode.UserTriggered,
  category: 'balloon-pop',
};

/** Per-category wording so hints match the visual context. */
const CATEGORY_WORDS: Record<
  string,
  { noun: string; trigger: string; event: string }
> = {
  'balloon-pop': { noun: 'balloon', trigger: 'pop', event: 'pop' },
  'door-closing': { noun: 'door', trigger: 'close', event: 'close' },
  'dropped-light-object': { noun: 'object', trigger: 'drop', event: 'drop' },
  'distant-firework': { noun: 'firework', trigger: 'launch', event: 'burst' },
};

function words(category: StimulusCategory) {
  return CATEGORY_WORDS[category] ?? CATEGORY_WORDS['balloon-pop'];
}

function modeHint(mode: PredictabilityMode, category: StimulusCategory): string {
  const w = words(category);
  switch (mode) {
    case PredictabilityMode.UserTriggered:
      return `Tap the ${w.noun} to ${w.trigger} it — the sound happens right away.`;
    case PredictabilityMode.UserCountdown:
      return `Tap the ${w.noun} to start a 3-2-1 countdown, then it ${w.event}s.`;
    case PredictabilityMode.AutoCountdown:
      return `A countdown starts on its own, then the ${w.noun} ${w.event}s.`;
    case PredictabilityMode.WindowNarrow:
      return `Press Ready — the ${w.noun} will ${w.event} within 3–5 seconds.`;
    case PredictabilityMode.WindowModerate:
      return `Press Ready — the ${w.noun} will ${w.event} within 3–10 seconds.`;
    case PredictabilityMode.WindowWide:
      return `Press Ready — the ${w.noun} will ${w.event} at some point within 20 seconds.`;
    case PredictabilityMode.Probabilistic:
      return category === 'balloon-pop'
        ? 'Press Ready — one of the balloons will pop, but you cannot know which.'
        : `Press Ready — the ${w.noun} will ${w.event} at an unpredictable moment.`;
    case PredictabilityMode.Background:
      return 'Catch the stars! Sounds happen occasionally on their own while you play.';
  }
}

function onsetMessage(
  category: StimulusCategory,
  min: number,
  max: number,
  probabilistic: boolean,
): string {
  const w = words(category);
  if (probabilistic && category === 'balloon-pop') {
    return `One of the balloons will pop within ${min}–${max} seconds…`;
  }
  return `The ${w.noun} will ${w.event} within ${min}–${max} seconds…`;
}

const FIELD_BALLOON_COUNT = 4;

function isMultiMode(mode: PredictabilityMode): boolean {
  return (
    mode === PredictabilityMode.Probabilistic || mode === PredictabilityMode.Background
  );
}

interface Props {
  settings: UserSettings;
  onSettingsChange(next: UserSettings): Promise<void> | void;
  onExit(): void;
}

interface PendingRatings {
  startle: number | null;
  distress: number | null;
  recovery: TrialRatings['recovery'];
}

export function SessionScreen({ settings, onSettingsChange, onExit }: Props) {
  const engineRef = useRef<ExposureEngine | null>(null);
  const guardRef = useRef<VisibilityGuard | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ExposureEngine(scheduler, seededRandom(Date.now() >>> 0));
    guardRef.current = new VisibilityGuard(engineRef.current);
  }
  const engine = engineRef.current;

  const [phase, setPhase] = useState<Phase>('checkin');
  const [anxiety, setAnxiety] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<DifficultyConfig>(
    settings.progression?.current ?? EASY_CONFIG,
  );
  const [plan, setPlan] = useState<TrialPlan | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [popping, setPopping] = useState(false);
  const [paused, setPaused] = useState<null | 'user' | 'visibility' | 'audio'>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [pending, setPending] = useState<PendingRatings>({ startle: null, distress: null, recovery: null });
  const [trainingTrials, setTrainingTrials] = useState<Trial[]>([]);
  const [allTrials, setAllTrials] = useState<Trial[]>([]);
  const [decision, setDecision] = useState<AdaptiveDecision | null>(null);
  const [previousMeans, setPreviousMeans] = useState<{ startle: number | null; distress: number | null; sessions: number }>({ startle: null, distress: null, sessions: 0 });
  const pauseCountRef = useRef(0);
  const [balloonPos, setBalloonPos] = useState({ x: 0.4, y: 0.35, color: BALLOON_COLORS[0] });
  const [field, setField] = useState<FieldBalloon[]>([]);
  const [poppingTargetId, setPoppingTargetId] = useState<string | null>(null);
  const starTaskRef = useRef<StarTask | null>(null);
  if (!starTaskRef.current) starTaskRef.current = new StarTask(Math.random);
  const [stars, setStars] = useState<TaskItem[]>([]);
  const [starScore, setStarScore] = useState(0);
  const phaseRef = useRef<Phase>('checkin');
  phaseRef.current = phase;
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const fieldRef = useRef<FieldBalloon[]>([]);
  fieldRef.current = field;

  const newBalloon = useCallback(() => {
    setBalloonPos({
      x: 0.12 + Math.random() * 0.55,
      y: 0.15 + Math.random() * 0.45,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
    });
    setField(
      spawnField(Math.random, {
        count: FIELD_BALLOON_COUNT,
        colorCount: BALLOON_COLORS.length,
      }),
    );
    setPoppingTargetId(null);
    setPopping(false);
  }, []);

  /* ---------------- engine events ---------------- */
  useEffect(() => {
    const off = engine.on((e: EngineEvent) => {
      switch (e.type) {
        case 'armed':
          setPlan(e.plan);
          break;
        case 'sounded':
          setPopping(true);
          // In multi-balloon modes only the hidden target bursts.
          if (fieldRef.current.length > 0) {
            setPoppingTargetId(targetOf(fieldRef.current).id);
          }
          setPlan(null);
          break;
        case 'rating-requested':
          setPending({ startle: null, distress: null, recovery: null });
          setRatingOpen(true);
          break;
        case 'trial-completed': {
          const sess = sessionRef.current;
          if (sess) void repository.saveTrial(e.trial);
          setAllTrials((t) => [...t, e.trial]);
          if (phaseRef.current === 'training') setTrainingTrials((t) => [...t, e.trial]);
          setRatingOpen(false);
          window.setTimeout(newBalloon, 420);
          break;
        }
        case 'paused':
          setPaused(e.reason);
          setPlan(null);
          setCountdown(null);
          pauseCountRef.current += 1;
          break;
        case 'resumed':
          setPaused(null);
          break;
        case 'block-completed':
          // handled in phase logic below via state of engine
          break;
        default:
          break;
      }
    });
    return off;
  }, [engine, newBalloon]);

  /* ---------------- tick loop + countdown display ---------------- */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      engine.tick();
      const remaining = engine.timeToOnset();
      if (remaining !== null && plan) {
        const isCountdown =
          plan.predictability === PredictabilityMode.UserCountdown ||
          plan.predictability === PredictabilityMode.AutoCountdown;
        // Clamp to 3 so the 50 ms scheduling lead never flashes a "4".
        setCountdown(isCountdown ? Math.min(3, Math.max(0, Math.ceil(remaining))) : null);
      } else {
        setCountdown(null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, plan]);

  /* ---------------- cancel all audio when leaving the screen ---------------- */
  useEffect(() => {
    return () => {
      engine.stop();
      scheduler.cancelAll();
    };
  }, [engine]);

  /* ---------------- visibility guard ---------------- */
  useEffect(() => {
    const onVisibility = () =>
      guardRef.current!.handleVisibilityChange(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => guardRef.current!.handleVisibilityChange(false));
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /* ---------------- block completion → phase transitions ---------------- */
  useEffect(() => {
    if (engine.state !== 'idle') return;
    if (phase === 'warmup' && allTrials.length >= WARMUP_TRIALS) {
      engine.startBlock({
        sessionId: session!.id,
        config,
        trialsPlanned: TRAINING_TRIALS,
        visualContext:
          config.predictability === PredictabilityMode.Background
            ? `${config.category}-background`
            : isMultiMode(config.predictability) && config.category === 'balloon-pop'
              ? 'balloon-field'
              : `${config.category}-basic`,
        sampling: { everyNTrials: settings.ratingSamplingEveryNTrials, minGap: 1 },
        strongStimuliBudget: settings.maxStrongStimuliPerSession,
      });
      setPhase('training');
    } else if (phase === 'training' && trainingTrials.length >= TRAINING_TRIALS) {
      const d = decideProgression(trainingTrials, {
        current: config,
        anticipatoryAnxiety: anxiety,
        pauses: pauseCountRef.current,
        lastIncreasedDimension: settings.progression?.lastIncreasedDimension ?? null,
        increasesThisSession: 0,
        previousSessionStruggled: settings.progression?.lastSessionStruggled ?? false,
        maxIntensity: settings.maxIntensity,
        maxPredictability: PredictabilityMode.Background,
        soundLadder: SOUND_LADDER,
      });
      setDecision(d);
      setPhase('progression');
    }
    else if (phase === 'cooldown') {
      // Engine is idle again → the cool-down block finished.
      void finishSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTrials, phase]);

  /* ------- automatic arming (auto-countdown + background modes) ------- */
  useEffect(() => {
    const auto =
      config.predictability === PredictabilityMode.AutoCountdown ||
      config.predictability === PredictabilityMode.Background;
    if (!auto || phase !== 'training' || paused !== null || ratingOpen) return;
    if (engine.state !== 'running') return;
    // Background mode varies the inter-trial gap so the next arm is not a cue.
    const gap =
      config.predictability === PredictabilityMode.Background
        ? 1200 + Math.random() * 1800
        : 1600;
    const t = window.setTimeout(() => {
      if (engine.state === 'running' && document.visibilityState === 'visible') {
        engine.armTrial(false);
      }
    }, gap);
    return () => window.clearTimeout(t);
  }, [engine, config.predictability, phase, paused, ratingOpen, allTrials]);

  /* ------- star distraction task (background mode only) ------- */
  const backgroundActive =
    phase === 'training' &&
    config.predictability === PredictabilityMode.Background &&
    paused === null;
  useEffect(() => {
    const task = starTaskRef.current!;
    if (!backgroundActive) {
      task.reset();
      setStars([]);
      return;
    }
    const interval = window.setInterval(() => {
      if (Math.random() < 0.55) task.spawn();
      setStars(task.current());
    }, 700);
    return () => window.clearInterval(interval);
  }, [backgroundActive]);

  const tapStar = (id: string) => {
    const task = starTaskRef.current!;
    task.tap(id);
    setStarScore(task.score);
    setStars(task.current());
  };

  /* ---------------- actions ---------------- */
  const beginSession = async () => {
    await scheduler.unlock();
    await scheduler.preload(scheduler.listStimuli().map((s) => s.id));
    const s: Session = {
      id: newId('session'),
      startedAt: Date.now(),
      endedAt: null,
      mode: 'balloon',
      anticipatoryAnxiety: anxiety,
      difficulty: config,
      note: note.trim() === '' ? null : note.trim(),
      interrupted: false,
    };
    await repository.saveSession(s);
    // Previous-session comparison for the summary.
    const previousSessions = (await repository.listSessions()).filter(
      (p) => p.id !== s.id && p.mode === 'balloon',
    );
    const prevTrials = (await repository.listTrials()).filter(
      (t) =>
        previousSessions.some((p) => p.id === t.sessionId) && t.outcome === 'completed',
    );
    setPreviousMeans({
      startle: mean(prevTrials.map((t) => t.ratings.startle).filter((v): v is number => v !== null)),
      distress: mean(prevTrials.map((t) => t.ratings.distress).filter((v): v is number => v !== null)),
      sessions: previousSessions.length,
    });
    setSession(s);
    sessionRef.current = s;
    engine.startBlock({
      sessionId: s.id,
      config: EASY_CONFIG,
      trialsPlanned: WARMUP_TRIALS,
      visualContext: 'balloon-warmup',
      sampling: { everyNTrials: 99, minGap: 99 },
      strongStimuliBudget: settings.maxStrongStimuliPerSession,
      suppressRatings: true,
    });
    setPhase('warmup');
    newBalloon();
  };

  const startCooldown = () => {
    engine.startBlock({
      sessionId: session!.id,
      config: EASY_CONFIG,
      trialsPlanned: COOLDOWN_TRIALS,
      visualContext: 'balloon-cooldown',
      sampling: { everyNTrials: 99, minGap: 99 },
      strongStimuliBudget: settings.maxStrongStimuliPerSession,
      suppressRatings: true,
    });
    setPhase('cooldown');
    newBalloon();
  };

  const applyDecision = async (next: DifficultyConfig, struggled: boolean, increasedDim: AdaptiveDecision['dimension']) => {
    await onSettingsChange({
      ...settings,
      progression: {
        current: next,
        lastIncreasedDimension:
          increasedDim && !struggled ? increasedDim : settings.progression?.lastIncreasedDimension ?? null,
        lastSessionStruggled: struggled,
      },
    });
  };

  const finishSession = async () => {
    engine.stop();
    if (session) {
      const ended: Session = { ...session, endedAt: Date.now() };
      await repository.saveSession(ended);
      setSession(ended);
    }
    setPhase('summary');
  };

  const stopEverything = async () => {
    engine.stop();
    if (session) {
      const ended: Session = { ...session, endedAt: Date.now() };
      await repository.saveSession(ended);
      setSession(ended);
      setPhase('summary');
    } else {
      onExit();
    }
  };

  /* ---------------- interaction helpers ---------------- */
  const canInteract = paused === null && !ratingOpen && engine.state === 'running';
  const isUserMode =
    config.predictability === PredictabilityMode.UserTriggered ||
    config.predictability === PredictabilityMode.UserCountdown;
  const activeConfig = phase === 'training' ? config : EASY_CONFIG;

  const armFromBalloon = () => {
    if (!canInteract) return;
    if (
      activeConfig.predictability === PredictabilityMode.UserTriggered ||
      activeConfig.predictability === PredictabilityMode.UserCountdown
    ) {
      engine.armTrial(true);
    }
  };

  const armFromReady = () => {
    if (!canInteract) return;
    engine.armTrial(false);
  };

  /* ================= RENDER ================= */

  if (phase === 'checkin') {
    return (
      <main className="screen">
        <h1>Session check-in</h1>
        <RatingScale
          label="How anxious are you about doing today's exercise?"
          lowAnchor="Not at all"
          highAnchor="Extremely"
          value={anxiety}
          onChange={setAnxiety}
        />
        <div className="card">
          <p>
            Today's level: <strong>{INTENSITY_LABELS[config.intensity]}</strong> sound,{' '}
            <strong>{modeHint(config.predictability, config.category)}</strong>
          </p>
          <label className="field">
            <span>Sound &amp; scene</span>
            <select
              value={config.category}
              onChange={(e) =>
                setConfig({ ...config, category: e.target.value as StimulusCategory })
              }
            >
              {SOUND_LADDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <div className="btn-row">
            <button
              onClick={() => setConfig(EASY_CONFIG)}
              disabled={
                config.intensity === EASY_CONFIG.intensity &&
                config.predictability === EASY_CONFIG.predictability &&
                config.category === EASY_CONFIG.category
              }
            >
              Use easiest level instead
            </button>
          </div>
          <p className="dim small">
            You can always choose an easier level — the app never forces
            progression.
          </p>
        </div>
        <label className="field">
          <span>Optional note</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <div className="btn-row">
          <button onClick={onExit}>Back</button>
          <button className="btn-primary" disabled={anxiety === null} onClick={beginSession}>
            Begin warm-up
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'progression' && decision) {
    return (
      <main className="screen">
        <h1>Nice work</h1>
        <div className="card">
          <p>
            {decision.action === 'increase' && 'That block looked comfortable. Suggestion for next time: '}
            {decision.action === 'hold' && 'Suggestion: stay at this level for now. '}
            {decision.action === 'decrease' && 'Suggestion: take it a bit easier next time. '}
          </p>
          <ul className="dim small">
            {decision.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p>
            Next level would be:{' '}
            <strong>{INTENSITY_LABELS[decision.next.intensity]}</strong>{' '}
            {(CATEGORY_LABELS[decision.next.category] ?? decision.next.category).toLowerCase()}
            {' — '}
            {modeHint(decision.next.predictability, decision.next.category)}
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn-primary"
            onClick={async () => {
              await applyDecision(
                decision.next,
                decision.action === 'decrease',
                decision.action === 'increase' ? decision.dimension : null,
              );
              startCooldown();
            }}
          >
            Accept suggestion
          </button>
          <button
            onClick={async () => {
              await applyDecision(config, decision.action === 'decrease', null);
              startCooldown();
            }}
          >
            Keep current level
          </button>
          <button
            onClick={async () => {
              const easier = decision.action === 'decrease' ? decision.next : EASY_CONFIG;
              await applyDecision(easier, true, null);
              startCooldown();
            }}
          >
            Choose easier level
          </button>
        </div>
        <p className="dim small">A short, easy cool-down follows.</p>
      </main>
    );
  }

  if (phase === 'summary') {
    const completed = allTrials.filter((t) => t.outcome === 'completed');
    const startles = completed.map((t) => t.ratings.startle).filter((v): v is number => v !== null);
    const distresses = completed.map((t) => t.ratings.distress).filter((v): v is number => v !== null);
    const meanStartle = mean(startles);
    const meanDistress = mean(distresses);
    return (
      <main className="screen">
        <h1>Session complete</h1>
        <div className="card">
          <p>Completed pops: {completed.length}</p>
          <p>
            Average startle: {meanStartle !== null ? meanStartle.toFixed(1) : '—'}{' '}
            <span className="dim small">({startles.length} rated)</span>
          </p>
          <p>
            Average distress: {meanDistress !== null ? meanDistress.toFixed(1) : '—'}{' '}
            <span className="dim small">({distresses.length} rated)</span>
          </p>
          {previousMeans.sessions > 0 && (
            <p className="dim small">
              Across your previous {previousMeans.sessions} session
              {previousMeans.sessions === 1 ? '' : 's'}: startle{' '}
              {previousMeans.startle?.toFixed(1) ?? '—'}, distress{' '}
              {previousMeans.distress?.toFixed(1) ?? '—'}.
            </p>
          )}
          <p className="dim small">
            However this went — showing up for practice is what counts. Progress
            across sessions matters more than any single day.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn-primary" onClick={onExit}>
            Done
          </button>
        </div>
      </main>
    );
  }

  /* ---- active game phases: warmup / training / cooldown ---- */
  const phaseLabel =
    phase === 'warmup' ? 'Warm-up' : phase === 'cooldown' ? 'Cool-down' : 'Training';
  const trialsDone =
    phase === 'training'
      ? trainingTrials.length
      : phase === 'cooldown'
        ? Math.max(0, allTrials.length - WARMUP_TRIALS - TRAINING_TRIALS)
        : allTrials.length;
  const trialsTotal =
    phase === 'warmup' ? WARMUP_TRIALS : phase === 'cooldown' ? COOLDOWN_TRIALS : TRAINING_TRIALS;
  const activeIsUserMode =
    activeConfig.predictability === PredictabilityMode.UserTriggered ||
    activeConfig.predictability === PredictabilityMode.UserCountdown;
  // Balloon fields only exist for the balloon category; other categories use
  // their single context visual even at the probabilistic/background levels.
  const showField =
    isMultiMode(activeConfig.predictability) && activeConfig.category === 'balloon-pop';
  const visualState: VisualState = popping
    ? 'burst'
    : plan !== null
      ? 'waiting'
      : 'idle';
  const w = words(activeConfig.category);

  return (
    <main className="screen">
      <div className="training-topbar">
        <span>
          {phaseLabel} · {Math.min(trialsDone, trialsTotal)}/{trialsTotal}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => engine.pause('user')} disabled={paused !== null}>
            Pause
          </button>
          <button className="btn-stop" onClick={stopEverything}>
            STOP
          </button>
        </div>
      </div>

      <div
        className={`game-area${
          activeConfig.category === 'distant-firework' ? ' night-sky' : ''
        }`}
      >
        {activeConfig.predictability === PredictabilityMode.Background && (
          <>
            <div className="score-badge" aria-live="off">
              ⭐ {starScore}
            </div>
            {stars.map((item) => (
              <TaskShapeButton
                key={item.id}
                x={item.x}
                y={item.y}
                shape={item.shape}
                onTap={() => tapStar(item.id)}
              />
            ))}
          </>
        )}
        {showField ? (
          <>
            {field.map((b) => (
              <Balloon
                key={b.id}
                x={b.x}
                y={b.y}
                color={BALLOON_COLORS[b.colorIndex]}
                popping={poppingTargetId === b.id}
                onPop={undefined}
                label="Balloon"
              />
            ))}
          </>
        ) : !popping && plan === null && engine.state !== 'running' ? null : (
          <ContextVisual
            category={activeConfig.category}
            state={visualState}
            x={balloonPos.x}
            y={balloonPos.y}
            color={balloonPos.color}
            onTrigger={
              activeIsUserMode && canInteract && visualState === 'idle'
                ? armFromBalloon
                : undefined
            }
            label={
              activeConfig.predictability === PredictabilityMode.UserTriggered
                ? `Tap to ${w.trigger} the ${w.noun}`
                : activeConfig.predictability === PredictabilityMode.UserCountdown
                  ? `Start the countdown for this ${w.noun}`
                  : `The ${w.noun}`
            }
          />
        )}
      </div>

      <div className="status-line" aria-live="polite">
        {plan !== null && countdown !== null && countdown > 0 && (
          <span className="countdown-number">{countdown}</span>
        )}
        {plan !== null &&
          countdown === null &&
          activeConfig.predictability !== PredictabilityMode.Background && (
            <p>
              {onsetMessage(
                activeConfig.category,
                plan.windowSec.min,
                plan.windowSec.max,
                activeConfig.predictability === PredictabilityMode.Probabilistic,
              )}
            </p>
          )}
        {activeConfig.predictability === PredictabilityMode.Background &&
          paused === null &&
          !ratingOpen && (
            <p className="dim">
              {modeHint(PredictabilityMode.Background, activeConfig.category)}
            </p>
          )}
        {plan === null &&
          engine.state === 'running' &&
          activeConfig.predictability !== PredictabilityMode.Background && (
            <p className="dim">
              {modeHint(activeConfig.predictability, activeConfig.category)}
            </p>
          )}
      </div>

      {!activeIsUserMode &&
        activeConfig.predictability !== PredictabilityMode.AutoCountdown &&
        activeConfig.predictability !== PredictabilityMode.Background &&
        engine.state === 'running' &&
        paused === null &&
        !ratingOpen && (
          <div className="btn-row">
            <button className="btn-primary" onClick={armFromReady}>
              Ready
            </button>
          </div>
        )}

      {isUserMode && phase === 'training' && (
        <p className="dim small" style={{ textAlign: 'center' }}>
          You decide when each sound happens.
        </p>
      )}

      {paused !== null && (
        <div className="overlay">
          <div className="card">
            <h2>Paused</h2>
            {paused === 'visibility' ? (
              <p>
                Training paused because the app went to the background. Any
                pending pop was cancelled.
              </p>
            ) : (
              <p>Take your time. Nothing will pop while paused.</p>
            )}
            <div className="btn-row">
              <button
                className="btn-primary"
                onClick={() => {
                  guardRef.current!.acknowledgeInterruption();
                  engine.resume();
                }}
              >
                Resume
              </button>
              <button className="btn-stop" onClick={stopEverything}>
                End session
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingOpen && (
        <div className="overlay">
          <div className="card">
            <h2>Quick check</h2>
            <RatingScale
              label="How strong was your physical startle?"
              lowAnchor="None"
              highAnchor="Very strong"
              value={pending.startle}
              onChange={(v) => setPending((p) => ({ ...p, startle: v }))}
            />
            <RatingScale
              label="How afraid or distressed did you feel?"
              lowAnchor="Not at all"
              highAnchor="Extremely"
              value={pending.distress}
              onChange={(v) => setPending((p) => ({ ...p, distress: v }))}
            />
            <label className="field">
              <span>How long until you felt back to normal?</span>
              <select
                value={pending.recovery ?? ''}
                onChange={(e) =>
                  setPending((p) => ({
                    ...p,
                    recovery: (e.target.value || null) as PendingRatings['recovery'],
                  }))
                }
              >
                <option value="">(skip)</option>
                <option value="under-5s">Under 5 seconds</option>
                <option value="5-15s">5–15 seconds</option>
                <option value="15-30s">15–30 seconds</option>
                <option value="30-60s">30–60 seconds</option>
                <option value="over-60s">Over 60 seconds</option>
              </select>
            </label>
            <div className="btn-row">
              <button
                className="btn-primary"
                disabled={pending.startle === null || pending.distress === null}
                onClick={() =>
                  engine.submitRatings({
                    startle: pending.startle,
                    distress: pending.distress,
                    recovery: pending.recovery,
                  })
                }
              >
                Save
              </button>
              <button onClick={() => engine.skipRating()}>Skip</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
