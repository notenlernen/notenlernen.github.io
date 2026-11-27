import { accumulateProfile, type AdaptiveProfile } from './adaptive.ts';
import { idb, transaction } from './storage.ts';
import { statisticsStores, summarizeAttempts, trainingModes, type Attempt } from './statistics.ts';

type Row = Record<string, unknown>;
type Store = typeof statisticsStores[number];
type Records = Record<Store, Row[]>;
const format = 'notenlernen-statistik';

const object = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[\w:-]{1,128}$/.test(value);
const label = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 120 && [...value].every(character => character.charCodeAt(0) >= 32);
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integer = (value: unknown): value is number => number(value) && Number.isSafeInteger(value);
const time = (value: unknown) => integer(value) && value <= 8.64e15;

function date(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

function totals(value: unknown): boolean {
  if (!object(value)) return false;
  const { count, correct, timeout, responseTime, fastestCorrect, slowest } = value;
  if (!integer(count) || !integer(correct) || !integer(timeout) || count < 1 ||
      correct + timeout > count || !number(responseTime)) return false;
  if (correct ? !number(fastestCorrect) : fastestCorrect !== null) return false;
  if (count > timeout ? !number(slowest) : slowest !== null || responseTime !== 0) return false;
  return (!number(slowest) || slowest <= responseTime) &&
    (!number(fastestCorrect) || number(slowest) && fastestCorrect <= slowest);
}

function rowKey(store: Store, row: unknown): string | undefined {
  if (!object(row) || !trainingModes.some(mode => mode === row.mode)) return;
  const { mode } = row;
  switch (store) {
    case 'attempts':
      if (id(row.id) && id(row.roundId) && id(row.sessionId) && time(row.timestamp) && date(row.localDate) &&
          label(row.category) && number(row.duration) && ['correct', 'wrong', 'timeout'].some(outcome => outcome === row.outcome) &&
          (row.key === undefined || label(row.key)) && (row.interval === undefined || label(row.interval)) &&
          (row.clef === undefined || row.clef === 'treble' || row.clef === 'bass')) return row.id;
      break;
    case 'roundSummaries':
      if (id(row.id) && time(row.timestamp) && number(row.duration) && totals(row.totals)) return row.id;
      break;
    case 'sessionAggregates':
      if (id(row.sessionId) && totals(row.totals)) return `${mode}:${row.sessionId}`;
      break;
    case 'dayAggregates':
      if (date(row.localDate) && totals(row.totals)) return `${mode}:${row.localDate}`;
      break;
    case 'resetEpochs':
      if (['session', 'day', 'lifetime'].some(level => level === row.level) && time(row.timestamp)) return `${mode}:${row.level}`;
      break;
    case 'adaptiveProfiles':
      if (label(row.category) && integer(row.count) && integer(row.correct) && row.correct <= row.count) return `${mode}:${row.category}`;
      break;
  }
}

const fields: Record<Store, string[]> = {
  attempts: ['id', 'roundId', 'sessionId', 'mode', 'timestamp', 'localDate', 'category', 'key', 'clef', 'interval', 'outcome', 'duration'],
  roundSummaries: ['id', 'mode', 'timestamp', 'duration', 'totals'],
  adaptiveProfiles: ['mode', 'category', 'count', 'correct'],
  resetEpochs: ['mode', 'level', 'timestamp'],
  sessionAggregates: ['mode', 'sessionId', 'totals'],
  dayAggregates: ['mode', 'localDate', 'totals'],
};

function project(store: Store, row: Row): Row {
  const clean = Object.fromEntries(fields[store].filter(key => row[key] !== undefined).map(key => [key, row[key]]));
  if (object(clean.totals)) {
    const value = clean.totals;
    clean.totals = Object.fromEntries(
      ['count', 'correct', 'timeout', 'responseTime', 'fastestCorrect', 'slowest'].map(key => [key, value[key]]),
    );
  }
  return clean;
}

export function parseBackup(value: unknown): Records {
  if (!object(value) || value.format !== format || value.version !== 1 || !object(value.records)) {
    throw new Error('Nicht unterstütztes Backupformat.');
  }
  const records = {} as Records;
  for (const store of statisticsStores) {
    const rows: unknown = value.records[store];
    if (!Array.isArray(rows)) throw new Error('Im Backup fehlen Statistikdaten.');
    const keys = new Set<string>();
    records[store] = rows.map((row: unknown) => {
      const key = rowKey(store, row);
      if (key === undefined || keys.has(key)) throw new Error('Ungültige oder doppelte Statistikdaten im Backup.');
      keys.add(key);
      return project(store, row as Row);
    });
  }
  const rounds = new Map<string, Attempt[]>();
  for (const row of records.attempts) {
    const attempt = row as unknown as Attempt;
    const entries = rounds.get(attempt.roundId) ?? [];
    entries.push(attempt);
    rounds.set(attempt.roundId, entries);
  }
  for (const row of records.roundSummaries) {
    const entries = rounds.get(row.id as string);
    const stored = row.totals as Row;
    if (!entries || !entries.every(entry => entry.mode === row.mode) ||
        Object.entries(summarizeAttempts(entries)).some(([key, expected]) => expected !== stored[key])) {
      throw new Error('Eine Runde passt nicht zu ihren Antworten.');
    }
  }
  // M4 exports already had this store, but it contained no live profiles.
  const derived = new Map<string, AdaptiveProfile>();
  for (const row of records.attempts) accumulateProfile(row as unknown as Attempt, derived);
  const imported = new Set(records.adaptiveProfiles.map(row => JSON.stringify([row.mode, row.category])));
  for (const [key, profile] of derived) {
    if (!imported.has(key)) records.adaptiveProfiles.push({ ...profile });
  }
  return records;
}

export async function exportStatistics(database: IDBDatabase) {
  return transaction(database, statisticsStores, 'readonly', async (tx) => {
    const data = await Promise.all(statisticsStores.map(async store => {
      const rows: Row[] = await idb(tx.objectStore(store).getAll());
      return [store, rows.filter(row => rowKey(store, row) !== undefined).map(row => project(store, row))];
    }));
    return { format, version: 1, records: Object.fromEntries(data) as Records };
  });
}

export async function importStatistics(database: IDBDatabase, value: unknown): Promise<void> {
  const records = parseBackup(value);
  await transaction(database, statisticsStores, 'readwrite', async (tx) => {
    await Promise.all(statisticsStores.flatMap(name => {
      const store = tx.objectStore(name);
      return [idb(store.clear()), ...records[name].map(row => idb(store.add(row)))];
    }));
  });
}
