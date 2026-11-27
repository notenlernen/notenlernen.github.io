import { exportStatistics, importStatistics, parseBackup } from './backup';
import { getDatabase } from './storage';
import { beforeUpdate } from './round-lock';
import { language, t } from './language';
import { answerLabel, categoryLabel, keyLabel } from './music-labels';
import { keys } from './music';
import { localDate, modeLabels, readStatistics, resetStatistics, sessionId, type ModeFilter, type ResetLevel, type Totals } from './statistics';

const panel = document.querySelector<HTMLElement>('#statistics')!;
const filter = document.querySelector<HTMLSelectElement>('#statistics-mode')!;
const totals = document.querySelector<HTMLElement>('#statistics-totals')!;
const trend = document.querySelector<HTMLElement>('#statistics-trend')!;
const history = document.querySelector<HTMLElement>('#statistics-history')!;
const weaknesses = document.querySelector<HTMLElement>('#statistics-weaknesses')!;
const errors = document.querySelector<HTMLElement>('#statistics-errors')!;
const status = document.querySelector<HTMLElement>('#statistics-status')!;
const level = document.querySelector<HTMLSelectElement>('#statistics-reset-level')!;
const dialog = document.querySelector<HTMLDialogElement>('#statistics-confirm')!;
const message = document.querySelector<HTMLElement>('#statistics-confirm-message')!;
const extra = document.querySelector<HTMLElement>('#statistics-confirm-extra')!;
const check = document.querySelector<HTMLInputElement>('#statistics-confirm-check')!;
const confirmAction = document.querySelector<HTMLButtonElement>('#statistics-confirm-action')!;
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('notenlernen-statistics');
const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 });
const seconds = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' });
const formatTime = (ms: number | null) => ms === null ? '–' : `${seconds.format(ms / 1000)} s`;
const rate = ({ count, correct }: Totals) => count ? percent.format(correct / count) : '–';

function modeName(mode: keyof typeof modeLabels): string {
  return t(modeLabels[mode], { notes: 'Note names', intervals: 'Visual intervals', ear: 'Ear training' }[mode]);
}

function breakdownLabel(label: string): string {
  if (language === 'de') return label;
  const [type, name] = label.split(' · ');
  if (type === 'Modus') {
    const mode = (Object.keys(modeLabels) as (keyof typeof modeLabels)[]).find(key => modeLabels[key] === name);
    return `Mode · ${mode ? modeName(mode) : name}`;
  }
  if (type === 'Tonart') {
    const key = keys.find(candidate => candidate.label === name);
    return `Key · ${key ? keyLabel(key) : name}`;
  }
  if (type === 'Schlüssel') return `Clef · ${name === 'Violin' ? 'Treble' : 'Bass'}`;
  return `Interval · ${categoryLabel(name)}`;
}

let refreshId = 0;
let shownDay = '';
let busy = false;

function showTable(container: HTMLElement, columns: string[], rows: string[][]): void {
  container.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = t('Noch keine Daten.', 'No data yet.');
    container.append(empty);
    return;
  }
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  for (const name of columns) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = name;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const line = body.insertRow();
    for (const item of row) line.insertCell().textContent = item;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', columns[0]);
  wrapper.append(table);
  container.append(wrapper);
}

async function refresh(): Promise<void> {
  if (panel.hidden) return;
  const request = ++refreshId;
  const day = localDate(Date.now());
  try {
    const stats = await readStatistics(await getDatabase(), filter.value as ModeFilter, sessionId(), day);
    if (request !== refreshId || panel.hidden) return;
    shownDay = day;
    const summaries: [string, Totals][] = [[t('Diese Session', 'This session'), stats.session], [t('Heute', 'Today'), stats.day], [t('Langzeit', 'Long term'), stats.lifetime]];
    showTable(totals, [t('Zeitraum', 'Period'), t('Antworten', 'Answers'), t('Richtig', 'Correct'), t('Falsch', 'Incorrect'), t('Timeouts', 'Timeouts'), t('Quote', 'Accuracy'), t('Ø Antwortzeit', 'Average response time'), t('Schnellste richtige', 'Fastest correct')],
      summaries.map(([name, data]) => [
        name, String(data.count), String(data.correct), String(data.count - data.correct), String(data.timeout), rate(data),
        formatTime(data.count > data.timeout ? data.responseTime / (data.count - data.timeout) : null),
        formatTime(data.fastestCorrect),
      ]));
    showTable(trend, [t('Lokales Datum', 'Local date'), t('Antworten', 'Answers'), t('Quote', 'Accuracy')], stats.trend.map(([date, data]) =>
      [date, String(data.count), rate(data)]));
    showTable(history, [t('Runde', 'Round'), t('Modus', 'Mode'), t('Richtig / Aufgaben', 'Correct / questions'), t('Quote', 'Accuracy'), t('Dauer', 'Duration')], stats.history.map(round => [
      dateTime.format(round.timestamp), modeName(round.mode), `${round.totals.correct} / ${round.totals.count}`,
      rate(round.totals), formatTime(round.duration),
    ]));
    if (stats.bestRound) {
      const best = document.createElement('p');
      best.textContent = t(
        `Beste Rundenquote: ${rate(stats.bestRound.totals)}. Schnellste richtige Antwort: ${formatTime(stats.lifetime.fastestCorrect)}.`,
        `Best round accuracy: ${rate(stats.bestRound.totals)}. Fastest correct answer: ${formatTime(stats.lifetime.fastestCorrect)}.`,
      );
      history.prepend(best);
    }
    if (stats.weaknesses.length) {
      showTable(weaknesses, [t('Modus', 'Mode'), t('Kategorie', 'Category'), t('Antworten', 'Answers'), t('Fehlerquote', 'Error rate')], stats.weaknesses.map(profile =>
        [modeName(profile.mode), profile.mode === 'notes' ? answerLabel(profile.category, true) : categoryLabel(profile.category), String(profile.count), percent.format(1 - profile.correct / profile.count)]));
    } else {
      const empty = document.createElement('p');
      empty.textContent = t('Übungsschwerpunkte erscheinen ab drei Antworten mit mindestens einem Fehler pro Kategorie.', 'Practice priorities appear after at least three answers and one error in a category.');
      weaknesses.replaceChildren(empty);
    }
    showTable(errors, [t('Kategorie', 'Category'), t('Antworten', 'Answers'), t('Fehler', 'Errors'), t('Fehlerquote', 'Error rate')], stats.breakdown.map(row =>
      [breakdownLabel(row.name), String(row.count), String(row.errors), percent.format(row.errors / row.count)]));
  } catch {
    if (request === refreshId) status.textContent = t('Die lokale Statistik konnte nicht geladen werden.', 'Local statistics could not be loaded.');
  }
}

