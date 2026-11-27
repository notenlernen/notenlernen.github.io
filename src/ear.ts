import { pick, shuffle } from './music.ts';
import type { Direction, IntervalMode } from './intervals.ts';

const intervals = [
  ['Prime', 'reine Prime'],
  ['Sekunde', 'kleine Sekunde'],
  ['Sekunde', 'große Sekunde'],
  ['Terz', 'kleine Terz'],
  ['Terz', 'große Terz'],
  ['Quarte', 'reine Quarte'],
  ['Tritonus', 'Tritonus'],
  ['Quinte', 'reine Quinte'],
  ['Sexte', 'kleine Sexte'],
  ['Sexte', 'große Sexte'],
  ['Septime', 'kleine Septime'],
  ['Septime', 'große Septime'],
  ['Oktave', 'reine Oktave'],
] as const;

export const samplePitches = [57, 60, 63, 66, 69, 72, 75] as const;
export type SamplePitch = typeof samplePitches[number];

export function sampleFor(pitch: number): { anchor: SamplePitch; rate: number } {
  const anchor = samplePitches.reduce((nearest, candidate) =>
    Math.abs(candidate - pitch) < Math.abs(nearest - pitch) ? candidate : nearest);
  return { anchor, rate: 2 ** ((pitch - anchor) / 12) };
}

export interface EarQuestion {
  pitches: [number, number];
  options: string[];
  correct: string;
}

export function generateEarQuestion(
  directions: Direction[],
  mode: IntervalMode,
  random = Math.random,
): EarQuestion {
  const direction = pick(directions, random);
  const distance = Math.floor(random() * intervals.length);
  const low = samplePitches[0] + Math.floor(random() * (samplePitches.at(-1)! - samplePitches[0] - distance + 1));
  const high = low + distance;
  const column = mode === 'number' ? 0 : 1;
  const correct = intervals[distance][column];
  const options = [...new Set(intervals.map(names => names[column]))].filter(name => name !== correct);
  return {
    pitches: direction === 'up' ? [low, high] : [high, low],
    correct,
    options: shuffle([correct, ...shuffle(options, random).slice(0, 3)], random),
  };
}
