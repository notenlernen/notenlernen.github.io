import './style.css';
import { isTheme, openDatabase, readTheme, writeTheme } from './storage';
import { setupPwa } from './pwa';
import './trainer';

const areas = [
  { id: 'notennamen', title: 'Notennamen', description: 'Lies die Note und wähle ihren Namen.' },
  { id: 'visuelle-intervalle', title: 'Visuelle Intervalle', description: 'Das Training für visuelle Intervalle folgt in M2.' },
  { id: 'gehoerintervalle', title: 'Gehörintervalle', description: 'Das Gehörtraining folgt in M3.' },
  { id: 'statistik', title: 'Statistik', description: 'Die Trainingsstatistik folgt in M4.' },
];

const heading = document.querySelector<HTMLHeadingElement>('#bereich')!;
const description = document.querySelector<HTMLParagraphElement>('#beschreibung')!;
const links = document.querySelectorAll<HTMLAnchorElement>('nav a');
const trainer = document.querySelector<HTMLElement>('#note-trainer')!;

function renderArea(moveFocus: boolean): void {
  if (location.hash === '#inhalt') return;
  const area = areas.find(({ id }) => location.hash === '#' + id) ?? areas[0];
  trainer.hidden = area.id !== 'notennamen';
  heading.textContent = area.title;
  description.textContent = area.description;
  for (const link of links) {
    if (link.hash === '#' + area.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (moveFocus) heading.focus();
}

renderArea(false);
window.addEventListener('hashchange', () => renderArea(true));
for (const link of links) {
  link.addEventListener('click', () => {
    if (link.hash === location.hash) heading.focus();
  });
}

const theme = document.querySelector<HTMLSelectElement>('#theme')!;
const storageStatus = document.querySelector<HTMLElement>('#storage-status')!;
const database = openDatabase();
let themeChanged = false;

database.then(readTheme).then((saved) => {
  if (themeChanged) return;
  theme.value = saved;
  document.documentElement.dataset.theme = saved;
}).catch(() => {
  storageStatus.textContent = 'Lokale Einstellungen sind in diesem Browser derzeit nicht verfügbar.';
});

theme.addEventListener('change', async () => {
  const value = theme.value;
  if (!isTheme(value)) return;
  themeChanged = true;
  document.documentElement.dataset.theme = value;
  try {
    await writeTheme(await database, value);
    storageStatus.textContent = '';
  } catch {
    storageStatus.textContent = 'Die Darstellung konnte nicht dauerhaft gespeichert werden.';
  }
});

void setupPwa(
  document.querySelector<HTMLElement>('#offline-status')!,
  document.querySelector<HTMLButtonElement>('#check-update')!,
  document.querySelector<HTMLButtonElement>('#apply-update')!,
);
