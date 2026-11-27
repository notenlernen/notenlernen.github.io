// Training tabs share this lock, while updating needs exclusive access.
const roundLock = 'notenlernen-active-round';

export function holdRound(): Promise<(() => void) | undefined> {
  if (!navigator.locks) return Promise.resolve(() => {});
  return new Promise((resolve, reject) => {
    void navigator.locks.request(roundLock, { mode: 'shared', ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve(undefined);
        return;
      }
      await new Promise<void>((release) => resolve(release));
    }).catch(reject);
  });
}

export function beforeUpdate(activate: () => Promise<void>): Promise<boolean> {
  if (!navigator.locks) return Promise.resolve(false);
  return navigator.locks.request(roundLock, { ifAvailable: true }, async (lock) => {
    if (!lock) return false;
    await activate();
    return true;
  });
}
