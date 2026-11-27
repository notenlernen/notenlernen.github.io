import { generateQuestion, keys, quickKeys, type Clef, type Key, type Question } from './music';
import { drawQuestion, prepareNotation } from './notation';
import { questionCounts, Round, timeLimits } from './round';
import { holdRound } from './round-lock';
import { generateIntervalQuestion, type Direction, type IntervalMode, type IntervalQuestion } from './intervals';

import { generateEarQuestion, type EarQuestion } from './ear';
import { playPiano, stopPiano } from './piano';

import { getDatabase } from './storage';
import { createRoundId, localDate, recordAttempt, recordRound, sessionId, type TrainingMode } from './statistics';
import { statisticsChanged } from './statistics-ui';

const trainer = document.querySelector<HTMLElement>('#training-round')!;
const clefSettings = document.querySelector<HTMLElement>('#clef-settings')!;
const keySettings = document.querySelector<HTMLElement>('#key-settings')!;
const audioCredits = document.querySelector<HTMLElement>('#audio-credits')!;
const earPlayback = document.querySelector<HTMLElement>('#ear-playback')!;
const playInterval = document.querySelector<HTMLButtonElement>('#play-interval')!;
const audioStatus = document.querySelector<HTMLElement>('#audio-status')!;
const intervalSettings = document.querySelector<HTMLElement>('#interval-settings')!;
const intervalMode = document.querySelector<HTMLSelectElement>('#interval-mode')!;
const intervalDirection = document.querySelector<HTMLSelectElement>('#interval-direction')!;
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
let roundId: string;
let saving: Promise<void> = Promise.resolve();
let saveFailed = false;
let question: Question | IntervalQuestion | EarQuestion;
let heard = false;
let displayedMode: TrainingMode | undefined;
let roundMode: TrainingMode | undefined;
let resultMode: TrainingMode | undefined;
let directions: Direction[] = [];
let intervalLevel: IntervalMode = 'number';
let selectedKeys: Key[] = [];
let selectedClefs: Clef[] = [];
let releaseRound: (() => void) | undefined;
let timer: number | undefined;
let feedbackTimer: number | undefined;
const formatNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const seconds = (time: number | null) => time === null ? '–' : `${formatNumber.format(time / 1000)} s`;

export function showTrainer(mode: TrainingMode | undefined): boolean {
  displayedMode = mode;
  const blocked = Boolean(mode && roundMode && mode !== roundMode);
  trainer.hidden = !mode || blocked;
  intervalSettings.hidden = mode !== 'intervals' && mode !== 'ear';
  clefSettings.hidden = keySettings.hidden = mode === 'ear';
  audioCredits.hidden = mode !== 'ear';
  if (mode !== 'ear') stopPiano();
  play.hidden = !roundMode;
  result.hidden = !mode || resultMode !== mode || Boolean(roundMode);
  setup.hidden = Boolean(roundMode) || !result.hidden;
  return blocked;
}

function release(): void {
  stopPiano();
  window.clearInterval(timer);
  window.clearTimeout(feedbackTimer);
  round = undefined;
  roundMode = undefined;
  const unlock = releaseRound;
  releaseRound = undefined;
  if (unlock) void saving.finally(unlock);
}

function showSetup(): void {
  resultMode = undefined;
  release();
  status.textContent = '';
  document.dispatchEvent(new Event('training-state-changed'));
  if (!trainer.hidden) start.focus();
}

function finish(endedAt: number): void {
  const summary = round!.summary(endedAt);
  const record = { id: roundId, mode: roundMode!, timestamp: Date.now(), duration: summary.duration };
  const expectedCount = round!.attempts.length;
  saving = saving.then(async () => {
    if (await recordRound(await getDatabase(), record, expectedCount)) statisticsChanged();
  }).catch(() => reportSaveFailure(record.id));
  resultMode = roundMode;
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
  if (saveFailed) reportSaveFailure(record.id);
  document.dispatchEvent(new Event('training-state-changed'));
  if (!trainer.hidden && !result.hidden) document.querySelector<HTMLElement>('#result-heading')!.focus();
}

function reportSaveFailure(id: string): void {
  if (id !== roundId) return;
  saveFailed = true;
  status.textContent = 'Ein Teil dieser Runde konnte nicht dauerhaft gespeichert werden.';
}

