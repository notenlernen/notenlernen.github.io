import { germanName, letters, type Key } from './music';
import { language, t } from './language';

const noteNames = new Map(letters.flatMap(letter => ([-1, 0, 1] as const).map(alteration =>
  [germanName(letter, alteration), letter + (alteration === -1 ? '♭' : alteration === 1 ? '♯' : '')] as const)));
const intervalNames: Record<string, string> = {
  Prime: 'Unison', Sekunde: 'Second', Terz: 'Third', Quarte: 'Fourth', Quinte: 'Fifth',
  Sexte: 'Sixth', Septime: 'Seventh', Oktave: 'Octave', Tritonus: 'Tritone',
};
const intervalQualities: Record<string, string> = {
  reine: 'Perfect', kleine: 'Minor', große: 'Major', verminderte: 'Diminished', übermäßige: 'Augmented',
};

export function keyLabel(key: Key): string {
  return language === 'de' ? key.label : key.id.replace(/m$/, '').replace('#', '♯').replace('b', '♭') +
    (key.mode === 'major' ? ' major' : ' minor');
}

export function answerLabel(answer: string, isNote: boolean): string {
  if (language === 'de') return answer;
  if (isNote) return noteNames.get(answer) ?? answer;
  const [quality, interval] = answer.split(' ');
  return interval ? `${intervalQualities[quality] ?? quality} ${intervalNames[interval]?.toLowerCase() ?? interval}`
    : intervalNames[quality] ?? answer;
}

export function categoryLabel(category: string): string {
  if (language === 'de') return category;
  const semitones = /^(\d+) Halbtöne$/.exec(category);
  if (semitones) return `${semitones[1]} semitone${semitones[1] === '1' ? '' : 's'}`;
  return category.replace(/^Nr\. /, 'No. ');
}

export function clefLabel(clef: 'treble' | 'bass'): string {
  return clef === 'treble' ? t('Violinschlüssel', 'treble clef') : t('Bassschlüssel', 'bass clef');
}
