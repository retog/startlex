/**
 * IndexedDB wrapper with explicit, append-only migrations.
 *
 * Never remove or rewrite an existing migration — add a new one. Existing
 * user data must survive every schema upgrade (tested in storage tests).
 */

export interface Migration {
  version: number;
  migrate(db: IDBDatabase, tx: IDBTransaction): void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    migrate(db) {
      db.createObjectStore('sessions', { keyPath: 'id' });
      const trials = db.createObjectStore('trials', { keyPath: 'id' });
      trials.createIndex('bySession', 'sessionId', { unique: false });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('stimuli', { keyPath: 'id' });
    },
  },
];

export const DB_NAME = 'startle-trainer';
export const DB_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function openDatabase(
  factory: IDBFactory = indexedDB,
  name = DB_NAME,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction!;
      const oldVersion = event.oldVersion;
      for (const migration of MIGRATIONS) {
        if (migration.version > oldVersion) migration.migrate(db, tx);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database open blocked'));
  });
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}
