import { useEffect, useState } from 'react';
import type { Screen } from '../../App';

export function HomeScreen({ onNavigate }: { onNavigate(screen: Screen): void }) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return (
    <main className="screen">
      <h1>Startle Trainer</h1>
      <p className="dim">
        Gradual, self-paced training with sudden sounds — always under your
        control. {' '}
        <span className="offline-badge">
          {online ? 'online' : 'offline — everything still works'}
        </span>
      </p>
      <nav className="home-nav" aria-label="Main">
        <button className="btn-primary" onClick={() => onNavigate('session')}>
          <span className="title">Start training session</span>
          <span className="dim small">Balloon game · about 5–10 minutes</span>
        </button>
        <button onClick={() => onNavigate('experiment')}>
          <span className="title">Experiment mode</span>
          <span className="dim small">
            Explore what affects you more: loudness or unpredictability
          </span>
        </button>
        <button onClick={() => onNavigate('dashboard')}>
          <span className="title">Progress</span>
          <span className="dim small">Session history and trends</span>
        </button>
        <button onClick={() => onNavigate('settings')}>
          <span className="title">Settings &amp; data</span>
          <span className="dim small">Limits, export, delete</span>
        </button>
      </nav>
      <p className="dim small" style={{ marginTop: 'auto' }}>
        This app is a self-training and experimentation tool. It is not a
        medical device and does not diagnose or treat any condition.
      </p>
    </main>
  );
}
