import { Accidental, Formatter, Renderer, Stave, StaveNote } from 'vexflow/bravura';
import type { Question } from './music';

export async function prepareNotation(): Promise<void> {
  await document.fonts.load('40px Bravura');
}

export function drawQuestion(container: HTMLDivElement, question: Question): void {
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(350, 146);
  const context = renderer.getContext();
  const stave = new Stave(10, 23, 330).addClef(question.clef).addKeySignature(question.key.id);
  stave.setContext(context).draw();

  const alteration = question.note.alteration === 1 ? '#' : question.note.alteration === -1 ? 'b' : '';
  const note = new StaveNote({
    clef: question.clef, duration: 'w',
    keys: [`${question.note.letter.toLowerCase()}${alteration}/${question.note.octave}`],
  });
  if (question.accidental) note.addModifier(new Accidental(question.accidental), 0);
  Formatter.FormatAndDraw(context, stave, [note]);
  const svg = container.querySelector('svg')!;
  svg.setAttribute('viewBox', '0 0 350 146');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Lesenote im ${question.clef === 'treble' ? 'Violinschlüssel' : 'Bassschlüssel'}, ${question.key.label}`);
}
