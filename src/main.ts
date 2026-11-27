import './style.css';
import { getDatabase, isTheme, readTheme, writeTheme } from './storage';
import { setupPwa } from './pwa';
import { showTrainer } from './trainer';
import { showStatistics } from './statistics-ui';

const areas = [
  { id: 'notennamen', title: 'Notennamen', description: 'Lies die Note und wähle ihren Namen.' },
  { id: 'visuelle-intervalle', title: 'Visuelle Intervalle', description: 'Bestimme den Abstand zwischen den beiden Noten von links nach rechts.' },
  { id: 'gehoerintervalle', title: 'Gehörintervalle', description: 'Höre beide Klaviertöne und bestimme das Intervall.' },
  { id: 'statistik', title: 'Statistik', description: 'Deine Ergebnisse bleiben in diesem Browser.' },
];

const heading = document.querySelector<HTMLHeadingElement>('#bereich')!;
const description = document.querySelector<HTMLParagraphElement>('#beschreibung')!;
const links = document.querySelectorAll<HTMLAnchorElement>('nav a');

let area = areas[0];

function renderArea(moveFocus: boolean): void {
  if (location.hash !== '#inhalt') area = areas.find(({ id }) => location.hash === '#' + id) ?? areas[0];
  else if (moveFocus) return;
  const blocked = showTrainer(area.id === 'notennamen' ? 'notes' : area.id === 'visuelle-intervalle' ? 'intervals' : area.id === 'gehoerintervalle' ? 'ear' : undefined);
  showStatistics(area.id === 'statistik');
  heading.textContent = area.title;
  description.textContent = blocked ? 'Im anderen Trainingsbereich läuft noch eine Runde.' : area.description;
  for (const link of links) {
    if (link.hash === '#' + area.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (moveFocus) heading.focus();
}

renderArea(false);
document.addEventListener('training-state-changed', () => renderArea(false));
window.addEventListener('hashchange', () => renderArea(true));
for (const link of links) {
  link.addEventListener('click', () => {
    if (link.hash === location.hash) heading.focus();
  });
}

const theme = document.querySelector<HTMLSelectElement>('#theme')!;
const storageStatus = document.querySelector<HTMLElement>('#storage-status')!;
const database = getDatabase();
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
    await writeTheme(await getDatabase(), value);
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
