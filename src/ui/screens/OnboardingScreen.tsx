import { useState } from 'react';
import { useScrollReset } from '../useScrollReset';
import type { UserSettings } from '../../core/types';

const SCREENING_ITEMS: Array<{ id: string; label: string }> = [
  { id: 'pain', label: 'Ordinary everyday sounds cause me physical pain' },
  { id: 'tinnitus', label: 'Sounds worsen my tinnitus (ringing in the ears)' },
  { id: 'hearing', label: 'I have hearing difficulties or a hearing disorder' },
  { id: 'vertigo', label: 'Sounds cause me dizziness or vertigo' },
  { id: 'other-auditory', label: 'I have other unusual physical reactions to sound' },
  {
    id: 'trauma',
    label:
      'Sudden sounds are strongly connected to traumatic memories or PTSD-like reactions for me',
  },
];

interface Props {
  settings: UserSettings;
  onComplete(next: UserSettings): void;
}

export function OnboardingScreen({ settings, onComplete }: Props) {
  const [step, setStep] = useState<'intro' | 'screening' | 'advice'>('intro');
  useScrollReset(step);
  const [flags, setFlags] = useState<string[]>(settings.screeningFlags);

  const toggle = (id: string) =>
    setFlags((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const finish = () =>
    onComplete({ ...settings, onboardingCompleted: true, screeningFlags: flags });

  if (step === 'intro') {
    return (
      <main className="screen">
        <h1>Welcome</h1>
        <div className="card">
          <p>
            Startle Trainer helps you practice with sudden sounds — like balloon
            pops — in small, controlled steps. You start with quiet sounds that
            you trigger yourself, and only gradually move toward less
            predictable ones. You are always in control:
          </p>
          <ul>
            <li>A STOP button is always available. Stopping is always fine.</li>
            <li>Sounds only play during a session you started.</li>
            <li>The app never changes your device volume.</li>
            <li>Everything stays on this device. No account, no tracking.</li>
          </ul>
        </div>
        <div className="card notice">
          <p>
            <strong>This is not medical treatment.</strong> Startle Trainer is a
            self-directed training and experimentation tool. It does not
            diagnose, prevent, or treat any medical or psychiatric condition. A
            strong startle response is a real bodily reaction — this app will
            never tell you it is “all psychological”.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn-primary" onClick={() => setStep('screening')}>
            Continue
          </button>
        </div>
      </main>
    );
  }

  if (step === 'screening') {
    return (
      <main className="screen">
        <h1>A few questions first</h1>
        <p className="dim">
          These help you decide whether deliberate sound training is a good idea
          for you right now. Check anything that applies — or nothing.
        </p>
        <div className="card">
          {SCREENING_ITEMS.map((item) => (
            <label key={item.id} className="check-row">
              <input
                type="checkbox"
                checked={flags.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="btn-row">
          <button onClick={() => setStep('intro')}>Back</button>
          <button
            className="btn-primary"
            onClick={() => (flags.length > 0 ? setStep('advice') : finish())}
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <h1>Please read before training</h1>
      <div className="card notice">
        <p>
          You checked one or more items that can matter when deliberately
          practicing with sound. This app cannot tell what is behind them — it
          does not diagnose hearing conditions, hyperacusis, misophonia, PTSD,
          or anything else.
        </p>
        <p>
          <strong>
            Please consider discussing deliberate sound exposure with a
            healthcare professional
          </strong>{' '}
          (for example a doctor, audiologist, or therapist) before doing
          intensive training. If you continue, start very quietly, keep
          sessions short, and stop whenever something feels wrong.
        </p>
      </div>
      <div className="btn-row">
        <button onClick={() => setStep('screening')}>Back</button>
        <button className="btn-primary" onClick={finish}>
          I understand — continue
        </button>
      </div>
    </main>
  );
}
