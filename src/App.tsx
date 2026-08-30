import { lazy, Suspense, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type UserSettings } from './core/types';
import { closeInterruptedSessions } from './core/session/recovery';
import { repository } from './ui/appContext';
import { HomeScreen } from './ui/screens/HomeScreen';
import { OnboardingScreen } from './ui/screens/OnboardingScreen';
import { CalibrationScreen } from './ui/screens/CalibrationScreen';
import { SessionScreen } from './ui/screens/SessionScreen';
import { ExperimentScreen } from './ui/screens/ExperimentScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

// Charts are heavy; loaded on demand (still precached for offline use).
const DashboardScreen = lazy(() =>
  import('./ui/screens/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
);

export type Screen =
  | 'home'
  | 'onboarding'
  | 'calibration'
  | 'session'
  | 'experiment'
  | 'dashboard'
  | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Close sessions left open by a crash/close. Never plays sound.
      await closeInterruptedSessions(repository);
      const loaded = await repository.getSettings();
      if (cancelled) return;
      setSettings(loaded);
      if (!loaded.onboardingCompleted) setScreen('onboarding');
      else if (!loaded.calibrationCompleted) setScreen('calibration');
      else setScreen('home');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = async (next: UserSettings) => {
    setSettings(next);
    await repository.saveSettings(next);
  };

  if (screen === null) {
    return (
      <main className="screen">
        <p className="dim">Loading…</p>
      </main>
    );
  }

  switch (screen) {
    case 'onboarding':
      return (
        <OnboardingScreen
          settings={settings}
          onComplete={async (next) => {
            await updateSettings(next);
            setScreen(next.calibrationCompleted ? 'home' : 'calibration');
          }}
        />
      );
    case 'calibration':
      return (
        <CalibrationScreen
          settings={settings}
          onComplete={async (next) => {
            await updateSettings(next);
            setScreen('home');
          }}
        />
      );
    case 'session':
      return (
        <SessionScreen
          settings={settings}
          onSettingsChange={updateSettings}
          onExit={() => setScreen('home')}
        />
      );
    case 'experiment':
      return (
        <ExperimentScreen settings={settings} onExit={() => setScreen('home')} />
      );
    case 'dashboard':
      return (
        <Suspense
          fallback={
            <main className="screen">
              <p className="dim">Loading charts…</p>
            </main>
          }
        >
          <DashboardScreen onExit={() => setScreen('home')} />
        </Suspense>
      );
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          onSettingsChange={updateSettings}
          onExit={() => setScreen('home')}
          onDataDeleted={() => {
            setSettings(DEFAULT_SETTINGS);
            setScreen('onboarding');
          }}
        />
      );
    case 'home':
    default:
      return <HomeScreen onNavigate={setScreen} />;
  }
}
