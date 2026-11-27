import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Round } from '../src/round.ts';

test('Zeitgrenze, Doppelantwort, automatische Timeout-Wertung und Auswertung', () => {
  const round = new Round(3, 3000, 100);
  assert.equal(round.answer(500, null), undefined);
  assert.equal(round.answer(600, true), 'correct');
  assert.equal(round.answer(701, false), undefined);
  round.next(1000);
  assert.equal(round.answer(2100, false), 'wrong');
  round.next(3000);
  assert.equal(round.remaining(5999), 1);
  assert.equal(round.answer(6000, true), 'timeout');
  assert.equal(round.complete, true);
  assert.deepEqual(round.summary(6000), {
    correct: 1, wrong: 2, timeout: 1, rate: 1 / 3, fastestCorrect: 500,
    slowest: 1100, average: 800, duration: 5900,
  });
});

test('Unbegrenzte Runden und Zeitwerte ohne beantwortete Aufgabe', () => {
  const unlimited = new Round(1, null, 0);
  assert.equal(unlimited.remaining(9999), null);
  assert.equal(unlimited.answer(9999, true), 'correct');
  const timed = new Round(1, 1000, 100);
  assert.equal(timed.answer(1100, null), 'timeout');
  assert.equal(timed.summary(1100).average, null);
  assert.equal(timed.summary(1100).slowest, null);
  assert.equal(timed.summary(1100).fastestCorrect, null);
});
