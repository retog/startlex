import { useState } from 'react';
import { INTENSITY_LABELS, type IntensityLevel, type UserSettings } from '../../core/types';
import { buildCsvExport, buildJsonExport } from '../../storage/exporters';
import { downloadFile } from '../../storage/download';
import { repository } from '../appContext';

interface Props {
  settings: UserSettings;
  onSettingsChange(next: UserSettings): Promise<void> | void;
  onExit(): void;
  onDataDeleted(): void;
}

export function SettingsScreen({ settings, onSettingsChange, onExit, onDataDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const exportJson = async () => {
    const [sessions, trials, loaded] = await Promise.all([
      repository.listSessions(),
      repository.listTrials(),
      repository.getSettings(),
    ]);
    downloadFile(
      `startle-trainer-export-${stamp()}.json`,
      buildJsonExport(sessions, trials, loaded),
      'application/json',
    );
    setMessage('JSON export downloaded.');
  };

  const exportCsv = async () => {
    const [sessions, trials] = await Promise.all([
      repository.listSessions(),
      repository.listTrials(),
    ]);
    downloadFile(
      `startle-trainer-trials-${stamp()}.csv`,
      buildCsvExport(sessions, trials),
      'text/csv',
    );
    setMessage('CSV export downloaded.');
  };

  const deleteAll = async () => {
    await repository.deleteAllData();
    setConfirmDelete(false);
    onDataDeleted();
  };

  return (
    <main className="screen">
      <h1>Settings &amp; data</h1>

      <div className="card">
        <h2>Training limits</h2>
        <label className="field">
          <span>
            Personal maximum intensity: {INTENSITY_LABELS[settings.maxIntensity]} (
            {settings.maxIntensity}/5)
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={settings.maxIntensity}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                maxIntensity: Number(e.target.value) as IntensityLevel,
              })
            }
          />
        </label>
        <label className="field">
          <span>Maximum stronger pops (level 4–5) per session</span>
          <select
            value={settings.maxStrongStimuliPerSession ?? 'none'}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                maxStrongStimuliPerSession:
                  e.target.value === 'none' ? null : Number(e.target.value),
              })
            }
          >
            <option value="none">No limit</option>
            {[3, 5, 10, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Rating prompts: roughly one every N pops</span>
          <select
            value={settings.ratingSamplingEveryNTrials}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                ratingSamplingEveryNTrials: Number(e.target.value),
              })
            }
          >
            {[2, 3, 4, 6, 8].map((n) => (
              <option key={n} value={n}>
                every ~{n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Your data</h2>
        <p className="dim small">
          Everything is stored only on this device. No account, no cloud, no
          analytics. Exports are files you download and keep yourself.
        </p>
        <div className="btn-row">
          <button onClick={exportJson}>Export data (JSON)</button>
          <button onClick={exportCsv}>Export trials (CSV)</button>
        </div>
        {message && <p className="dim small">{message}</p>}
        <div className="btn-row">
          <button className="btn-stop" onClick={() => setConfirmDelete(true)}>
            Delete all data
          </button>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn-primary" onClick={onExit}>
          Back
        </button>
      </div>

      {confirmDelete && (
        <div className="overlay">
          <div className="card">
            <h2>Delete all data?</h2>
            <p>
              This permanently removes every session, trial, and setting from
              this device. Consider exporting first. This cannot be undone.
            </p>
            <div className="btn-row">
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn-stop" onClick={deleteAll}>
                Yes, delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
