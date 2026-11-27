import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test as base } from '@playwright/test';

const dist = resolve('dist');
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json',
};

const test = base.extend({
  // Playwright requires object destructuring for fixture dependencies.
  // eslint-disable-next-line no-empty-pattern
  deployment: async ({}, use) => {
    let directory = dist;
    let denyRequests = false;
    let unavailablePath;
    let nextBuild;
    const server = createServer(async (request, response) => {
      const path = new URL(request.url, 'http://localhost').pathname;
      const file = path === '/' ? '/index.html' : path;
      try {
        if (denyRequests || file === unavailablePath) {
          response.writeHead(503).end();
          return;
        }
        const body = await readFile(join(directory, file));
        response.writeHead(200, {
          'Content-Type': types[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        }).end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      await use({
        url: `http://127.0.0.1:${server.address().port}/`,
        async publishUpdate() {
          nextBuild = await mkdtemp(join(tmpdir(), 'notenlernen-e2e-'));
          await cp(dist, nextBuild, { recursive: true, filter: (path) => !/\/sw-[a-f0-9]{64}\.js$/.test(path) });
          const index = join(nextBuild, 'index.html');
          await writeFile(index, (await readFile(index, 'utf8')).replace('<body>', '<body data-test-release="2">'));
          await promisify(execFile)(process.execPath, ['scripts/build-worker.mjs', nextBuild]);
          directory = nextBuild;
        },
        breakDownload() { unavailablePath = '/icons/icon-192.png'; },
        restoreDownload() { unavailablePath = undefined; },
        goOffline() { denyRequests = true; },
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
      if (nextBuild) await rm(nextBuild, { recursive: true, force: true });
    }
  },
});

const offlineReady = 'Diese App-Shell ist offline verfügbar.';

test('Tastaturnavigation, Fokus und Darstellung auf dem Desktop', async ({ page, deployment }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(deployment.url);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  await page.goto(deployment.url + '#notennamen');
  await page.getByRole('link', { name: 'Visuelle Intervalle' }).focus();
  await page.keyboard.press('Enter');
  const heading = page.getByRole('heading', { name: 'Visuelle Intervalle' });
  await expect(heading).toBeFocused();
  await expect(heading).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('link', { name: 'Visuelle Intervalle' })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Notennamen' })).toBeVisible();

  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByLabel('Darstellung').selectOption('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.getByLabel('Darstellung')).toHaveValue('light');
});

test.describe('Touch und kleine Viewports', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true });

  test('alle Bereiche bleiben in Hoch- und Querformat bedienbar', async ({ page, deployment }) => {
    await page.goto(deployment.url);
    for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 320 }]) {
      await page.setViewportSize(viewport);
      for (const name of ['Notennamen', 'Visuelle Intervalle', 'Gehörintervalle', 'Statistik']) {
        await page.getByRole('link', { name, exact: true }).tap();
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      }
      expect(await page.locator('html').evaluate((html) => html.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
  });
});

test('Offline-Neustart in einem neuen Tab', async ({ page, context, deployment }) => {
  await page.goto(deployment.url);
  await expect(page.getByText(offlineReady)).toBeVisible();
  await page.close();
  deployment.goOffline();
  await context.setOffline(true);

  const restarted = await context.newPage();
  await restarted.goto(deployment.url + '#statistik');
  await expect(restarted.getByRole('heading', { name: 'Statistik' })).toBeVisible();
  await expect(restarted.getByText(offlineReady)).toBeVisible();
  await expect(restarted.locator('html')).toHaveCSS('line-height', '25.6px');
  await restarted.getByRole('link', { name: 'Notennamen' }).click();
  await restarted.getByRole('button', { name: 'Runde starten' }).click();
  await expect(restarted.getByRole('img', { name: /Lesenote im Violinschlüssel/ })).toBeVisible();
  expect(await restarted.evaluate(() => document.fonts.check('40px Bravura'))).toBe(true);
});

test('Update verlangt Zustimmung, übersteht einen Downloadfehler und erhält IndexedDB-Daten', async ({ page, context, deployment }) => {
  await page.goto(deployment.url);
  await expect(page.getByText(offlineReady)).toBeVisible();
  await page.getByLabel('Darstellung').selectOption('dark');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('notenlernen');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('attempts', 'readwrite');
      transaction.objectStore('attempts').put({ id: 'test', mode: 'notennamen', timestamp: 123, correct: true });
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }));
  await deployment.publishUpdate();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
  const update = page.getByRole('button', { name: 'Update anwenden' });
  await expect(update).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-test-release', '2');

  await page.close();
  const restarted = await context.newPage();
  await restarted.goto(deployment.url);
  await expect(restarted.locator('body')).not.toHaveAttribute('data-test-release', '2');
  await expect(restarted.getByLabel('Darstellung')).toHaveValue('dark');

  const accept = restarted.getByRole('button', { name: 'Update anwenden' });
  deployment.breakDownload();
  await accept.click();
  await expect(restarted.getByText('Der Offline-Download konnte nicht abgeschlossen werden.', { exact: false })).toBeVisible();
  await expect(restarted.locator('body')).not.toHaveAttribute('data-test-release', '2');

  deployment.restoreDownload();
  await accept.click();
  await expect(restarted.locator('body')).toHaveAttribute('data-test-release', '2');
  await expect(restarted.getByLabel('Darstellung')).toHaveValue('dark');
  const attempt = await restarted.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('notenlernen');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('attempts');
      const request = transaction.objectStore('attempts').get('test');
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }));
  expect(attempt).toEqual({ id: 'test', mode: 'notennamen', timestamp: 123, correct: true });
  deployment.goOffline();
  await context.setOffline(true);
  await restarted.reload();
  await expect(restarted.locator('body')).toHaveAttribute('data-test-release', '2');
});

