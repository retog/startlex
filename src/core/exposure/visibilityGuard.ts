/**
 * Maps page visibility/lifecycle changes onto the exposure engine.
 *
 * SAFETY: when the app loses foreground status, training pauses and every
 * unsounded stimulus is cancelled. Resuming always requires an explicit
 * user action — regaining visibility never restarts exposure by itself.
 */
import type { ExposureEngine } from './engine';

export class VisibilityGuard {
  private wasInterrupted = false;

  constructor(private readonly engine: ExposureEngine) {}

  /** Call with `document.visibilityState === 'visible'` on every change. */
  handleVisibilityChange(visible: boolean): void {
    if (!visible) {
      const state = this.engine.state;
      if (state === 'running' || state === 'pending' || state === 'rating') {
        this.wasInterrupted = true;
      }
      this.engine.pause('visibility');
    }
    // Becoming visible again does nothing: resume is user-gesture only.
  }

  /** Whether training was interrupted by a visibility loss. */
  get interrupted(): boolean {
    return this.wasInterrupted;
  }

  acknowledgeInterruption(): void {
    this.wasInterrupted = false;
  }
}
