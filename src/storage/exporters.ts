/**
 * Data export. Schema documented in docs/EXPORT_SCHEMA.md.
 * Timestamps are ISO 8601 (UTC).
 */
import type { Session, Trial, UserSettings } from '../core/types';

export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  application: string;
  sessions: Session[];
  trials: Trial[];
  settings: Omit<UserSettings, 'screeningFlags'> & { screeningFlags?: string[] };
}

export function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

export function buildJsonExport(
  sessions: Session[],
  trials: Trial[],
  settings: UserSettings,
  now: () => number = Date.now,
): string {
  const bundle: ExportBundle = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    application: 'startle-trainer',
    sessions,
    trials,
    settings,
  };
  return JSON.stringify(bundle, null, 2);
}

export const CSV_COLUMNS = [
  'trial_id',
  'session_id',
  'session_started_at',
  'trial_timestamp',
  'mode',
  'stimulus_id',
  'stimulus_category',
  'intensity_level',
  'amplitude',
  'predictability',
  'intended_delay_sec',
  'intended_audio_time',
  'scheduled_audio_time',
  'user_initiated',
  'visual_context',
  'experiment_condition',
  'anticipatory_anxiety',
  'startle_rating',
  'distress_rating',
  'recovery_bucket',
  'outcome',
  'paused_during',
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Trial-level CSV; one row per trial, session fields denormalized in. */
export function buildCsvExport(sessions: Session[], trials: Trial[]): string {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const lines = [CSV_COLUMNS.join(',')];
  for (const t of trials) {
    const session = sessionById.get(t.sessionId);
    const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      trial_id: t.id,
      session_id: t.sessionId,
      session_started_at: session ? iso(session.startedAt) : null,
      trial_timestamp: iso(t.timestamp),
      mode: session?.mode ?? null,
      stimulus_id: t.stimulusId,
      stimulus_category: t.stimulusCategory,
      intensity_level: t.intensity,
      amplitude: t.amplitude,
      predictability: t.predictability,
      intended_delay_sec: t.intendedDelaySec,
      intended_audio_time: t.intendedAudioTime,
      scheduled_audio_time: t.scheduledAudioTime,
      user_initiated: t.userInitiated,
      visual_context: t.visualContext,
      experiment_condition: t.experimentCondition,
      anticipatory_anxiety: session?.anticipatoryAnxiety ?? null,
      startle_rating: t.ratings.startle,
      distress_rating: t.ratings.distress,
      recovery_bucket: t.ratings.recovery,
      outcome: t.outcome,
      paused_during: t.pausedDuring,
    };
    lines.push(CSV_COLUMNS.map((c) => csvEscape(row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
