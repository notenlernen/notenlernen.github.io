import { accidentalMark, chromaticHeight, keyAlteration, letters, pick, shuffle } from './music.ts';
import type { AccidentalMark, Alteration, Clef, Key, Note } from './music.ts';

export type Direction = 'up' | 'down';
export type IntervalMode = 'number' | 'quality';
type Quality = 'rein' | 'klein' | 'groß' | 'vermindert' | 'übermäßig';

const names = ['Prime', 'Sekunde', 'Terz', 'Quarte', 'Quinte', 'Sexte', 'Septime', 'Oktave'] as const;
const majorOrPerfect = [0, 2, 4, 5, 7, 9, 11, 12];
const perfectNumbers = new Set([1, 4, 5, 8]);
const alterations: Alteration[] = [-1, 0, 1];

export interface Interval {
  number: number;
  semitones: number;
  quality: Quality;
}

function step(note: Note): number {
  return note.octave * 7 + letters.indexOf(note.letter);
}

export function measureInterval(first: Note, second: Note): Interval | undefined {
  const number = Math.abs(step(second) - step(first)) + 1;
  if (number > names.length) return;
  const semitones = Math.abs(chromaticHeight(second) - chromaticHeight(first));
  const difference = semitones - majorOrPerfect[number - 1];
  const quality = perfectNumbers.has(number)
    ? ({ '-1': 'vermindert', 0: 'rein', 1: 'übermäßig' } as const)[difference as -1 | 0 | 1]
    : ({ '-2': 'vermindert', '-1': 'klein', 0: 'groß', 1: 'übermäßig' } as const)[difference as -2 | -1 | 0 | 1];
  if (quality) return { number, semitones, quality };
}

export interface IntervalQuestion {
  key: Key;
  clef: Clef;
  notes: [Note, Note];
  accidentals: [AccidentalMark, AccidentalMark];
  interval: Interval;
  direction: Direction;
  options: string[];
  correct: string;
}

function spelling(position: number, alteration: Alteration): Note {
  return { letter: letters[position % 7], octave: Math.floor(position / 7), alteration };
}

export function intervalAccidentals(key: Key, [first, second]: [Note, Note]): [AccidentalMark, AccidentalMark] {
  const secondImplied = step(first) === step(second) ? first.alteration : keyAlteration(key, second.letter);
  return [
    accidentalMark(first.alteration, keyAlteration(key, first.letter)),
    accidentalMark(second.alteration, secondImplied),
  ];
}

export function generateIntervalQuestion(
  selectedKeys: Key[],
  clefs: Clef[],
  directions: Direction[],
  mode: IntervalMode,
  random = Math.random,
): IntervalQuestion {
  const key = pick(selectedKeys, random);
  const clef = pick(clefs, random);
  const direction = pick(directions, random);
  const number = 1 + Math.floor(random() * names.length);
  const [low, high] = clef === 'treble' ? [28, 40] : [16, 30];
  const byQuality = new Map<Quality, { notes: [Note, Note]; interval: Interval }[]>();

  for (let position = low; position + number - 1 <= high; position++) {
    for (const lower of alterations) {
      for (const higher of alterations) {
        const first = spelling(position, lower);
        const second = spelling(position + number - 1, higher);
        if (chromaticHeight(first) > chromaticHeight(second)) continue;
        const interval = measureInterval(first, second);
        if (!interval) continue;
        const notes: [Note, Note] = direction === 'up' ? [first, second] : [second, first];
        const candidates = byQuality.get(interval.quality) ?? [];
        candidates.push({ notes, interval });
        byQuality.set(interval.quality, candidates);
      }
    }
  }

  const { notes, interval } = pick(pick([...byQuality.values()], random), random);
  const name = names[number - 1];
  const label = (quality: Quality, name: string) => `${quality}e ${name}`;
  const correct = mode === 'number' ? name : label(interval.quality, name);
  const distractors = mode === 'number'
    ? names.filter((other) => other !== name)
    : [...byQuality.keys()].filter((quality) => quality !== interval.quality).map((quality) => label(quality, name));
  if (mode === 'quality') {
    for (const alternative of ['kleine Sekunde', 'große Terz', 'reine Quinte']) {
      if (distractors.length === 3) break;
      if (alternative !== correct && !distractors.includes(alternative)) distractors.push(alternative);
    }
  }
  return {
    key, clef, notes, interval, direction,
    accidentals: intervalAccidentals(key, notes),
    correct, options: shuffle([correct, ...shuffle(distractors, random).slice(0, 3)], random),
  };
}
