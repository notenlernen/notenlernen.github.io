import { generateQuestion, keys, quickKeys, type Clef, type Key, type Question } from './music';
import { drawQuestion, prepareNotation } from './notation';
import { questionCounts, Round, timeLimits } from './round';
import { holdRound } from './round-lock';

const setup = document.querySelector<HTMLFormElement>('#round-setup')!;
const start = document.querySelector<HTMLButtonElement>('#start-round')!;
const groups = document.querySelector<HTMLElement>('#key-groups')!;
const clefs = document.querySelector<HTMLSelectElement>('#clefs')!;
const count = document.querySelector<HTMLSelectElement>('#question-count')!;
const limit = document.querySelector<HTMLSelectElement>('#time-limit')!;
const customCount = document.querySelector<HTMLInputElement>('#custom-count')!;
const customLimit = document.querySelector<HTMLInputElement>('#custom-limit')!;
const play = document.querySelector<HTMLElement>('#round-play')!;
const heading = document.querySelector<HTMLElement>('#question-heading')!;
const countdown = document.querySelector<HTMLElement>('#countdown')!;
const notation = document.querySelector<HTMLDivElement>('#notation')!;
const answers = document.querySelector<HTMLElement>('#answers')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const result = document.querySelector<HTMLElement>('#round-result')!;
const values = document.querySelector<HTMLElement>('#result-values')!;
const status = document.querySelector<HTMLElement>('#round-status')!;

const keyInputs = new Map<string, HTMLInputElement>();
for (const mode of ['major', 'minor']) {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = mode === 'major' ? 'Dur' : 'Moll';
  fieldset.append(legend);
  for (const key of keys.filter((key) => key.mode === mode)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = key.id === 'C';
    keyInputs.set(key.id, input);
    label.append(input, key.label);
    fieldset.append(label);
  }
  groups.append(fieldset);
}

for (const button of setup.querySelectorAll<HTMLButtonElement>('[data-keys]')) {
  button.addEventListener('click', () => {
    const choice = button.dataset.keys;
    if (choice !== 'major' && choice !== 'minor' && choice !== 'simple' && choice !== 'all') return;
    const selected = new Set(quickKeys(choice).map(({ id }) => id));
    for (const [id, input] of keyInputs) input.checked = selected.has(id);
    status.textContent = `${selected.size} Tonarten ausgewählt.`;
  });
}

count.append(...questionCounts.map((number) => new Option(String(number))), new Option('Eigene Anzahl', 'custom'));
limit.append(new Option('Ohne Zeitlimit', 'none'),
  ...timeLimits.map((number) => new Option(`${number} Sekunden`, String(number))),
  new Option('Eigenes Zeitlimit', 'custom'));
function toggleCustom(select: HTMLSelectElement, input: HTMLInputElement): void {
  const visible = select.value === 'custom';
  input.disabled = !visible;
  input.closest('label')!.hidden = !visible;
}
count.addEventListener('change', () => toggleCustom(count, customCount));
limit.addEventListener('change', () => toggleCustom(limit, customLimit));

let round: Round | undefined;
let question: Question;
let selectedKeys: Key[] = [];
let selectedClefs: Clef[] = [];
let releaseRound: (() => void) | undefined;
let timer: number | undefined;
let feedbackTimer: number | undefined;
const formatNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const seconds = (time: number | null) => time === null ? '–' : `${formatNumber.format(time / 1000)} s`;

function release(): void {
  window.clearInterval(timer);
  window.clearTimeout(feedbackTimer);
  round = undefined;
  releaseRound?.();
  releaseRound = undefined;
}

function showSetup(): void {
  release();
  result.hidden = true;
  play.hidden = true;
  setup.hidden = false;
  status.textContent = '';
  start.focus();
}

