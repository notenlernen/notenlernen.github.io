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
});

test('Update verlangt Zustimmung, übersteht einen Downloadfehler und erhält IndexedDB-Daten', async ({ page, context, deployment }) => {
  await page.goto(deployment.url);
  await expect(page.getByText(offlineReady)).toBeVisible();
  await page.getByLabel('Darstellung').selectOption('dark');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('notenlernen', 1);
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
    const open = indexedDB.open('notenlernen', 1);
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
