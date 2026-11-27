import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceProfile, chooseAdaptiveQuestion, weaknesses } from '../src/adaptive.ts';
import { generateQuestion, keys } from '../src/music.ts';
import { generateIntervalQuestion } from '../src/intervals.ts';
import { generateEarQuestion } from '../src/ear.ts';

function seeded() {
  let seed = 1709;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const profile = (category, count, correct, mode = 'notes') => ({ mode, category, count, correct });

test('Kaltstart und ausschließlich richtige Profile behalten die bisherige Zufallsauswahl bei', () => {
  for (const profiles of [new Map(), new Map([['C', profile('C', 12, 12)]])]) {
    let calls = 0;
    const actual = chooseAdaptiveQuestion(() => ++calls, String, profiles, () => {
      throw new Error('Die Gewichtung darf beim Kaltstart keinen Zufall verbrauchen.');
    });
    assert.equal(actual, 1);
    assert.equal(calls, 1);
  }
});

test('Gewichtete Auswahl ist reproduzierbar und übt unsichere Kategorien häufiger', () => {
  const profiles = new Map([['sicher', profile('sicher', 24, 24)], ['unsicher', profile('unsicher', 24, 2)]]);
  function run() {
    const rand = seeded();
    return Array.from({ length: 1800 }, () => chooseAdaptiveQuestion(
      () => rand() < 0.5 ? 'sicher' : 'unsicher', q => q, profiles, rand,
    ));
  }
  const answers = run();
  assert.deepEqual(answers, run());
  const weak = answers.filter(answer => answer === 'unsicher').length;
  assert.ok(weak > 1250 && weak < 1690, `Bevorzugte Aufgaben: ${weak}`);
});

test('Exploration ist begrenzt und jede Trainingsart bleibt an die Auswahl gebunden', () => {
  const random = seeded();
  const key = keys.find(key => key.id === 'F#');
  const generators = [
    ['notes', () => generateQuestion([key], ['bass'], random), q => q.correct],
    ['intervals', () => generateIntervalQuestion([key], ['bass'], ['down'], 'quality', random), q => `Nr. ${q.interval.number}`],
    ['ear', () => generateEarQuestion(['down'], 'quality', random), q => `${q.pitches[0] - q.pitches[1]} Halbtöne`],
  ];
  for (const [mode, generate, category] of generators) {
    const profiles = new Map([['nicht vorhanden', profile('nicht vorhanden', 100, 0, mode)]]);
    for (let iteration = 0; iteration < 40; iteration++) {
      let calls = 0;
      const q = chooseAdaptiveQuestion(() => { calls++; return generate(); }, category, profiles, random);
      assert.equal(calls, 8);
      assert.equal(new Set(q.options).size, 4);
      assert.equal(q.options.filter(option => option === q.correct).length, 1);
      if (mode !== 'ear') {
        assert.equal(q.key, key);
        assert.equal(q.clef, 'bass');
      }
      if (mode === 'intervals') assert.equal(q.direction, 'down');
      if (mode === 'ear') assert.ok(q.pitches[0] >= q.pitches[1]);
    }
  }
});

test('Timeouts zählen als Fehler und Schwerpunkte verlangen drei Beobachtungen', () => {
  const after = advanceProfile({ mode: 'notes', category: 'C', outcome: 'timeout' }, profile('C', 2, 1));
  assert.deepEqual(after, profile('C', 3, 1));
  assert.deepEqual(weaknesses([profile('D', 2, 0), profile('E', 10, 10), after, profile('F', 8, 1)])
    .map(entry => entry.category), ['F', 'C']);
});