test('Manifest und Icons entsprechen der Installationskonfiguration', async ({ page, request, deployment, browserName }) => {
  await page.goto(deployment.url);
  await expect(page.getByText(offlineReady)).toBeVisible();
  const response = await request.get(new URL('/manifest.webmanifest', deployment.url).href);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'Notenlernen', start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.icons.map(({ sizes, purpose }) => [sizes, purpose])).toEqual([
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable'],
  ]);
  for (const { src, sizes } of [...manifest.icons, { src: '/icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const icon = await request.get(new URL(src, deployment.url).href);
    expect(icon.ok()).toBeTruthy();
    const png = await icon.body();
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)].join('x')).toBe(sizes);
  }
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    const { installabilityErrors } = await session.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
  }
});

test('Notennamentraining mit Bassschlüssel, Tonart und eigener Aufgabenanzahl', async ({ page, deployment }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(deployment.url);
  const tonarten = page.getByRole('group', { name: 'Tonarten', exact: true });
  await expect(tonarten.getByRole('checkbox')).toHaveCount(30);
  await page.getByRole('button', { name: 'Alle Moll', exact: true }).click();
  await expect(tonarten.getByRole('checkbox', { checked: true })).toHaveCount(15);
  await page.getByRole('button', { name: 'Bis zwei Vorzeichen' }).click();
  await expect(tonarten.getByRole('checkbox', { checked: true })).toHaveCount(10);
  await page.getByRole('button', { name: 'Alle Tonarten', exact: true }).click();
  await expect(tonarten.getByRole('checkbox', { checked: true })).toHaveCount(30);
  await page.reload();
  await tonarten.getByRole('checkbox', { name: 'C-Dur', exact: true }).uncheck();
  await tonarten.getByRole('checkbox', { name: 'Fis-Dur', exact: true }).check();
  await page.getByLabel('Notenschlüssel').selectOption('bass');
  await page.getByLabel('Aufgaben', { exact: true }).selectOption('custom');
  await page.getByLabel('Eigene Aufgabenanzahl').fill('1');
  await page.getByRole('button', { name: 'Runde starten' }).click();

  await expect(page.getByRole('heading', { name: 'Aufgabe 1 von 1' })).toBeFocused();
  const staff = page.getByRole('img', { name: /Lesenote im Bassschlüssel/ });
  await expect(staff).toBeVisible();
  await expect(staff.locator('.vf-clef')).toHaveCount(1);
  await expect(staff.locator('.vf-keysignature text')).toHaveCount(6);
  await expect(staff.locator('.vf-stavenote path')).not.toHaveCount(0);
  const buttons = page.locator('#answers').getByRole('button');
  await expect(buttons).toHaveCount(4);
  expect(new Set(await buttons.allTextContents()).size).toBe(4);
  await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  const correct = page.locator('#answers').getByRole('button', { name: 'Es', exact: true });
  await correct.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rundenauswertung' })).toBeFocused();
  await expect(page.getByText('Richtig', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('1');
  await expect(page.locator('#result-values dt')).toHaveCount(8);
  await expect(page.getByText('Zeitüberschreitungen', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('0');
  expect(pageErrors).toEqual([]);
});

test('Zeitüberschreitung wird gewertet und zählt nicht zur Antwortzeit', async ({ page, deployment }) => {
  await page.goto(deployment.url);
  await page.getByLabel('Aufgaben', { exact: true }).selectOption('custom');
  await page.getByLabel('Eigene Aufgabenanzahl').fill('1');
  await page.getByLabel('Zeitlimit pro Aufgabe').selectOption('custom');
  await page.getByLabel('Eigene Sekunden pro Aufgabe').fill('1');
  await page.getByRole('button', { name: 'Runde starten' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rundenauswertung' })).toBeVisible();
  const value = (term) => page.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]');
  await expect(value('Falsch (inkl. Zeitüberschreitungen)')).toHaveText('1');
  await expect(page.getByText('Zeitüberschreitungen', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('1');
  await expect(value('Mittlere Antwortzeit')).toHaveText('–');
});

test('Eine offene Runde in einem anderen Tab blockiert bestätigte Updates', async ({ page, context, deployment }) => {
  await page.goto(deployment.url);
  await expect(page.getByText(offlineReady)).toBeVisible();
  const trainer = await context.newPage();
  await trainer.goto(deployment.url);
  await trainer.getByRole('button', { name: 'Runde starten' }).click();
  await expect(trainer.getByRole('heading', { name: 'Aufgabe 1 von 5' })).toBeVisible();

  await deployment.publishUpdate();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Nach Updates suchen' }).click();
  const update = page.getByRole('button', { name: 'Update anwenden' });
  await update.click();
  await expect(page.getByText('Updates sind nach Abschluss aller offenen Runden möglich.')).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-test-release', '2');
  await trainer.getByRole('button', { name: 'Runde abbrechen' }).click();
  await page.bringToFront();
  await expect.poll(() => page.evaluate(async () => (await navigator.locks.query()).held.length)).toBe(0);
  await update.click();
  await expect(page.locator('body')).toHaveAttribute('data-test-release', '2');
});

test('Visuelle Intervalle in beiden Modi und Wechsel bei aktiver Runde', async ({ page, deployment }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(deployment.url + '#visuelle-intervalle');
  await page.getByLabel('Richtung').selectOption('down');
  await page.getByLabel('Gefragte Eigenschaft').selectOption('quality');
  await page.getByLabel('Aufgaben', { exact: true }).selectOption('custom');
  await page.getByLabel('Eigene Aufgabenanzahl').fill('1');
  await page.getByRole('button', { name: 'Runde starten' }).click();
  const score = page.getByRole('img', { name: /Zwei Noten im Violinschlüssel/ });
  await expect(score.locator('.vf-stavenote')).toHaveCount(2);
  await expect(page.locator('#answers button')).toHaveCount(4);

  await page.getByRole('link', { name: 'Notennamen', exact: true }).click();
  await expect(page.getByText('Im anderen Trainingsbereich läuft noch eine Runde.')).toBeVisible();
  await page.getByRole('link', { name: 'Visuelle Intervalle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Aufgabe 1 von 1' })).toBeVisible();
  await page.getByRole('button', { name: 'reine Prime', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rundenauswertung' })).toBeVisible();
  await expect(page.getByText('Richtig', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('1');

  await page.getByRole('link', { name: 'Notennamen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible();
  await page.getByRole('link', { name: 'Visuelle Intervalle', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rundenauswertung' })).toBeVisible();
  await page.getByRole('button', { name: 'Neue Runde einrichten' }).click();
  await page.getByLabel('Richtung').selectOption('up');
  await page.getByLabel('Gefragte Eigenschaft').selectOption('number');
  await page.getByRole('button', { name: 'Runde starten' }).click();
  await expect(score.locator('.vf-stavenote')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Prime', exact: true })).toBeVisible();
});

test('Gehörtraining spielt erst auf Klick und wiederholt dasselbe Intervall offline', async ({ page, context, deployment }) => {
  await context.addInitScript(() => {
    Math.random = () => 0.45;
    const starts = [];
    Object.defineProperty(globalThis, 'testAudioStarts', { value: starts });
    const original = globalThis.AudioBufferSourceNode.prototype.start;
    globalThis.AudioBufferSourceNode.prototype.start = function (...args) {
      starts.push({ at: args[0], rate: this.playbackRate.value, channels: this.buffer.numberOfChannels });
      return original.apply(this, args);
    };
  });
  await page.goto(deployment.url);
  await expect(page.getByText('Die Klaviersamples sind gespeichert.', { exact: false })).toBeVisible();
  await page.close();
  deployment.goOffline();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto(deployment.url + '#gehoerintervalle');

  await offline.getByLabel('Gefragte Eigenschaft').selectOption('quality');
  await offline.getByLabel('Richtung').selectOption('down');
  await offline.getByLabel('Aufgaben', { exact: true }).selectOption('custom');
  await offline.getByLabel('Eigene Aufgabenanzahl').fill('1');
  await offline.getByLabel('Zeitlimit pro Aufgabe').selectOption('5');
  await offline.getByRole('button', { name: 'Runde starten' }).click();
  await expect(offline.getByRole('heading', { name: 'Aufgabe 1 von 1' })).toBeVisible();
  await expect(offline.getByRole('timer')).toBeHidden();
  await expect(offline.locator('#answers button:disabled')).toHaveCount(4);
  expect(await offline.evaluate(() => globalThis.testAudioStarts)).toHaveLength(0);

  await offline.getByRole('button', { name: 'Intervall abspielen' }).click();
  const replay = offline.getByRole('button', { name: 'Intervall wiederholen' });
  await expect(replay).toBeEnabled();
  await expect(offline.getByRole('timer')).toBeVisible();
  const first = await offline.evaluate(() => globalThis.testAudioStarts);
  expect(first).toHaveLength(2);
  expect(first.every(tone => tone.channels === 1)).toBe(true);
  expect(first[1].at - first[0].at).toBeCloseTo(0.65);
  await replay.click();
  await expect(replay).toBeEnabled();
  const all = await offline.evaluate(() => globalThis.testAudioStarts);
  expect(all).toHaveLength(4);
  await expect(offline.getByRole('timer')).toHaveText(/Verbleibend: [1-4] s/);
  expect(all.slice(2).map(tone => tone.rate)).toEqual(first.map(tone => tone.rate));
  await offline.getByRole('button', { name: 'reine Quarte', exact: true }).click();
  await expect(offline.getByRole('heading', { name: 'Rundenauswertung' })).toBeVisible();
  await expect(offline.getByText('Richtig', { exact: true }).locator('xpath=following-sibling::dd[1]')).toHaveText('1');
});

test('Statistik persistiert, filtert und stellt ein bestätigtes lokales Backup wieder her', async ({ page, deployment }) => {
  await page.goto(deployment.url);
  await page.getByText(offlineReady).waitFor();
  await page.getByLabel('Darstellung').selectOption('dark');
  await page.getByLabel('Aufgaben', { exact: true }).selectOption('custom');
  await page.getByLabel('Eigene Aufgabenanzahl').fill('1');
  await page.getByRole('button', { name: 'Runde starten' }).click();
  await page.locator('#answers button').first().click();
  await expect(page.getByRole('heading', { name: 'Rundenauswertung' })).toBeVisible();
  await page.getByRole('link', { name: 'Statistik', exact: true }).click();

  const answersFor = name => page.getByRole('row', { name: new RegExp('^' + name + ' ') }).getByRole('cell').nth(1);
  await expect(answersFor('Langzeit')).toHaveText('1');
  await page.reload();
  await expect(answersFor('Diese Session')).toHaveText('1');
  await page.getByLabel('Trainingsmodus', { exact: true }).selectOption('ear');
  await expect(answersFor('Langzeit')).toHaveText('0');
  await page.getByLabel('Trainingsmodus', { exact: true }).selectOption('notes');
  await expect(answersFor('Langzeit')).toHaveText('1');

  await page.getByText('Lokales Backup', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Statistik exportieren' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByText('Statistik zurücksetzen', { exact: true }).click();
  await page.getByLabel('Ebene').selectOption('lifetime');
  await page.getByRole('button', { name: 'Zurücksetzen …' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Bestätigen' });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await confirm.click();
  await expect(answersFor('Langzeit')).toHaveText('0');
  await expect(answersFor('Heute')).toHaveText('1');

  await page.getByLabel('Backup-Datei auswählen').setInputFiles(path);
  await expect(dialog).toBeVisible();
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await confirm.click();
  await expect(answersFor('Langzeit')).toHaveText('1');
  await expect(page.getByLabel('Darstellung')).toHaveValue('dark');
});