export function showStatistics(visible: boolean): void {
  if (panel.hidden === !visible) return;
  panel.hidden = !visible;
  if (visible) void refresh();
}

export function statisticsChanged(): void {
  void refresh();
  channel?.postMessage('changed');
}

channel?.addEventListener('message', () => void refresh());
filter.addEventListener('change', () => void refresh());
window.addEventListener('focus', () => void refresh());
window.setInterval(() => {
  if (!panel.hidden && shownDay !== localDate(Date.now())) void refresh();
}, 15000);

function ask(text: string, doubleConfirmation: boolean): Promise<boolean> {
  message.textContent = text;
  extra.hidden = !doubleConfirmation;
  check.checked = false;
  confirmAction.disabled = doubleConfirmation;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
check.addEventListener('change', () => { confirmAction.disabled = !check.checked; });

async function maintain(work: () => Promise<void>): Promise<void> {
  if (!navigator.locks) {
    await work();
    return;
  }
  if (!await beforeUpdate(work)) throw new Error(t('Beende zuerst alle laufenden Trainingsrunden und Updates.', 'Finish all active rounds and updates first.'));
}

async function modify(work: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  status.textContent = '';
  try {
    await work();
  } catch (error) {
    status.textContent = error instanceof Error && language === 'de' ? error.message : t('Die Änderung konnte nicht gespeichert werden.', 'The change could not be saved.');
  } finally {
    busy = false;
  }
}

document.querySelector('#statistics-reset')!.addEventListener('click', () => {
  void modify(async () => {
    const scope = level.value as ResetLevel;
    const mode = filter.value as ModeFilter;
    const selection = mode === 'all' ? t('alle Trainingsmodi', 'all training modes') : modeName(mode);
    const explanation = {
      session: t(`Die Statistik dieser Session zurücksetzen (${selection})?`, `Reset this session’s statistics (${selection})?`),
      day: t(`Die Statistik des aktuellen Kalendertags zurücksetzen (${selection})?`, `Reset today’s statistics (${selection})?`),
      lifetime: t(
        `Langzeitverlauf, Rundengeschichte und adaptive Profile löschen (${selection})? Session und Tag bleiben erhalten.`,
        `Delete long-term history, rounds and adaptive profiles (${selection})? Session and daily totals will be kept.`,
      ),
      all: t('Die gesamte Trainingsstatistik aller Modi löschen? Deine Darstellung bleibt erhalten.', 'Delete all training statistics across all modes? Your appearance preference will be kept.'),
    };
    const today = localDate(Date.now());
    if (!await ask(explanation[scope], scope === 'lifetime' || scope === 'all')) return;
    await maintain(async () => resetStatistics(await getDatabase(), scope, mode, sessionId(), today));
    statisticsChanged();
    status.textContent = t('Statistik wurde zurückgesetzt.', 'Statistics were reset.');
  });
});

document.querySelector('#statistics-export')!.addEventListener('click', () => {
  void modify(async () => {
    const value = await exportStatistics(await getDatabase());
    const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `notenlernen-statistik-${localDate(Date.now())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = t('Lokales Statistik-Backup erstellt.', 'Local statistics backup created.');
  });
});

const input = document.querySelector<HTMLInputElement>('#statistics-import')!;
input.addEventListener('change', () => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  void modify(async () => {
    let backup: unknown;
    try { backup = JSON.parse(await file.text()); }
    catch { throw new Error(t('Die Datei enthält kein gültiges JSON.', 'The file does not contain valid JSON.')); }
    const data = parseBackup(backup);
    if (!await ask(t(
      `Statistik aller Modi durch dieses Backup ersetzen? Es enthält ${data.attempts.length} Antworten. Deine Darstellung bleibt erhalten.`,
      `Replace statistics for all modes with this backup? It contains ${data.attempts.length} answers. Your appearance preference will be kept.`,
    ), true)) return;
    await maintain(async () => importStatistics(await getDatabase(), backup));
    statisticsChanged();
    status.textContent = t('Statistik aus Backup wiederhergestellt.', 'Statistics were restored from the backup.');
  });
});
