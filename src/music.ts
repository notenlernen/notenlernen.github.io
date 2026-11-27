export const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = typeof letters[number];
export type Clef = 'treble' | 'bass';
export type Alteration = -1 | 0 | 1;
export interface Note { letter: Letter; octave: number; alteration: Alteration }

const major = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const minor = ['Abm', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
export const keys = [major, minor].flatMap((names, mode) => names.map((id, index) => ({
  id,
  mode: mode === 0 ? 'major' as const : 'minor' as const,
  fifths: index - 7,
  label: germanName(id[0] as Letter, id[1] === '#' ? 1 : id[1] === 'b' ? -1 : 0) + (mode === 0 ? '-Dur' : '-Moll'),
})));
export type Key = typeof keys[number];

export function germanName(letter: Letter, alteration: Alteration): string {
  if (alteration === 0) return letter === 'B' ? 'H' : letter;
  if (alteration === 1) return (letter === 'B' ? 'H' : letter) + 'is';
  const flats = { C: 'Ces', D: 'Des', E: 'Es', F: 'Fes', G: 'Ges', A: 'As', B: 'B' };
  return flats[letter];
}

export function chromaticHeight(note: Note): number {
  const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (note.octave + 1) * 12 + offsets[note.letter] + note.alteration;
}

export function keyAlteration(key: Key, letter: Letter): Alteration {
  if (key.fifths > 0 && 'FCGDAEB'.slice(0, key.fifths).includes(letter)) return 1;
  if (key.fifths < 0 && 'BEADGCF'.slice(0, -key.fifths).includes(letter)) return -1;
  return 0;
}

export function quickKeys(selection: 'major' | 'minor' | 'simple' | 'all'): Key[] {
  return keys.filter((key) => selection === 'all' ||
    (selection === 'simple' ? Math.abs(key.fifths) <= 2 : key.mode === selection));
}

export interface Question {
  key: Key;
  clef: Clef;
  note: Note;
  accidental: '' | '#' | 'b' | 'n';
  options: string[];
  correct: string;
}

export function generateQuestion(selectedKeys: Key[], clefs: Clef[], random = Math.random): Question {
  function pick<T>(items: T[]): T {
    return items[Math.floor(random() * items.length)];
  }
  function shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [items[index], items[other]] = [items[other], items[index]];
    }
    return items;
  }

  const key = pick(selectedKeys);
  const clef = pick(clefs);
  const [lowest, highest] = clef === 'treble' ? [28, 40] : [16, 30]; // C4–A5, E2–E4
  const step = lowest + Math.floor(random() * (highest - lowest + 1));
  const letter = letters[step % 7];
  const implied = keyAlteration(key, letter);
  const alterations: Alteration[] = [-1, 0, 1];
  const alteration = random() < 0.25 ? pick(alterations.filter((value) => value !== implied)) : implied;
  const accidental = alteration === implied ? '' : alteration === 1 ? '#' : alteration === -1 ? 'b' : 'n';
  const correct = germanName(letter, alteration);
  const distractors = letters.filter((candidate) => candidate !== letter)
    .map((candidate) => germanName(candidate, keyAlteration(key, candidate)));
  if (alteration !== implied) distractors.push(germanName(letter, implied));
  shuffle(distractors);
  return {
    key, clef, note: { letter, octave: Math.floor(step / 7), alteration }, accidental,
    correct, options: shuffle([correct, ...distractors.slice(0, 3)]),
  };
}
