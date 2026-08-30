/**
 * Session recovery after an application restart.
 *
 * If the app was closed mid-session (crash, tab discarded, battery…), open
 * sessions remain with `endedAt: null`. On startup they are closed and
 * marked interrupted so history and statistics stay consistent. No sound is
 * ever played as part of recovery.
 */
import type { ClockFn, SessionRepository } from '../ports';
import type { Session } from '../types';

export async function closeInterruptedSessions(
  repo: SessionRepository,
  now: ClockFn = () => Date.now(),
): Promise<Session[]> {
  const sessions = await repo.listSessions();
  const open = sessions.filter((s) => s.endedAt === null);
  const closed: Session[] = [];
  for (const session of open) {
    const trials = await repo.listTrials(session.id);
    const lastActivity =
      trials.length > 0 ? trials[trials.length - 1].timestamp : session.startedAt;
    const updated: Session = {
      ...session,
      endedAt: Math.min(now(), Math.max(lastActivity, session.startedAt)),
      interrupted: true,
    };
    await repo.saveSession(updated);
    closed.push(updated);
  }
  return closed;
}