function saveAnswer(attempt: Round['attempts'][number]): void {
  const id = roundId;
  const timestamp = Date.now();
  const note = 'note' in question ? question : undefined;
  const score = 'notes' in question ? question : undefined;
  const interval = score ? `Nr. ${score.interval.number}`
    : 'pitches' in question ? `${Math.abs(question.pitches[1] - question.pitches[0])} Halbtöne` : undefined;
  const entry = {
    id: `${id}:${round!.attempts.length}`, roundId: id, sessionId: sessionId(), mode: roundMode!,
    timestamp, localDate: localDate(timestamp),
    category: note ? note.correct : interval!, key: note?.key.label ?? score?.key.label,
    clef: note?.clef ?? score?.clef, interval, ...attempt,
  };
  saving = saving.then(async () => {
    await recordAttempt(await getDatabase(), entry);
    statisticsChanged();
  }).catch(() => reportSaveFailure(id));
}

function submitAnswer(correct: boolean | null): void {
  const now = performance.now();
  const outcome = round?.answer(now, correct);
  if (!outcome) return;
  saveAnswer(round!.attempts.at(-1)!);
  stopPiano();
  playInterval.disabled = true;
  audioStatus.textContent = '';
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

function beginAnswerWindow(): void {
  if (!round) return;
  round.next(performance.now());
  countdown.hidden = round.limitMs === null;
  if (!countdown.hidden) {
    tick();
    timer = window.setInterval(tick, 100);
  }
}

playInterval.addEventListener('click', async () => {
  if (!round || !('pitches' in question)) return;
  const current = question;
  playInterval.disabled = true;
  audioStatus.textContent = 'Intervall wird abgespielt.';
  try {
    if (!await playPiano(current.pitches) || !round || question !== current) return;
    if (!heard) {
      heard = true;
      for (const button of answers.querySelectorAll('button')) button.disabled = false;
      beginAnswerWindow();
    }
    playInterval.textContent = 'Intervall wiederholen';
    audioStatus.textContent = 'Intervall abgespielt. Wähle eine Antwort.';
  } catch {
    if (round && question === current) audioStatus.textContent = 'Die Töne konnten nicht abgespielt werden. Versuche es erneut.';
  } finally {
    if (round && question === current && !feedback.textContent) {
      playInterval.disabled = false;
      if (trainer.hidden) audioStatus.textContent = '';
    }
  }
});

function showQuestion(): void {
  if (!round) return;
  const ear = roundMode === 'ear';
  question = ear ? generateEarQuestion(directions, intervalLevel)
    : roundMode === 'intervals' ? generateIntervalQuestion(selectedKeys, selectedClefs, directions, intervalLevel)
    : generateQuestion(selectedKeys, selectedClefs);
  heading.textContent = `Aufgabe ${round.attempts.length + 1} von ${round.total}`;
  feedback.textContent = '';
  notation.hidden = ear;
  earPlayback.hidden = !ear;
  heard = false;
  if ('pitches' in question) {
    playInterval.textContent = 'Intervall abspielen';
    playInterval.disabled = false;
    audioStatus.textContent = '';
    countdown.hidden = true;
  } else {
    drawQuestion(notation, question);
  }
  answers.replaceChildren();
  for (const option of question.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option;
    button.disabled = ear;
    button.addEventListener('click', () => submitAnswer(option === question.correct));
    answers.append(button);
  }
  if (!ear) beginAnswerWindow();
  if (!trainer.hidden) heading.focus();
}

setup.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (start.disabled || !displayedMode) return;
  const requestedMode = displayedMode;
  selectedKeys = keys.filter(({ id }) => keyInputs.get(id)!.checked);
  if (requestedMode !== 'ear' && !selectedKeys.length) {
    status.textContent = 'Bitte mindestens eine Tonart wählen.';
    keyInputs.get('C')!.focus();
    return;
  }
  const clef = clefs.value;
  selectedClefs = clef === 'mixed' ? ['treble', 'bass'] : [clef === 'bass' ? 'bass' : 'treble'];
  const direction = intervalDirection.value;
  directions = direction === 'up' || direction === 'down' ? [direction] : ['up', 'down'];
  intervalLevel = intervalMode.value === 'quality' ? 'quality' : 'number';
  const total = count.value === 'custom' ? customCount.valueAsNumber : Number(count.value);
  const limitMs = limit.value === 'none' ? null
    : (limit.value === 'custom' ? customLimit.valueAsNumber : Number(limit.value)) * 1000;
  start.disabled = true;
  status.textContent = '';
  try {
    if (requestedMode !== 'ear') await prepareNotation();
    releaseRound = await holdRound();
    if (!releaseRound) {
      status.textContent = 'Bitte warte, bis das Update abgeschlossen ist.';
      return;
    }
    resultMode = undefined;
    roundId = createRoundId();
    saveFailed = false;
    roundMode = requestedMode;
    round = new Round(total, limitMs, performance.now());
    document.dispatchEvent(new Event('training-state-changed'));
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
