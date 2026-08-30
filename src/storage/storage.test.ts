import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbSessionRepository } from './indexedDbRepository';
import { buildCsvExport, buildJsonExport, CSV_COLUMNS, type ExportBundle } from './exporters';
import { closeInterruptedSessions } from '../core/session/recovery';
import {
  DEFAULT_SETTINGS,
  PredictabilityMode,
  intensityToAmplitude,
  type Session,
  type Trial,
} from '../core/types';

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    startedAt: Date.UTC(2026, 7, 30, 10, 0, 0),
    endedAt: Date.UTC(2026, 7, 30, 10, 8, 0),
    mode: 'balloon',
    anticipatoryAnxiety: 3,
    difficulty: {
      intensity: 2,
      amplitude: intensityToAmplitude(2),
      predictability: PredictabilityMode.UserCountdown,
      category: 'balloon-pop',
    },
    note: null,
    interrupted: false,
    ...overrides,
  };
}

function makeTrial(id: string, sessionId: string, overrides: Partial<Trial> = {}): Trial {
  return {
    id,
    sessionId,
    timestamp: Date.UTC(2026, 7, 30, 10, 1, 0),
    stimulusId: 'pop-soft',
    stimulusCategory: 'balloon-pop',
    intensity: 2,
    amplitude: intensityToAmplitude(2),
    predictability: PredictabilityMode.UserCountdown,
    intendedDelaySec: 3,
    intendedAudioTime: 12.05,
    scheduledAudioTime: 12.05,
    userInitiated: true,
    visualContext: 'balloon-basic',
    ratings: { startle: 4, distress: 2, recovery: '5-15s' },
    outcome: 'completed',
    pausedDuring: false,
    experimentCondition: null,
    ...overrides,
  };
}

let repo: IndexedDbSessionRepository;
let factory: IDBFactory;

beforeEach(() => {
  factory = new IDBFactory(); // fresh in-memory DB per test
  repo = new IndexedDbSessionRepository(factory);
});

describe('IndexedDbSessionRepository', () => {
  it('persists and retrieves sessions and trials', async () => {
    const session = makeSession('s1');
    await repo.saveSession(session);
    await repo.saveTrial(makeTrial('t1', 's1'));
    await repo.saveTrial(makeTrial('t2', 's1', { timestamp: Date.UTC(2026, 7, 30, 10, 2) }));
    await repo.saveTrial(makeTrial('t3', 'other'));

    expect(await repo.getSession('s1')).toEqual(session);
    expect(await repo.listSessions()).toHaveLength(1);
    const trials = await repo.listTrials('s1');
    expect(trials.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(await repo.listTrials()).toHaveLength(3);
  });

  it('data survives reopening the database (restart simulation)', async () => {
    await repo.saveSession(makeSession('s1'));
    await repo.saveTrial(makeTrial('t1', 's1'));
    // New repository instance over the same factory = app restart.
    const repo2 = new IndexedDbSessionRepository(factory);
    expect(await repo2.getSession('s1')).toBeDefined();
    expect(await repo2.listTrials('s1')).toHaveLength(1);
  });

  it('returns default settings when none stored, and merges new fields', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings({ ...DEFAULT_SETTINGS, maxIntensity: 4 });
    const loaded = await repo.getSettings();
    expect(loaded.maxIntensity).toBe(4);
    expect(loaded.ratingSamplingEveryNTrials).toBe(
      DEFAULT_SETTINGS.ratingSamplingEveryNTrials,
    );
  });

  it('deleteAllData wipes everything', async () => {
    await repo.saveSession(makeSession('s1'));
    await repo.saveTrial(makeTrial('t1', 's1'));
    await repo.saveSettings({ ...DEFAULT_SETTINGS, maxIntensity: 5 });
    await repo.deleteAllData();
    expect(await repo.listSessions()).toHaveLength(0);
    expect(await repo.listTrials()).toHaveLength(0);
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('session recovery after restart', () => {
  it('closes open sessions and marks them interrupted', async () => {
    const open = makeSession('s1', { endedAt: null });
    const closed = makeSession('s2');
    await repo.saveSession(open);
    await repo.saveSession(closed);
    await repo.saveTrial(
      makeTrial('t1', 's1', { timestamp: Date.UTC(2026, 7, 30, 10, 5) }),
    );

    const recovered = await closeInterruptedSessions(repo, () =>
      Date.UTC(2026, 7, 30, 12, 0),
    );
    expect(recovered).toHaveLength(1);
    const s1 = await repo.getSession('s1');
    expect(s1!.interrupted).toBe(true);
    expect(s1!.endedAt).toBe(Date.UTC(2026, 7, 30, 10, 5));
    const s2 = await repo.getSession('s2');
    expect(s2!.interrupted).toBe(false);
  });
});

describe('export serialization', () => {
  it('JSON export preserves the complete structure with ISO metadata', () => {
    const sessions = [makeSession('s1')];
    const trials = [makeTrial('t1', 's1')];
    const json = buildJsonExport(sessions, trials, DEFAULT_SETTINGS, () =>
      Date.UTC(2026, 7, 30, 12, 0),
    );
    const parsed = JSON.parse(json) as ExportBundle;
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.exportedAt).toBe('2026-08-30T12:00:00.000Z');
    expect(parsed.sessions).toEqual(sessions);
    expect(parsed.trials).toEqual(trials);
    expect(parsed.settings.maxIntensity).toBe(DEFAULT_SETTINGS.maxIntensity);
  });

  it('CSV export is trial-level with ISO 8601 timestamps and stable columns', () => {
    const sessions = [makeSession('s1')];
    const trials = [
      makeTrial('t1', 's1'),
      makeTrial('t2', 's1', {
        ratings: { startle: null, distress: null, recovery: null },
        outcome: 'aborted',
      }),
    ];
    const csv = buildCsvExport(sessions, trials);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-08-30T10:01:00.000Z');
    expect(lines[1]).toContain('balloon-pop');
    expect(lines[1]).toContain('user-countdown');
    // Null ratings serialize as empty fields, not "null".
    expect(lines[2]).not.toContain('null');
    expect(lines[2]).toContain('aborted');
  });

  it('CSV escapes commas and quotes in free text', () => {
    const sessions = [makeSession('s1')];
    const trials = [
      makeTrial('t1', 's1', { visualContext: 'balloon, "party" scene' }),
    ];
    const csv = buildCsvExport(sessions, trials);
    expect(csv).toContain('"balloon, ""party"" scene"');
  });
});
