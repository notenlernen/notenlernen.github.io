import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { exportStatistics, importStatistics } from '../src/backup.ts';
import { localDate, readStatistics, recordAttempt, recordRound, resetStatistics } from '../src/statistics.ts';
import { DATABASE_NAME, idb, openDatabase, readTheme, transaction, writeTheme } from '../src/storage.ts';

const today = '2026-11-27';
const session = 'tab-a';
const attempt = (id, extras = {}) => ({
  id, roundId: 'round', sessionId: session, mode: 'notes',
  timestamp: Date.UTC(2026, 10, 27, 12), localDate: today, category: 'C', key: 'C-Dur', clef: 'treble',
  outcome: 'correct', duration: 850, ...extras,
});

async function fresh() {
  globalThis.indexedDB = new IDBFactory();
  return openDatabase();
}

test('Schema 1 wird atomar erweitert und behält Einstellungen und vorhandene Datensätze', async () => {
  globalThis.indexedDB = new IDBFactory();
  const request = indexedDB.open(DATABASE_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('settings').put('dark', 'theme');
    const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
    attempts.createIndex('byModeAndTime', ['mode', 'timestamp']);
    attempts.createIndex('byRound', 'roundId');
    attempts.createIndex('bySession', 'sessionId');
    attempts.add({ id: 'legacy', mode: 'notennamen', timestamp: 123, correct: true });
    db.createObjectStore('roundSummaries', { keyPath: 'id' });
    db.createObjectStore('adaptiveProfiles', { keyPath: ['mode', 'category'] });
    db.createObjectStore('resetEpochs', { keyPath: ['mode', 'level'] });
    db.createObjectStore('sessionAggregates', { keyPath: ['mode', 'sessionId'] });
    db.createObjectStore('dayAggregates', { keyPath: ['mode', 'localDate'] });
  };
  const previous = await idb(request);
  previous.close();
  const database = await openDatabase();
  assert.equal(database.version, 2);
  assert.equal(await readTheme(database), 'dark');
  const old = await transaction(database, ['attempts'], 'readonly', tx =>
    idb(tx.objectStore('attempts').index('byMode').get('notennamen')));
  assert.deepEqual(old, { id: 'legacy', mode: 'notennamen', timestamp: 123, correct: true });
  database.close();
});

test('Session, Kalendertag und Langzeit bleiben bei Resets und Tageswechsel unabhängig', async () => {
  const db = await fresh();
  const earlier = attempt('a', { localDate: '2026-11-26', sessionId: 'tab-b' });
  const timed = attempt('b', { outcome: 'timeout', duration: 3000 });
  const ear = attempt('c', { mode: 'ear', roundId: 'ear-round', interval: '7 Halbtöne' });
  await Promise.all([recordAttempt(db, earlier), recordAttempt(db, timed), recordAttempt(db, timed), recordAttempt(db, ear)]);
  await recordRound(db, { id: 'round', mode: 'notes', duration: 4100, timestamp: timed.timestamp }, 2);
  await transaction(db, ['adaptiveProfiles'], 'readwrite', async (tx) => {
    await idb(tx.objectStore('adaptiveProfiles').add({ mode: 'notes', category: 'C', count: 1, correct: 1 }));
  });
  async function snapshot(filter = 'notes', day = today) {
    return await readStatistics(db, filter, session, day);
  }
  let stats = await snapshot();
  assert.equal(stats.session.count, 1);
  assert.equal(stats.day.count, 1);
  assert.equal(stats.lifetime.count, 2);
  assert.equal(stats.lifetime.responseTime, 850);
  assert.equal(stats.history.length, 1);
  assert.equal(stats.bestRound.totals.correct, 1);
  assert.equal((await snapshot('notes', '2026-11-28')).day.count, 0);
  assert.equal(localDate(new Date(2026, 10, 28, 0, 1).valueOf()), '2026-11-28');

  await resetStatistics(db, 'day', 'notes', session, today);
  stats = await snapshot();
  assert.equal(stats.day.count, 0);
  assert.equal(stats.session.count, 1);
  assert.equal(stats.lifetime.count, 2);
  assert.equal((await snapshot('ear')).day.count, 1);
  await resetStatistics(db, 'session', 'notes', session, today);
  assert.equal((await snapshot()).session.count, 0);
  await recordAttempt(db, attempt('d', { roundId: 'round-2' }));
  await resetStatistics(db, 'lifetime', 'notes', session, today);
  stats = await snapshot();
  assert.equal(stats.session.count, 1);
  assert.equal(stats.day.count, 1);
  assert.equal(stats.lifetime.count, 0);
  assert.deepEqual(stats.history, []);
  assert.equal(stats.bestRound, null);
  assert.equal((await snapshot('all')).lifetime.count, 1);
  assert.deepEqual((await exportStatistics(db)).records.adaptiveProfiles, []);
  db.close();
});

test('Backup-Export und atomarer Ersatz schützen gelöschte Ebenen und Einstellungen', async () => {
  const db = await fresh();
  await writeTheme(db, 'dark');
  await recordAttempt(db, attempt('a'));
  await recordRound(db, { id: 'round', mode: 'notes', duration: 1200, timestamp: attempt('a').timestamp }, 1);
  await resetStatistics(db, 'day', 'notes', session, today);
  const backup = await exportStatistics(db);
  const bad = globalThis.structuredClone(backup);
  bad.records.roundSummaries[0].totals.correct = 0;
  await assert.rejects(importStatistics(db, bad));
  assert.deepEqual(await exportStatistics(db), backup);

  await assert.rejects(transaction(db, ['attempts'], 'readwrite', async tx => {
    await idb(tx.objectStore('attempts').delete('a'));
    await idb(tx.objectStore('attempts').add(attempt('b')));
    await idb(tx.objectStore('attempts').add(attempt('b')));
  }), { name: 'ConstraintError' });
  assert.deepEqual(await exportStatistics(db), backup);

  await resetStatistics(db, 'all', 'ear', session, today);
  assert.equal((await readStatistics(db, 'all', session, today)).lifetime.count, 0);
  assert.equal(await readTheme(db), 'dark');
  await importStatistics(db, JSON.parse(JSON.stringify(backup)));
  const restored = await readStatistics(db, 'all', session, today);
  assert.equal(restored.session.count, 1);
  assert.equal(restored.day.count, 0);
  assert.equal(restored.lifetime.count, 1);
  assert.equal(restored.history.length, 1);
  assert.equal(await readTheme(db), 'dark');
  db.close();
});
