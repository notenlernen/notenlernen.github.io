import './style.css';
import { getDatabase, isTheme, readTheme, writeTheme } from './storage';
import { setupPwa } from './pwa';
import { showTrainer } from './trainer';
import { showStatistics } from './statistics-ui';
import { languageLink, t } from './language';

const areas = [
  { id: 'notennamen', title: t('Notennamen', 'Note names'), description: t('Lies die Note und wähle ihren Namen.', 'Read the note and choose its name.') },
  { id: 'visuelle-intervalle', title: t('Visuelle Intervalle', 'Visual intervals'), description: t('Bestimme den Abstand zwischen den beiden Noten von links nach rechts.', 'Identify the interval between the two notes from left to right.') },
  { id: 'gehoerintervalle', title: t('Gehörintervalle', 'Ear training'), description: t('Höre beide Klaviertöne und bestimme das Intervall.', 'Listen to both piano notes and identify the interval.') },
  { id: 'statistik', title: t('Statistik', 'Statistics'), description: t('Deine Ergebnisse bleiben in diesem Browser.', 'Your results stay in this browser.') },
];

const heading = document.querySelector<HTMLHeadingElement>('#bereich')!;
const description = document.querySelector<HTMLParagraphElement>('#beschreibung')!;
const links = document.querySelectorAll<HTMLAnchorElement>('nav a');

let area = areas[0];

function renderArea(moveFocus: boolean): void {
  languageLink();
  if (location.hash !== '#inhalt') area = areas.find(({ id }) => location.hash === '#' + id) ?? areas[0];
  else if (moveFocus) return;
  const blocked = showTrainer(area.id === 'notennamen' ? 'notes' : area.id === 'visuelle-intervalle' ? 'intervals' : area.id === 'gehoerintervalle' ? 'ear' : undefined);
  showStatistics(area.id === 'statistik');
  heading.textContent = area.title;
  description.textContent = blocked ? t('Im anderen Trainingsbereich läuft noch eine Runde.', 'A round is still in progress in another training mode.') : area.description;
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
  storageStatus.textContent = t('Lokale Einstellungen sind in diesem Browser derzeit nicht verfügbar.', 'Local settings are currently unavailable in this browser.');
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
    storageStatus.textContent = t('Die Darstellung konnte nicht dauerhaft gespeichert werden.', 'Your appearance preference could not be saved.');
  }
});

void setupPwa(
  document.querySelector<HTMLElement>('#offline-status')!,
  document.querySelector<HTMLButtonElement>('#check-update')!,
  document.querySelector<HTMLButtonElement>('#apply-update')!,
);
