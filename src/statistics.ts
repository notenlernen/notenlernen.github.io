import { idb, transaction } from './storage.ts';
import type { Outcome } from './round.ts';

import { advanceProfile, isAdaptiveProfile, trainingModes, weaknesses, type AdaptiveProfile, type TrainingMode } from './adaptive.ts';

export { trainingModes };
export type { TrainingMode };
export type ModeFilter = TrainingMode | 'all';
export type ResetLevel = 'session' | 'day' | 'lifetime' | 'all';

export const modeLabels: Record<TrainingMode, string> = {
  notes: 'Notennamen', intervals: 'Visuelle Intervalle', ear: 'Gehörintervalle',
};

export interface Attempt {
  id: string;
  roundId: string;
  sessionId: string;
  mode: TrainingMode;
  timestamp: number;
  localDate: string;
  category: string;
  key?: string;
  clef?: 'treble' | 'bass';
  interval?: string;
  outcome: Outcome;
  duration: number;
}

export interface Totals {
  count: number;
  correct: number;
  timeout: number;
  responseTime: number;
  fastestCorrect: number | null;
  slowest: number | null;
}
export interface RoundRecord {
  id: string;
  mode: TrainingMode;
  timestamp: number;
  duration: number;
  totals: Totals;
}

const zero: Totals = { count: 0, correct: 0, timeout: 0, responseTime: 0, fastestCorrect: null, slowest: null };
const scopes = ['sessionAggregates', 'dayAggregates'] as const;
export const statisticsStores = ['attempts', 'roundSummaries', 'adaptiveProfiles', 'resetEpochs', ...scopes] as const;

export function localDate(timestamp: number): string {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
}

function uuid(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}

export const createRoundId = uuid;
let fallbackSession: string | undefined;

export function sessionId(): string {
  fallbackSession ??= uuid();
  try {
    const existing = sessionStorage.getItem('notenlernen-session');
    if (existing) return existing;
    sessionStorage.setItem('notenlernen-session', fallbackSession);
  } catch { /* The tab-local identifier still works without sessionStorage. */ }
  return fallbackSession;
}

function addResult(total: Totals, attempt: Attempt): Totals {
  const correct = attempt.outcome === 'correct';
  const answered = attempt.outcome !== 'timeout';
  return {
    count: total.count + 1,
    correct: total.correct + Number(correct),
    timeout: total.timeout + Number(!answered),
    responseTime: total.responseTime + (answered ? attempt.duration : 0),
    fastestCorrect: correct ? Math.min(total.fastestCorrect ?? Infinity, attempt.duration) : total.fastestCorrect,
    slowest: answered ? Math.max(total.slowest ?? 0, attempt.duration) : total.slowest,
  };
}

export function summarizeAttempts(attempts: Attempt[]): Totals {
  return attempts.reduce(addResult, zero);
}

function combine(left: Totals, right: Totals): Totals {
  return {
    count: left.count + right.count,
    correct: left.correct + right.correct,
    timeout: left.timeout + right.timeout,
    responseTime: left.responseTime + right.responseTime,
    fastestCorrect: left.fastestCorrect === null || right.fastestCorrect === null
      ? left.fastestCorrect ?? right.fastestCorrect : Math.min(left.fastestCorrect, right.fastestCorrect),
    slowest: left.slowest === null || right.slowest === null
      ? left.slowest ?? right.slowest : Math.max(left.slowest, right.slowest),
  };
}

export async function recordAttempt(database: IDBDatabase, attempt: Attempt): Promise<void> {
  await transaction(database, ['attempts', 'adaptiveProfiles', ...scopes], 'readwrite', async (tx) => {
    const attempts = tx.objectStore('attempts');
    if (await idb(attempts.getKey(attempt.id)) !== undefined) return;
    const session = tx.objectStore('sessionAggregates');
    const day = tx.objectStore('dayAggregates');
    const profiles = tx.objectStore('adaptiveProfiles');
    const [priorSession, priorDay, priorProfile] = await Promise.all([
      idb(session.get([attempt.mode, attempt.sessionId])),
      idb(day.get([attempt.mode, attempt.localDate])),
      idb(profiles.get([attempt.mode, attempt.category])),
    ]);
    await Promise.all([
      idb(attempts.add(attempt)),
      idb(profiles.put(advanceProfile(attempt, priorProfile && isAdaptiveProfile(priorProfile) ? priorProfile : undefined))),
      idb(session.put({ mode: attempt.mode, sessionId: attempt.sessionId, totals: addResult(priorSession?.totals ?? zero, attempt) })),
      idb(day.put({ mode: attempt.mode, localDate: attempt.localDate, totals: addResult(priorDay?.totals ?? zero, attempt) })),
    ]);
  });
}

