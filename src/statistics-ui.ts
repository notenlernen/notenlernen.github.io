import { exportStatistics, importStatistics, parseBackup } from './backup';
import { getDatabase } from './storage';
import { beforeUpdate } from './round-lock';
import { localDate, modeLabels, readStatistics, resetStatistics, sessionId, type ModeFilter, type ResetLevel, type Totals } from './statistics';

const panel = document.querySelector<HTMLElement>('#statistics')!;
const filter = document.querySelector<HTMLSelectElement>('#statistics-mode')!;
const totals = document.querySelector<HTMLElement>('#statistics-totals')!;
const trend = document.querySelector<HTMLElement>('#statistics-trend')!;
const history = document.querySelector<HTMLElement>('#statistics-history')!;
const errors = document.querySelector<HTMLElement>('#statistics-errors')!;
const status = document.querySelector<HTMLElement>('#statistics-status')!;
const level = document.querySelector<HTMLSelectElement>('#statistics-reset-level')!;
const dialog = document.querySelector<HTMLDialogElement>('#statistics-confirm')!;
const message = document.querySelector<HTMLElement>('#statistics-confirm-message')!;
const extra = document.querySelector<HTMLElement>('#statistics-confirm-extra')!;
const check = document.querySelector<HTMLInputElement>('#statistics-confirm-check')!;
const confirmAction = document.querySelector<HTMLButtonElement>('#statistics-confirm-action')!;
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('notenlernen-statistics');
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });
const seconds = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });
const formatTime = (ms: number | null) => ms === null ? '–' : `${seconds.format(ms / 1000)} s`;
const rate = ({ count, correct }: Totals) => count ? percent.format(correct / count) : '–';

let refreshId = 0;
let shownDay = '';
let busy = false;

function showTable(container: HTMLElement, columns: string[], rows: string[][]): void {
  container.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Noch keine Daten.';
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
    const summaries: [string, Totals][] = [['Diese Session', stats.session], ['Heute', stats.day], ['Langzeit', stats.lifetime]];
    showTable(totals, ['Zeitraum', 'Antworten', 'Richtig', 'Falsch', 'Timeouts', 'Quote', 'Ø Antwortzeit', 'Schnellste richtige'],
      summaries.map(([name, data]) => [
        name, String(data.count), String(data.correct), String(data.count - data.correct), String(data.timeout), rate(data),
        formatTime(data.count > data.timeout ? data.responseTime / (data.count - data.timeout) : null),
        formatTime(data.fastestCorrect),
      ]));
    showTable(trend, ['Lokales Datum', 'Antworten', 'Quote'], stats.trend.map(([date, data]) =>
      [date, String(data.count), rate(data)]));
    showTable(history, ['Runde', 'Modus', 'Richtig / Aufgaben', 'Quote', 'Dauer'], stats.history.map(round => [
      dateTime.format(round.timestamp), modeLabels[round.mode], `${round.totals.correct} / ${round.totals.count}`,
      rate(round.totals), formatTime(round.duration),
    ]));
    if (stats.bestRound) {
      const best = document.createElement('p');
      best.textContent = `Beste Rundenquote: ${rate(stats.bestRound.totals)}. Schnellste richtige Antwort: ${formatTime(stats.lifetime.fastestCorrect)}.`;
      history.prepend(best);
    }
    showTable(errors, ['Kategorie', 'Antworten', 'Fehler', 'Fehlerquote'], stats.breakdown.map(row =>
      [row.name, String(row.count), String(row.errors), percent.format(row.errors / row.count)]));
  } catch {
    if (request === refreshId) status.textContent = 'Die lokale Statistik konnte nicht geladen werden.';
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
  if (!await beforeUpdate(work)) throw new Error('Beende zuerst alle laufenden Trainingsrunden und Updates.');
}

async function modify(work: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  status.textContent = '';
  try {
    await work();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Die Änderung konnte nicht gespeichert werden.';
  } finally {
    busy = false;
  }
}

document.querySelector('#statistics-reset')!.addEventListener('click', () => {
  void modify(async () => {
    const scope = level.value as ResetLevel;
    const mode = filter.value as ModeFilter;
    const selection = mode === 'all' ? 'alle Trainingsmodi' : modeLabels[mode];
    const explanation = {
      session: `Die Statistik dieser Session zurücksetzen (${selection})?`,
      day: `Die Statistik des aktuellen Kalendertags zurücksetzen (${selection})?`,
      lifetime: `Langzeitverlauf, Rundengeschichte und adaptive Profile löschen (${selection})? Session und Tag bleiben erhalten.`,
      all: 'Die gesamte Trainingsstatistik aller Modi löschen? Deine Darstellung bleibt erhalten.',
    };
    const today = localDate(Date.now());
    if (!await ask(explanation[scope], scope === 'lifetime' || scope === 'all')) return;
    await maintain(async () => resetStatistics(await getDatabase(), scope, mode, sessionId(), today));
    statisticsChanged();
    status.textContent = 'Statistik wurde zurückgesetzt.';
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
    status.textContent = 'Lokales Statistik-Backup erstellt.';
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
    catch { throw new Error('Die Datei enthält kein gültiges JSON.'); }
    const data = parseBackup(backup);
    if (!await ask(`Statistik aller Modi durch dieses Backup ersetzen? Es enthält ${data.attempts.length} Antworten. Deine Darstellung bleibt erhalten.`, true)) return;
    await maintain(async () => importStatistics(await getDatabase(), backup));
    statisticsChanged();
    status.textContent = 'Statistik aus Backup wiederhergestellt.';
  });
});
