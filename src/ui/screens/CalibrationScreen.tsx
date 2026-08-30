import { useState } from 'react';
import { INTENSITY_LABELS, intensityToAmplitude, type IntensityLevel, type UserSettings } from '../../core/types';
import { scheduler } from '../appContext';

interface Props {
  settings: UserSettings;
  onComplete(next: UserSettings): void;
}

/**
 * Volume calibration before the first session. Plays reference pops at the
 * user's request only. The app never changes system volume — the user sets
 * their device volume so that "Moderate" is clearly audible but comfortable.
 */
export function CalibrationScreen({ settings, onComplete }: Props) {
  const [played, setPlayed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [maxIntensity, setMaxIntensity] = useState<IntensityLevel>(settings.maxIntensity);

  const playReference = async (level: IntensityLevel) => {
    setBusy(true);
    try {
      await scheduler.unlock();
      await scheduler.preload(['pop-soft']);
      scheduler.schedule('pop-soft', scheduler.now() + 0.1, intensityToAmplitude(level));
      setPlayed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <h1>Sound setup</h1>
      <div className="card notice">
        <p>
          <strong>Set a safe volume first.</strong> Please do not set your
          speakers or headphones to loud or uncomfortable levels — this
          training works with quiet sounds. The app only scales sounds
          <em> below</em> your device's media volume; it never raises it.
        </p>
        <p className="dim small">
          Levels here are relative app levels ({INTENSITY_LABELS[1]} … {INTENSITY_LABELS[5]}),
          not calibrated decibel values.
        </p>
      </div>
      <div className="card">
        <p>
          1. Set your device media volume to a normal, comfortable listening
          level.
        </p>
        <p>2. Play the test sounds and adjust your device volume so the “Moderate” pop is clearly audible but easy to tolerate.</p>
        <div className="btn-row">
          <button disabled={busy} onClick={() => playReference(1)}>
            Play very soft pop
          </button>
          <button disabled={busy} onClick={() => playReference(3)}>
            Play moderate pop
          </button>
        </div>
      </div>
      <div className="card">
        <p>Personal maximum app intensity — training will never go above this. You can change it later in Settings.</p>
        <label className="field">
          <span>
            Maximum: {INTENSITY_LABELS[maxIntensity]} ({maxIntensity}/5)
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={maxIntensity}
            onChange={(e) => setMaxIntensity(Number(e.target.value) as IntensityLevel)}
          />
        </label>
      </div>
      <div className="btn-row">
        <button
          className="btn-primary"
          disabled={!played}
          onClick={() =>
            onComplete({ ...settings, calibrationCompleted: true, maxIntensity })
          }
        >
          {played ? 'Done — sounds are comfortable' : 'Play a test sound first'}
        </button>
      </div>
    </main>
  );
}
