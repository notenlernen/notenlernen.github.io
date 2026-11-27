export const DATABASE_NAME = 'notenlernen';
export const DATABASE_VERSION = 1;

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
