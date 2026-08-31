import { useEffect, useRef, useState } from 'react';
import { ExposureEngine, type EngineEvent, type TrialPlan } from '../../core/exposure/engine';
import { VisibilityGuard } from '../../core/exposure/visibilityGuard';
import {
  MIN_OBSERVATIONS_PER_CONDITION,
  computeEffects,
  conditionSpecs,
  defaultDesign,
  generateConditionSequence,
  interpretEffects,
  summarizeByCondition,
  type ExperimentCondition,
} from '../../core/experiments/experiment2x2';
import { newId, seededRandom } from '../../core/random';
import {
  PredictabilityMode,
  type Session,
  type Trial,
  type UserSettings,
} from '../../core/types';
import { repository, scheduler } from '../appContext';
import { Balloon, BALLOON_COLORS } from '../components/Balloon';
import { RatingScale } from '../components/RatingScale';

const TRIALS_PER_RUN = 8; // 2 balanced blocks of the 4 conditions

interface Props {
  settings: UserSettings;
  onExit(): void;
}

export function ExperimentScreen({ settings, onExit }: Props) {
  const engineRef = useRef<ExposureEngine | null>(null);
  const guardRef = useRef<VisibilityGuard | null>(null);
  if (!engineRef.current) {
    engineRef.current = new ExposureEngine(scheduler, seededRandom((Date.now() >>> 0) ^ 0xe5e5));
    guardRef.current = new VisibilityGuard(engineRef.current);
  }
  const engine = engineRef.current;

  const design = defaultDesign(settings.maxIntensity);
  const specs = conditionSpecs(design);

  const [stage, setStage] = useState<'intro' | 'running' | 'results'>('intro');
  const [sequence, setSequence] = useState<ExperimentCondition[]>([]);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<TrialPlan | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [popping, setPopping] = useState(false);
  const [paused, setPaused] = useState<null | string>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [startle, setStartle] = useState<number | null>(null);
  const [distress, setDistress] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<Trial['ratings']['recovery']>(null);
  const [allExperimentTrials, setAllExperimentTrials] = useState<Trial[]>([]);
  const [balloonPos, setBalloonPos] = useState({ x: 0.4, y: 0.3, color: BALLOON_COLORS[1] });
  const indexRef = useRef(0);
  indexRef.current = index;
  const sequenceRef = useRef<ExperimentCondition[]>([]);
  sequenceRef.current = sequence;
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const condition = sequence[index] ?? null;
  const spec = condition ? specs.find((s) => s.condition === condition)! : null;

  /* engine events */
  useEffect(() => {
    return engine.on((e: EngineEvent) => {
      switch (e.type) {
        case 'armed':
          setPlan(e.plan);
          break;
        case 'sounded':
          setPopping(true);
          setPlan(null);
          break;
        case 'rating-requested':
          setStartle(null);
          setDistress(null);
          setRecovery(null);
          setRatingOpen(true);
          break;
        case 'trial-completed': {
          const trial: Trial = {
            ...e.trial,
            experimentCondition: sequenceRef.current[indexRef.current] ?? null,
          };
          if (sessionRef.current && trial.outcome === 'completed') {
            void repository.saveTrial(trial);
            setAllExperimentTrials((t) => [...t, trial]);
          }
          setRatingOpen(false);
          break;
        }
        case 'block-completed': {
          const next = indexRef.current + 1;
          window.setTimeout(() => {
            setPopping(false);
            setBalloonPos({
              x: 0.12 + Math.random() * 0.55,
              y: 0.15 + Math.random() * 0.45,
              color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
            });
            if (next >= sequenceRef.current.length) {
              void endRun();
            } else {
              setIndex(next);
            }
          }, 450);
          break;
        }
        case 'paused':
          setPaused(e.reason);
          setPlan(null);
          break;
        case 'resumed':
          setPaused(null);
          break;
        default:
          break;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  /* per-trial block start */
  useEffect(() => {
    if (stage !== 'running' || !session || !spec) return;
    if (engine.state !== 'idle') return;
    engine.startBlock({
      sessionId: session.id,
      config: spec.config,
      trialsPlanned: 1,
      visualContext: 'experiment',
      sampling: { everyNTrials: 1, minGap: 0 }, // experiment rates every trial
      strongStimuliBudget: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, session, index]);

  /* tick loop */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      engine.tick();
      const remaining = engine.timeToOnset();
      if (remaining !== null && plan?.predictability === PredictabilityMode.UserCountdown) {
        setCountdown(Math.min(3, Math.max(0, Math.ceil(remaining))));
      } else {
        setCountdown(null);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, plan]);

  /* visibility + unmount safety */
  useEffect(() => {
    const onVisibility = () =>
      guardRef.current!.handleVisibilityChange(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine.stop();
      scheduler.cancelAll();
    };
  }, [engine]);

  const begin = async () => {
    await scheduler.unlock();
    await scheduler.preload(scheduler.listStimuli().map((s) => s.id));
    const s: Session = {
      id: newId('session'),
      startedAt: Date.now(),
      endedAt: null,
      mode: 'experiment',
      anticipatoryAnxiety: null,
      difficulty: specs[0].config,
      note: null,
      interrupted: false,
    };
    await repository.saveSession(s);
    const historic = (await repository.listTrials()).filter(
      (t) => t.experimentCondition !== null,
    );
    setAllExperimentTrials(historic);
    setSession(s);
    sessionRef.current = s;
    setSequence(generateConditionSequence(seededRandom(Date.now() >>> 0), TRIALS_PER_RUN / 4));
    setIndex(0);
    setStage('running');
  };

  const endRun = async () => {
    engine.stop();
    const s = sessionRef.current;
    if (s) await repository.saveSession({ ...s, endedAt: Date.now() });
    setStage('results');
  };

  /* ============ render ============ */

  if (stage === 'intro') {
    return (
      <main className="screen">
        <h1>Experiment mode</h1>
        <div className="card">
          <p>
            This short experiment ({TRIALS_PER_RUN} pops) mixes four conditions
            in random order:
          </p>
          <ul>
            {specs.map((s) => (
              <li key={s.condition}>{s.label}</li>
            ))}
          </ul>
          <p>
            You rate every pop, so it is more interruptive than normal training
            — that's on purpose here. Over several runs, the app can describe
            whether loudness or unpredictability seems to matter more for you.
          </p>
          <p className="dim small">
            "Stronger" respects your personal maximum intensity. Results are
            descriptive observations, not medical conclusions.
          </p>
        </div>
        <div className="btn-row">
          <button onClick={onExit}>Back</button>
          <button className="btn-primary" onClick={begin}>
            Start experiment run
          </button>
        </div>
      </main>
    );
  }

  if (stage === 'results') {
    const summaries = summarizeByCondition(allExperimentTrials);
    const effects = computeEffects(summaries);
    const interpretations = interpretEffects(effects);
    return (
      <main className="screen">
        <h1>Experiment results so far</h1>
        <div className="card">
          <table className="session-table">
            <thead>
              <tr>
                <th>Condition</th>
                <th>n</th>
                <th>Startle</th>
                <th>Distress</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const label = specs.find((x) => x.condition === s.condition)?.label;
                return (
                  <tr key={s.condition}>
                    <td>{label}</td>
                    <td>{s.nRated}</td>
                    <td>{s.meanStartle?.toFixed(1) ?? '—'}</td>
                    <td>{s.meanDistress?.toFixed(1) ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {interpretations.length > 0 ? (
          <div className="card">
            {interpretations.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="dim">
              Not enough observations yet for any interpretation — at least{' '}
              {MIN_OBSERVATIONS_PER_CONDITION} rated pops per condition are
              needed. Run the experiment again another day to collect more.
            </p>
          </div>
        )}
        <div className="btn-row">
          <button className="btn-primary" onClick={onExit}>
            Done
          </button>
        </div>
      </main>
    );
  }

  /* running */
  const predictable = spec?.config.predictability === PredictabilityMode.UserCountdown;
  const canInteract = paused === null && !ratingOpen && engine.state === 'running';

  return (
    <main className="screen">
      <div className="training-topbar">
        <span>
          Experiment · {Math.min(index + 1, sequence.length)}/{sequence.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => engine.pause('user')} disabled={paused !== null}>
            Pause
          </button>
          <button className="btn-stop" onClick={endRun}>
            STOP
          </button>
        </div>
      </div>

      <div className="game-area">
        <Balloon
          x={balloonPos.x}
          y={balloonPos.y}
          color={balloonPos.color}
          popping={popping}
          onPop={predictable && canInteract ? () => engine.armTrial(true) : undefined}
          label={predictable ? 'Start the countdown to pop this balloon' : 'Balloon'}
        />
      </div>

      <div className="status-line" aria-live="polite">
        {countdown !== null && countdown > 0 && (
          <span className="countdown-number">{countdown}</span>
        )}
        {plan !== null && countdown === null && (
          <p>
            Balloon will pop within {plan.windowSec.min}–{plan.windowSec.max} seconds…
          </p>
        )}
        {plan === null && engine.state === 'running' && (
          <p className="dim">
            {predictable
              ? 'Tap the balloon to start a 3-2-1 countdown.'
              : 'Press Ready — this balloon pops at a less predictable moment.'}
          </p>
        )}
      </div>

      {!predictable && canInteract && plan === null && (
        <div className="btn-row">
          <button className="btn-primary" onClick={() => engine.armTrial(false)}>
            Ready
          </button>
        </div>
      )}

      {paused !== null && (
        <div className="overlay">
          <div className="card">
            <h2>Paused</h2>
            <p>
              {paused === 'visibility'
                ? 'Paused because the app went to the background. Any pending pop was cancelled.'
                : 'Nothing will pop while paused.'}
            </p>
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
              <button className="btn-stop" onClick={endRun}>
                End run
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingOpen && (
        <div className="overlay">
          <div className="card">
            <h2>Rate this pop</h2>
            <RatingScale
              label="How strong was your physical startle?"
              lowAnchor="None"
              highAnchor="Very strong"
              value={startle}
              onChange={setStartle}
            />
            <RatingScale
              label="How afraid or distressed did you feel?"
              lowAnchor="Not at all"
              highAnchor="Extremely"
              value={distress}
              onChange={setDistress}
            />
            <label className="field">
              <span>How long until you felt back to normal?</span>
              <select
                value={recovery ?? ''}
                onChange={(e) =>
                  setRecovery((e.target.value || null) as Trial['ratings']['recovery'])
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
                disabled={startle === null || distress === null}
                onClick={() => engine.submitRatings({ startle, distress, recovery })}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