function finish(endedAt: number): void {
  const summary = round!.summary(endedAt);
  const entries = [
    ['Richtig', String(summary.correct)],
    ['Falsch (inkl. Zeitüberschreitungen)', String(summary.wrong)],
    ['Zeitüberschreitungen', String(summary.timeout)],
    ['Quote', `${formatNumber.format(summary.rate * 100)} %`],
    ['Schnellste richtige Antwort', seconds(summary.fastestCorrect)],
    ['Langsamste Antwort', seconds(summary.slowest)],
    ['Mittlere Antwortzeit', seconds(summary.average)],
    ['Gesamtdauer', seconds(summary.duration)],
  ];
  values.replaceChildren();
  for (const [name, value] of entries) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = name;
    detail.textContent = value;
    values.append(term, detail);
  }
  release();
  play.hidden = true;
  result.hidden = false;
  document.querySelector<HTMLElement>('#result-heading')!.focus();
}

function submitAnswer(correct: boolean | null): void {
  const now = performance.now();
  const outcome = round?.answer(now, correct);
  if (!outcome) return;
  window.clearInterval(timer);
  for (const button of answers.querySelectorAll('button')) {
    button.setAttribute('aria-disabled', 'true');
    if (button.textContent === question.correct) button.dataset.correct = 'true';
  }
  feedback.textContent = outcome === 'correct' ? 'Richtig.'
    : `${outcome === 'timeout' ? 'Zeit abgelaufen.' : 'Falsch.'} Richtig ist ${question.correct}.`;
  feedbackTimer = window.setTimeout(() => {
    if (round?.complete) finish(now);
    else showQuestion();
  }, 1250);
}

function tick(): void {
  const remaining = round?.remaining(performance.now());
  if (remaining === null || remaining === undefined) return;
  const message = `Verbleibend: ${Math.ceil(remaining / 1000)} s`;
  if (countdown.textContent !== message) countdown.textContent = message;
  if (remaining === 0) submitAnswer(null);
}

function showQuestion(): void {
  if (!round) return;
  question = generateQuestion(selectedKeys, selectedClefs);
  heading.textContent = `Aufgabe ${round.attempts.length + 1} von ${round.total}`;
  feedback.textContent = '';
  drawQuestion(notation, question);
  answers.replaceChildren();
  for (const option of question.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option;
    button.addEventListener('click', () => submitAnswer(option === question.correct));
    answers.append(button);
  }
  round.next(performance.now());
  countdown.hidden = round.limitMs === null;
  if (!countdown.hidden) {
    tick();
    timer = window.setInterval(tick, 100);
  }
  heading.focus();
}

setup.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (start.disabled) return;
  selectedKeys = keys.filter(({ id }) => keyInputs.get(id)!.checked);
  if (!selectedKeys.length) {
    status.textContent = 'Bitte mindestens eine Tonart wählen.';
    keyInputs.get('C')!.focus();
    return;
  }
  const clef = clefs.value;
  selectedClefs = clef === 'mixed' ? ['treble', 'bass'] : [clef === 'bass' ? 'bass' : 'treble'];
  const total = count.value === 'custom' ? customCount.valueAsNumber : Number(count.value);
  const limitMs = limit.value === 'none' ? null
    : (limit.value === 'custom' ? customLimit.valueAsNumber : Number(limit.value)) * 1000;
  start.disabled = true;
  status.textContent = '';
  try {
    await prepareNotation();
    releaseRound = await holdRound();
    if (!releaseRound) {
      status.textContent = 'Bitte warte, bis das Update abgeschlossen ist.';
      return;
    }
    round = new Round(total, limitMs, performance.now());
    setup.hidden = true;
    play.hidden = false;
    showQuestion();
  } catch {
    showSetup();
    status.textContent = 'Die Runde konnte nicht gestartet werden.';
  } finally {
    start.disabled = false;
  }
});

document.querySelector('#cancel-round')!.addEventListener('click', showSetup);
document.querySelector('#new-round')!.addEventListener('click', showSetup);
