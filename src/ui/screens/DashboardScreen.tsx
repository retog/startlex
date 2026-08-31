import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { groupBy, habituation, mean } from '../../core/statistics/descriptive';
import {
  CATEGORY_LABELS,
  INTENSITY_LABELS,
  RECOVERY_BUCKET_SECONDS,
  type IntensityLevel,
  type Session,
  type Trial,
} from '../../core/types';
import { repository } from '../appContext';

interface Props {
  onExit(): void;
}

const AXIS = { stroke: '#b9bfd9', fontSize: 12 };
const PREDICTABILITY_SHORT: Record<string, string> = {
  'user-triggered': 'You pop',
  'user-countdown': 'Your 3-2-1',
  'auto-countdown': 'Auto 3-2-1',
  'window-narrow': '3–5 s window',
  'window-moderate': '3–10 s window',
  'window-wide': '20 s window',
  probabilistic: 'Probabilistic',
  background: 'Background',
};

function ratedOf(trials: Trial[], key: 'startle' | 'distress'): number[] {
  return trials
    .filter((t) => t.outcome === 'completed')
    .map((t) => t.ratings[key])
    .filter((v): v is number => v !== null);
}

export function DashboardScreen({ onExit }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setSessions(await repository.listSessions());
      setTrials(await repository.listTrials());
    })();
  }, []);

  const trialsBySession = useMemo(() => groupBy(trials, (t) => t.sessionId), [trials]);

  /** Per-session aggregates in chronological order. */
  const perSession = useMemo(() => {
    return sessions
      .filter((s) => s.mode === 'balloon')
      .map((s, i) => {
        const own = trialsBySession.get(s.id) ?? [];
        const startle = ratedOf(own, 'startle');
        const distress = ratedOf(own, 'distress');
        const recoverySecs = own
          .filter((t) => t.outcome === 'completed' && t.ratings.recovery !== null)
          .map((t) => RECOVERY_BUCKET_SECONDS[t.ratings.recovery!]);
        return {
          index: i + 1,
          date: new Date(s.startedAt).toLocaleDateString(),
          session: s,
          meanStartle: mean(startle),
          meanDistress: mean(distress),
          nStartle: startle.length,
          nDistress: distress.length,
          anxiety: s.anticipatoryAnxiety,
          meanRecoverySec: mean(recoverySecs),
          nRecovery: recoverySecs.length,
          trialCount: own.filter((t) => t.outcome === 'completed').length,
        };
      });
  }, [sessions, trialsBySession]);

  const byIntensity = useMemo(() => {
    const completed = trials.filter((t) => t.outcome === 'completed');
    return [1, 2, 3, 4, 5].map((level) => {
      const own = completed.filter((t) => t.intensity === level);
      const startle = ratedOf(own, 'startle');
      const distress = ratedOf(own, 'distress');
      return {
        label: `${INTENSITY_LABELS[level as IntensityLevel]}`,
        meanStartle: mean(startle),
        meanDistress: mean(distress),
        n: Math.max(startle.length, distress.length),
      };
    }).filter((d) => d.n > 0);
  }, [trials]);

  const byPredictability = useMemo(() => {
    const completed = trials.filter((t) => t.outcome === 'completed');
    const groups = groupBy(completed, (t) => t.predictability);
    return [...groups.entries()].map(([mode, own]) => {
      const startle = ratedOf(own, 'startle');
      const distress = ratedOf(own, 'distress');
      return {
        label: PREDICTABILITY_SHORT[mode] ?? mode,
        meanStartle: mean(startle),
        meanDistress: mean(distress),
        n: Math.max(startle.length, distress.length),
      };
    }).filter((d) => d.n > 0);
  }, [trials]);

  const byCategory = useMemo(() => {
    const completed = trials.filter((t) => t.outcome === 'completed');
    const groups = groupBy(completed, (t) => t.stimulusCategory);
    return [...groups.entries()].map(([category, own]) => {
      const startle = ratedOf(own, 'startle');
      const distress = ratedOf(own, 'distress');
      return {
        label: CATEGORY_LABELS[category] ?? category,
        meanStartle: mean(startle),
        meanDistress: mean(distress),
        n: Math.max(startle.length, distress.length),
      };
    }).filter((d) => d.n > 0);
  }, [trials]);

  const selected = selectedSession
    ? perSession.find((p) => p.session.id === selectedSession)
    : null;
  const selectedHabituation = useMemo(() => {
    if (!selected) return null;
    const own = trialsBySession.get(selected.session.id) ?? [];
    return {
      startle: habituation(ratedOf(own, 'startle')),
      distress: habituation(ratedOf(own, 'distress')),
    };
  }, [selected, trialsBySession]);

  if (perSession.length === 0) {
    return (
      <main className="screen">
        <h1>Progress</h1>
        <p className="dim">No sessions yet. Your history and trends will appear here.</p>
        <div className="btn-row">
          <button className="btn-primary" onClick={onExit}>
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>Progress</h1>
      <p className="dim small">
        Physical startle and fear/distress are tracked separately on purpose —
        they can change independently. All values are simple averages of your
        own 0–10 ratings; sample sizes are shown, and no statistical
        significance is implied.
      </p>

      <div className="chart-block card">
        <h3>Physical startle across sessions</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={perSession}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
            <XAxis dataKey="index" {...AXIS} />
            <YAxis domain={[0, 10]} {...AXIS} />
            <Tooltip
              formatter={(v: number) => v?.toFixed?.(1)}
              labelFormatter={(i) => {
                const p = perSession[Number(i) - 1];
                return p ? `${p.date} (${p.nStartle} rated)` : i;
              }}
            />
            <Line dataKey="meanStartle" name="Mean startle" stroke="#7aa7ff" strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block card">
        <h3>Fear / distress across sessions</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={perSession}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
            <XAxis dataKey="index" {...AXIS} />
            <YAxis domain={[0, 10]} {...AXIS} />
            <Tooltip
              formatter={(v: number) => v?.toFixed?.(1)}
              labelFormatter={(i) => {
                const p = perSession[Number(i) - 1];
                return p ? `${p.date} (${p.nDistress} rated)` : i;
              }}
            />
            <Line dataKey="meanDistress" name="Mean distress" stroke="#ff8fa3" strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block card">
        <h3>Anticipatory anxiety before sessions</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={perSession}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
            <XAxis dataKey="index" {...AXIS} />
            <YAxis domain={[0, 10]} {...AXIS} />
            <Tooltip labelFormatter={(i) => perSession[Number(i) - 1]?.date ?? i} />
            <Line dataKey="anxiety" name="Anticipatory anxiety" stroke="#ffd280" strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-block card">
        <h3>Recovery time (average seconds, from your answers)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={perSession}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
            <XAxis dataKey="index" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip
              formatter={(v: number) => `${v?.toFixed?.(0)} s`}
              labelFormatter={(i) => {
                const p = perSession[Number(i) - 1];
                return p ? `${p.date} (${p.nRecovery} rated)` : i;
              }}
            />
            <Line dataKey="meanRecoverySec" name="Mean recovery" stroke="#7fd8a5" strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {byIntensity.length > 0 && (
        <div className="chart-block card">
          <h3>Response by sound intensity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byIntensity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis domain={[0, 10]} {...AXIS} />
              <Tooltip
                formatter={(v: number) => v?.toFixed?.(1)}
                labelFormatter={(label) => {
                  const d = byIntensity.find((x) => x.label === label);
                  return d ? `${label} (n=${d.n})` : label;
                }}
              />
              <Legend />
              <Bar dataKey="meanStartle" name="Startle" fill="#7aa7ff" />
              <Bar dataKey="meanDistress" name="Distress" fill="#ff8fa3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byCategory.length > 1 && (
        <div className="chart-block card">
          <h3>Response by sound category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis domain={[0, 10]} {...AXIS} />
              <Tooltip
                formatter={(v: number) => v?.toFixed?.(1)}
                labelFormatter={(label) => {
                  const d = byCategory.find((x) => x.label === label);
                  return d ? `${label} (n=${d.n})` : label;
                }}
              />
              <Legend />
              <Bar dataKey="meanStartle" name="Startle" fill="#7aa7ff" />
              <Bar dataKey="meanDistress" name="Distress" fill="#ff8fa3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {byPredictability.length > 0 && (
        <div className="chart-block card">
          <h3>Response by predictability</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byPredictability}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a4370" />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis domain={[0, 10]} {...AXIS} />
              <Tooltip
                formatter={(v: number) => v?.toFixed?.(1)}
                labelFormatter={(label) => {
                  const d = byPredictability.find((x) => x.label === label);
                  return d ? `${label} (n=${d.n})` : label;
                }}
              />
              <Legend />
              <Bar dataKey="meanStartle" name="Startle" fill="#7aa7ff" />
              <Bar dataKey="meanDistress" name="Distress" fill="#ff8fa3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3>Sessions</h3>
        <table className="session-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Pops</th>
              <th>Startle</th>
              <th>Distress</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...perSession].reverse().map((p) => (
              <tr key={p.session.id}>
                <td>
                  {p.date}
                  {p.session.interrupted ? ' ·interrupted' : ''}
                </td>
                <td>{p.trialCount}</td>
                <td>
                  {p.meanStartle?.toFixed(1) ?? '—'}{' '}
                  <span className="dim small">(n={p.nStartle})</span>
                </td>
                <td>
                  {p.meanDistress?.toFixed(1) ?? '—'}{' '}
                  <span className="dim small">(n={p.nDistress})</span>
                </td>
                <td>
                  <button
                    style={{ minHeight: 36, padding: '4px 10px' }}
                    onClick={() =>
                      setSelectedSession(
                        selectedSession === p.session.id ? null : p.session.id,
                      )
                    }
                  >
                    {selectedSession === p.session.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <h3>Session detail — {selected.date}</h3>
          <p className="dim small">
            Mode: {selected.session.mode}; anticipatory anxiety:{' '}
            {selected.anxiety ?? '—'}; note: {selected.session.note ?? '—'}
          </p>
          <h4>Within-session habituation</h4>
          {selectedHabituation?.startle ? (
            <p>
              Startle — first third of rated pops: {selectedHabituation.startle.firstThirdMean.toFixed(1)},
              last third: {selectedHabituation.startle.lastThirdMean.toFixed(1)}{' '}
              <span className="dim small">(n={selectedHabituation.startle.n})</span>
            </p>
          ) : (
            <p className="dim small">
              Not enough rated pops in this session to estimate startle
              habituation (at least 6 needed).
            </p>
          )}
          {selectedHabituation?.distress ? (
            <p>
              Distress — first third: {selectedHabituation.distress.firstThirdMean.toFixed(1)},
              last third: {selectedHabituation.distress.lastThirdMean.toFixed(1)}{' '}
              <span className="dim small">(n={selectedHabituation.distress.n})</span>
            </p>
          ) : (
            <p className="dim small">
              Not enough rated pops for distress habituation.
            </p>
          )}
          <p className="dim small">
            A session without visible within-session decrease is not a failed
            session — improvement across sessions matters more.
          </p>
        </div>
      )}

      <div className="btn-row">
        <button className="btn-primary" onClick={onExit}>
          Back
        </button>
      </div>
    </main>
  );
}
