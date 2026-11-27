async function latestWorker(): Promise<string> {
  const response = await fetch('/version.json', { cache: 'no-store' });
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
  canApplyUpdate: () => boolean,
): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    status.textContent = 'Der Offline-Modus ist hier nicht verfügbar.';
    return;
  }

  const workers = navigator.serviceWorker;
  let available: string | undefined;
  let activating: string | undefined;

  const showStatus = () => {
    apply.hidden = !available || available === workers.controller?.scriptURL;
    status.textContent = !apply.hidden ? 'Ein Update ist verfügbar.'
      : workers.controller ? 'Diese App-Shell ist offline verfügbar.'
      : 'Offline-Download wird vorbereitet.';
  };

  const inspectVersion = async (interactive: boolean) => {
    check.disabled = true;
    try {
      const latest = await latestWorker();
      const registration = await workers.getRegistration();
      if (registration?.active || registration?.waiting || registration?.installing) {
        available = latest;
        showStatus();
        return;
      }
      await register(latest);
    } catch {
      if (interactive || !workers.controller) status.textContent = 'Die aktuelle App-Version ist derzeit nicht abrufbar.';
    } finally {
      check.disabled = false;
    }
  };

  const installationFailed = () => {
    activating = undefined;
    apply.disabled = false;
    status.textContent = 'Der Offline-Download konnte nicht abgeschlossen werden. Bitte erneut versuchen.';
  };

  async function register(url: string): Promise<void> {
    try {
      const registration = await workers.register(url, { updateViaCache: 'none' });
      const installing = registration.installing;
      if (installing?.state === 'redundant') installationFailed();
      else installing?.addEventListener('statechange', () => {
        if (installing.state === 'redundant' && workers.controller?.scriptURL !== url) installationFailed();
      });
    } catch {
      installationFailed();
    }
  }

  workers.addEventListener('controllerchange', () => {
    if (activating === workers.controller?.scriptURL && activating) window.location.reload();
    else showStatus();
  });
  check.addEventListener('click', () => void inspectVersion(true));
  apply.addEventListener('click', () => {
    if (!available || activating) return;
    if (!canApplyUpdate()) {
      status.textContent = 'Updates sind nach Abschluss der Runde möglich.';
      return;
    }
    activating = available;
    apply.disabled = true;
    status.textContent = 'Update wird angewendet.';
    void register(available);
  });

  showStatus();
  check.hidden = false;
  await inspectVersion(false);
}
