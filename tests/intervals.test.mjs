import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateIntervalQuestion, intervalAccidentals, measureInterval } from '../src/intervals.ts';
import { chromaticHeight, keys } from '../src/music.ts';

const note = (letter, octave = 4, alteration = 0) => ({ letter, octave, alteration });

test('Diatonische Zahl und chromatische Qualität bleiben getrennt', () => {
  const fixtures = [
    [note('C'), note('C'), 1, 0, 'rein'],
    [note('C'), note('C', 4, 1), 1, 1, 'übermäßig'],
    [note('C'), note('D', 4, -1), 2, 1, 'klein'],
    [note('C', 4, 1), note('D', 4, -1), 2, 0, 'vermindert'],
    [note('C'), note('E'), 3, 4, 'groß'],
    [note('E'), note('C'), 3, 4, 'groß'],
    [note('C'), note('F', 4, 1), 4, 6, 'übermäßig'],
    [note('C'), note('G', 4, -1), 5, 6, 'vermindert'],
    [note('C'), note('C', 5), 8, 12, 'rein'],
    [note('B', 3), note('D'), 3, 3, 'klein'],
  ];
  for (const [first, second, number, semitones, quality] of fixtures) {
    assert.deepEqual(measureInterval(first, second), { number, semitones, quality });
  }
  assert.equal(measureInterval(note('C'), note('D', 5)), undefined);
});

test('Vorzeichen der zweiten Note berücksichtigt Alteration auf derselben Position', () => {
  const g = keys.find(({ id }) => id === 'G');
  assert.deepEqual(intervalAccidentals(g, [note('F'), note('F', 4, 1)]), ['n', '#']);
  assert.deepEqual(intervalAccidentals(g, [note('F'), note('F')]), ['n', '']);
  assert.deepEqual(intervalAccidentals(g, [note('F'), note('F', 5, 1)]), ['n', '']);
});

test('Generator deckt in beiden Modi acht Intervallzahlen und beide Richtungen mit vier Optionen ab', () => {
  let seed = 421;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const mode of ['number', 'quality']) {
    const numbers = new Set();
    const qualities = new Set();
    for (const key of keys) for (const clef of ['treble', 'bass']) for (const direction of ['up', 'down']) {
      for (let i = 0; i < 16; i++) {
        const q = generateIntervalQuestion([key], [clef], [direction], mode, random);
        const difference = chromaticHeight(q.notes[1]) - chromaticHeight(q.notes[0]);
        assert.ok(direction === 'up' ? difference >= 0 : difference <= 0);
        assert.deepEqual(measureInterval(...q.notes), q.interval);
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options.filter(option => option === q.correct).length, 1);
        numbers.add(q.interval.number);
        qualities.add(q.interval.quality);
      }
    }
    assert.equal(numbers.size, 8);
    assert.equal(qualities.size, 5);
  }
});