export async function recordRound(
  database: IDBDatabase, round: Omit<RoundRecord, 'totals'>, expectedCount: number,
): Promise<boolean> {
  return transaction(database, ['attempts', 'roundSummaries'], 'readwrite', async (tx) => {
    const attempts: Attempt[] = await idb(tx.objectStore('attempts').index('byRound').getAll(round.id));
    if (attempts.length !== expectedCount) return false;
    await idb(tx.objectStore('roundSummaries').put({ ...round, totals: summarizeAttempts(attempts) }));
    return true;
  });
}

export async function resetStatistics(
  database: IDBDatabase, level: ResetLevel, filter: ModeFilter, session: string, day: string, timestamp = Date.now(),
): Promise<void> {
  await transaction(database, statisticsStores, 'readwrite', async (tx) => {
    if (level === 'all') {
      await Promise.all(statisticsStores.map(name => idb(tx.objectStore(name).clear())));
      return;
    }
    const modes = filter === 'all' ? trainingModes : [filter];
    for (const mode of modes) {
      if (level === 'lifetime') {
        for (const name of ['attempts', 'roundSummaries', 'adaptiveProfiles']) {
          const store = tx.objectStore(name);
          const keys = await idb(store.index('byMode').getAllKeys(mode));
          await Promise.all(keys.map(key => idb(store.delete(key))));
        }
      } else {
        const name = level === 'session' ? 'sessionAggregates' : 'dayAggregates';
        await idb(tx.objectStore(name).delete([mode, level === 'session' ? session : day]));
      }
      await idb(tx.objectStore('resetEpochs').put({ mode, level, timestamp }));
    }
  });
}

function modeQuery(store: IDBObjectStore, filter: ModeFilter): IDBRequest {
  return filter === 'all' ? store.getAll() : store.index('byMode').getAll(filter);
}

export async function readAdaptiveProfiles(database: IDBDatabase, mode: TrainingMode): Promise<AdaptiveProfile[]> {
  return transaction(database, ['adaptiveProfiles'], 'readonly', async (tx) => {
    const rows: AdaptiveProfile[] = await idb(tx.objectStore('adaptiveProfiles').index('byMode').getAll(mode));
    return rows.filter(isAdaptiveProfile);
  });
}

export async function readStatistics(database: IDBDatabase, filter: ModeFilter, session: string, day: string) {
  const modes = filter === 'all' ? trainingModes : [filter];
  return transaction(database, ['attempts', 'roundSummaries', 'adaptiveProfiles', ...scopes], 'readonly', async (tx) => {
    const [attempts, rounds, profiles, ...aggregates] = await Promise.all([
      idb(modeQuery(tx.objectStore('attempts'), filter)) as Promise<Attempt[]>,
      idb(modeQuery(tx.objectStore('roundSummaries'), filter)) as Promise<RoundRecord[]>,
      idb(modeQuery(tx.objectStore('adaptiveProfiles'), filter)) as Promise<AdaptiveProfile[]>,
      ...scopes.flatMap((name, index) =>
        modes.map(mode => idb(tx.objectStore(name).get([mode, index === 0 ? session : day])))),
    ]);
    const valid = attempts.filter(attempt => trainingModes.includes(attempt.mode) &&
      typeof attempt.localDate === 'string' && Number.isFinite(attempt.duration) &&
      ['correct', 'wrong', 'timeout'].includes(attempt.outcome));
    const trend = new Map<string, Totals>();
    const breakdown = new Map<string, { name: string; count: number; errors: number }>();
    for (const attempt of valid) {
      trend.set(attempt.localDate, addResult(trend.get(attempt.localDate) ?? zero, attempt));
      const dimensions = [
        ['Modus', modeLabels[attempt.mode]],
        ['Tonart', attempt.key],
        ['Schlüssel', attempt.clef === 'treble' ? 'Violin' : attempt.clef === 'bass' ? 'Bass' : undefined],
        ['Intervall', attempt.interval],
      ];
      for (const [kind, name] of dimensions) {
        if (!name) continue;
        const label = `${kind} · ${name}`;
        const entry = breakdown.get(label) ?? { name: label, count: 0, errors: 0 };
        entry.count++;
        if (attempt.outcome !== 'correct') entry.errors++;
        breakdown.set(label, entry);
      }
    }
    const daily = [...trend].sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);
    const history = rounds.filter(round => trainingModes.includes(round.mode) && round.totals?.count > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
    return {
      session: aggregates.slice(0, modes.length).map(row => row?.totals ?? zero).reduce(combine, zero),
      day: aggregates.slice(modes.length).map(row => row?.totals ?? zero).reduce(combine, zero),
      lifetime: summarizeAttempts(valid),
      trend: daily,
      weaknesses: weaknesses(profiles.filter(isAdaptiveProfile)).slice(0, 12),
      breakdown: [...breakdown.values()].sort((a, b) => b.errors - a.errors || a.name.localeCompare(b.name, 'de')),
      history: history.slice(0, 20),
      bestRound: history.reduce<RoundRecord | null>((best, round) =>
        !best || round.totals.correct / round.totals.count > best.totals.correct / best.totals.count ? round : best, null),
    };
  });
}
