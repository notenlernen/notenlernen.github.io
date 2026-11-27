import { t } from './language';
import { beforeUpdate } from './round-lock';

async function latestWorker(): Promise<string> {
  const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Die aktuelle Version ist nicht abrufbar.');
  const { version } = await response.json();
  if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) {
    throw new Error('Ungültige Versionskennung.');
  }
  return new URL(`/sw-${version}.js`, location.origin).href;
}

export async function setupPwa(
  status: HTMLElement,
  check: HTMLButtonElement,
  apply: HTMLButtonElement,
): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    status.textContent = t('Der Offline-Modus ist hier nicht verfügbar.', 'Offline mode is unavailable here.');
    return;
  }

  const workers = navigator.serviceWorker;
  let previousController = workers.controller?.scriptURL;
  let available: string | undefined;
  let activating: string | undefined;
  let releaseUpdate: (() => void) | undefined;

  const showStatus = () => {
    apply.hidden = !available || available === workers.controller?.scriptURL;
    status.textContent = !apply.hidden ? t('Ein Update ist verfügbar.', 'An update is available.')
      : workers.controller ? t('Diese App-Shell ist offline verfügbar. Die Klaviersamples sind gespeichert.', 'The app and piano samples are available offline.')
      : t('Offline-Download wird vorbereitet.', 'Preparing offline download.');
  };

  const inspectVersion = async (interactive: boolean) => {
    check.disabled = true;
    try {
      const latest = await latestWorker();
      const registration = await workers.getRegistration();
      if (workers.controller || registration?.active || registration?.waiting || registration?.installing) {
        available = latest;
        showStatus();
        return;
      }
      await register(latest);
    } catch {
      if (interactive || !workers.controller) status.textContent = t('Die aktuelle App-Version ist derzeit nicht abrufbar.', 'The latest app version is currently unavailable.');
    } finally {
      check.disabled = false;
    }
  };

  const installationFailed = () => {
    activating = undefined;
    releaseUpdate?.();
    releaseUpdate = undefined;
    apply.disabled = false;
    status.textContent = t('Der Offline-Download konnte nicht abgeschlossen werden. Bitte erneut versuchen.', 'The offline download failed. Try again.');
  };

  async function register(url: string): Promise<void> {
    try {
      const registration = await workers.register(url, { updateViaCache: 'none' });
      const installing = registration.installing;
      if (installing?.scriptURL !== url) return;
      const observeInstall = () => {
        if (installing.state === 'installing') return;
        installing.removeEventListener('statechange', observeInstall);
        if (installing.state === 'redundant' && (!activating || activating === url) && workers.controller?.scriptURL !== url) {
          installationFailed();
        }
      };
      installing.addEventListener('statechange', observeInstall);
      observeInstall();
    } catch {
      installationFailed();
    }
  }

  workers.addEventListener('controllerchange', () => {
    const controller = workers.controller?.scriptURL;
    if (controller && (activating === controller || previousController && previousController !== controller)) {
      releaseUpdate?.();
      location.reload();
      return;
    }
    previousController = controller;
    showStatus();
  });
  check.addEventListener('click', () => void inspectVersion(true));
  apply.addEventListener('click', async () => {
    if (!available || apply.disabled) return;
    const url = available;
    apply.disabled = true;
    try {
      const accepted = await beforeUpdate(() => new Promise<void>((resolve) => {
        if (workers.controller?.scriptURL === url) {
          showStatus();
          resolve();
          return;
        }
        activating = url;
        releaseUpdate = resolve;
        status.textContent = t('Update wird angewendet.', 'Applying update.');
        void register(url);
      }));
      if (!accepted) {
        status.textContent = navigator.locks
          ? t('Updates sind nach Abschluss aller offenen Runden möglich.', 'Updates are available once all active rounds have ended.')
          : t('Sichere Updates werden von diesem Browser nicht unterstützt.', 'This browser does not support safe updates.');
      }
    } catch {
      installationFailed();
    } finally {
      apply.disabled = false;
    }
  });

  showStatus();
  check.hidden = false;
  await inspectVersion(false);
}
