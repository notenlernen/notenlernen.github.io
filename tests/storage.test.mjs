import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { DATABASE_NAME, DATABASE_VERSION, isTheme, openDatabase, readTheme, writeTheme } from '../src/storage.ts';

test('Theme-Werte werden validiert', () => {
  for (const theme of ['system', 'light', 'dark']) assert.equal(isTheme(theme), true);
  for (const value of ['auto', null, 3, {}]) assert.equal(isTheme(value), false);
});

test('Schema und Indexe sind versioniert, Theme überlebt erneutes Öffnen', async () => {
  const database = await openDatabase();
  assert.equal(database.version, DATABASE_VERSION);
  assert.deepEqual([...database.objectStoreNames], [
    'adaptiveProfiles', 'attempts', 'dayAggregates', 'resetEpochs',
    'roundSummaries', 'sessionAggregates', 'settings',
  ]);
  const attempts = database.transaction('attempts').objectStore('attempts');
  assert.deepEqual([...attempts.indexNames], ['byMode', 'byModeAndTime', 'byRound', 'bySession']);
  assert.deepEqual(attempts.index('byModeAndTime').keyPath, ['mode', 'timestamp']);
  assert.equal(await readTheme(database), 'system');
  await writeTheme(database, 'dark');
  database.close();

  const reopened = await openDatabase();
  assert.equal(await readTheme(reopened), 'dark');
  reopened.close();
});

test('Ein Versionswechsel gibt die Verbindung frei und erhält die Einstellungen', async () => {
  const database = await openDatabase();
  await writeTheme(database, 'light');
  const future = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION + 1);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => reject(new Error('Die bisherige Verbindung wurde nicht geschlossen.'));
    request.onerror = () => reject(request.error);
  });
  try {
    assert.throws(() => database.transaction('settings'), { name: 'InvalidStateError' });
    assert.equal(await readTheme(future), 'light');
  } finally {
    future.close();
  }
  await assert.rejects(openDatabase(), { name: 'VersionError' });
});
