import { accumulateProfile, isProfileEvidence, type AdaptiveProfile } from './adaptive.ts';

export const DATABASE_NAME = 'notenlernen';
export const DATABASE_VERSION = 3;

export type Theme = 'system' | 'light' | 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let blocked = false;

    request.onupgradeneeded = (event) => {
      if (event.oldVersion < 1) {
        const database = request.result;
        database.createObjectStore('settings');
        const attempts = database.createObjectStore('attempts', { keyPath: 'id' });
        attempts.createIndex('byModeAndTime', ['mode', 'timestamp']);
        attempts.createIndex('byRound', 'roundId');
        attempts.createIndex('bySession', 'sessionId');
        database.createObjectStore('roundSummaries', { keyPath: 'id' });
        database.createObjectStore('adaptiveProfiles', { keyPath: ['mode', 'category'] });
        database.createObjectStore('resetEpochs', { keyPath: ['mode', 'level'] });
        database.createObjectStore('sessionAggregates', { keyPath: ['mode', 'sessionId'] });
        database.createObjectStore('dayAggregates', { keyPath: ['mode', 'localDate'] });
      }
      if (event.oldVersion < 2) {
        for (const name of ['attempts', 'roundSummaries', 'adaptiveProfiles']) {
          request.transaction!.objectStore(name).createIndex('byMode', 'mode');
        }
      }
      if (event.oldVersion > 0 && event.oldVersion < 3) {
        const upgrade = request.transaction!;
        const profiles = upgrade.objectStore('adaptiveProfiles');
        const totals = new Map<string, AdaptiveProfile>();
        const scan = upgrade.objectStore('attempts').openCursor();
        scan.onsuccess = () => {
          const cursor = scan.result;
          if (cursor) {
            if (isProfileEvidence(cursor.value)) accumulateProfile(cursor.value, totals);
            cursor.continue();
            return;
          }
          for (const profile of totals.values()) profiles.put(profile);
        };
      }
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Ein anderer Tab blockiert den Datenbankzugriff.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close();
      else resolve(database);
    };
  });
}

export function readTheme(database: IDBDatabase): Promise<Theme> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('settings', 'readonly');
    const request = transaction.objectStore('settings').get('theme');
    transaction.oncomplete = () => resolve(isTheme(request.result) ? request.result : 'system');
    transaction.onabort = () => reject(transaction.error);
  });
}

export function writeTheme(database: IDBDatabase, theme: Theme): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('settings', 'readwrite');
    transaction.objectStore('settings').put(theme, 'theme');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

let connection: Promise<IDBDatabase> | undefined;

export function getDatabase(): Promise<IDBDatabase> {
  connection ??= openDatabase().then((database) => {
    database.addEventListener('versionchange', () => { connection = undefined; });
    database.addEventListener('close', () => { connection = undefined; });
    return database;
  }).catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

export function idb<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function transaction<T>(
  database: IDBDatabase,
  stores: readonly string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const tx = database.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen.'));
  });
  try {
    const [result] = await Promise.all([work(tx), done]);
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* Already completed or aborted. */ }
    await done.catch(() => {});
    throw error;
  }
}
