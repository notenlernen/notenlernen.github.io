import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromaticHeight, generateQuestion, germanName, keyAlteration, keys, letters, quickKeys } from '../src/music.ts';

test('Je 15 Dur- und Molltonarten mit den richtigen Vorzeichen und Schnellwahlen', () => {
  assert.equal(new Set(keys.map(({ id }) => id)).size, 30);
  assert.equal(quickKeys('major').length, 15);
  assert.equal(quickKeys('minor').length, 15);
  assert.equal(quickKeys('simple').length, 10);
  assert.equal(quickKeys('all').length, 30);
  const fixtures = [
    ['Cb', 'bbbbbbb'], ['C#', '#######'], ['F#', '######-'], ['Gb', 'bbb-bbb'],
    ['Bb', '--b---b'], ['G', '---#---'], ['D', '#--#---'], ['Am', '-------'],
    ['Ebm', 'bbb-bbb'], ['A#m', '#######'],
  ];
  for (const [id, expected] of fixtures) {
    const key = keys.find((candidate) => candidate.id === id);
    assert.equal(letters.map((letter) => ({ '-1': 'b', 0: '-', 1: '#' })[keyAlteration(key, letter)]).join(''), expected, id);
  }
});

test('Deutsche Notennamen, Oktavgrenze und enharmonische Schreibweise', () => {
  assert.equal(germanName('B', 0), 'H');
  assert.equal(germanName('B', -1), 'B');
  assert.equal(germanName('B', 1), 'His');
  assert.equal(germanName('E', -1), 'Es');
  assert.notEqual(germanName('F', 1), germanName('G', -1));
  assert.equal(chromaticHeight({ letter: 'F', octave: 4, alteration: 1 }), chromaticHeight({ letter: 'G', octave: 4, alteration: -1 }));
  assert.equal(chromaticHeight({ letter: 'B', octave: 3, alteration: 1 }), chromaticHeight({ letter: 'C', octave: 4, alteration: 0 }));
});

test('Vier eindeutige Optionen in jeder Tonart und beiden Schlüsseln', () => {
  let seed = 17;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const accidentals = new Set();
  for (const key of keys) {
    for (const clef of ['treble', 'bass']) {
      for (let repetition = 0; repetition < 40; repetition++) {
        const question = generateQuestion([key], [clef], random);
        assert.equal(question.clef, clef);
        assert.equal(new Set(question.options).size, 4);
        assert.equal(question.options.filter((name) => name === question.correct).length, 1);
        assert.equal(question.correct, germanName(question.note.letter, question.note.alteration));
        if (!question.accidental) assert.equal(question.note.alteration, keyAlteration(key, question.note.letter));
        accidentals.add(question.accidental);
      }
    }
  }
  assert.deepEqual(accidentals, new Set(['', '#', 'b', 'n']));
});
