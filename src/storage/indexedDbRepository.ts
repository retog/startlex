import type { SessionRepository } from '../core/ports';
import {
  DEFAULT_SETTINGS,
  type Session,
  type Trial,
  type UserSettings,
} from '../core/types';
import { openDatabase, requestToPromise, txDone } from './db';

const SETTINGS_KEY = 'user-settings';

export class IndexedDbSessionRepository implements SessionRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDatabase(this.factory);
    return this.dbPromise;
  }

  async saveSession(session: Session): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(session);
    await txDone(tx);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const db = await this.db();
    const tx = db.transaction('sessions', 'readonly');
    return requestToPromise(tx.objectStore('sessions').get(id));
  }

  async listSessions(): Promise<Session[]> {
    const db = await this.db();
    const tx = db.transaction('sessions', 'readonly');
    const all: Session[] = await requestToPromise(tx.objectStore('sessions').getAll());
    return all.sort((a, b) => a.startedAt - b.startedAt);
  }

  async saveTrial(trial: Trial): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('trials', 'readwrite');
    tx.objectStore('trials').put(trial);
    await txDone(tx);
  }

  async listTrials(sessionId?: string): Promise<Trial[]> {
    const db = await this.db();
    const tx = db.transaction('trials', 'readonly');
    const store = tx.objectStore('trials');
    const all: Trial[] = sessionId
      ? await requestToPromise(store.index('bySession').getAll(sessionId))
      : await requestToPromise(store.getAll());
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getSettings(): Promise<UserSettings> {
    const db = await this.db();
    const tx = db.transaction('settings', 'readonly');
    const row = await requestToPromise<{ key: string; value: UserSettings } | undefined>(
      tx.objectStore('settings').get(SETTINGS_KEY),
    );
    // Merge with defaults so new settings fields get sensible values after
    // an app update without a DB migration.
    return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const db = await this.db();
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: SETTINGS_KEY, value: settings });
    await txDone(tx);
  }

  async deleteAllData(): Promise<void> {
    const db = await this.db();
    const stores = ['sessions', 'trials', 'settings', 'stimuli'] as const;
    const tx = db.transaction(stores as unknown as string[], 'readwrite');
    for (const store of stores) tx.objectStore(store).clear();
    await txDone(tx);
  }
}
