import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'startle-trainer-install-banner-dismissed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Prominent "install this app" banner. Uses the browser's install prompt
 * where available (Chromium `beforeinstallprompt`); on iOS Safari, which has
 * no prompt API, it shows the Add-to-Home-Screen steps instead. Hidden once
 * installed, when running standalone, or after the user dismisses it.
 */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable — banner just stays dismissed for this visit.
    }
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  };

  if (installed || dismissed) return null;
  const showIosHint = promptEvent === null && isIos();
  if (promptEvent === null && !showIosHint) return null;

  return (
    <div className="card install-banner" role="region" aria-label="Install this app">
      <p>
        <strong>📲 Install Startle Trainer</strong>
        <br />
        <span className="dim">
          Add it to your home screen: it opens full-screen, works fully
          offline, and your data stays on this device.
        </span>
      </p>
      {showIosHint ? (
        <p className="dim small">
          In Safari: tap the <strong>Share</strong> button, then{' '}
          <strong>“Add to Home Screen”</strong>.
        </p>
      ) : null}
      <div className="btn-row">
        {promptEvent !== null && (
          <button className="btn-primary" onClick={install}>
            Install app
          </button>
        )}
        <button onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
