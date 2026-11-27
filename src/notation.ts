import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow/bravura';
import type { AccidentalMark, Clef, Note, Question } from './music';
import { t } from './language';
import { clefLabel, keyLabel } from './music-labels';
import type { IntervalQuestion } from './intervals';

export async function prepareNotation(): Promise<void> {
  await document.fonts.load('40px Bravura');
}

export function drawQuestion(container: HTMLDivElement, question: Question | IntervalQuestion): void {
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(350, 146);
  container.style.removeProperty('width');
  const context = renderer.getContext();
  const stave = new Stave(10, 23, 330).addClef(question.clef).addKeySignature(question.key.id);
  stave.setContext(context).draw();

  const notes = 'notes' in question
    ? question.notes.map((note, index) => staveNote(note, question.clef, question.accidentals[index], 'q'))
    : [staveNote(question.note, question.clef, question.accidental, 'w')];
  Formatter.FormatAndDraw(context, stave, notes);
  const svg = container.querySelector('svg')!;
  svg.style.removeProperty('width');
  svg.style.removeProperty('height');
  svg.setAttribute('viewBox', '0 0 350 146');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${'notes' in question ? t('Zwei Noten', 'Two notes') : t('Lesenote', 'Note')} ${t('im', 'in')} ${clefLabel(question.clef)}, ${keyLabel(question.key)}`);
}

function staveNote(note: Note, clef: Clef, accidental: AccidentalMark, duration: string): StaveNote {
  const alteration = note.alteration === 1 ? '#' : note.alteration === -1 ? 'b' : '';
  const glyph = new StaveNote({
    clef, duration, keys: [`${note.letter.toLowerCase()}${alteration}/${note.octave}`],
  });
  if (accidental) glyph.addModifier(new Accidental(accidental), 0);
  return glyph;
}
