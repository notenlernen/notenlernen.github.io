export const questionCounts = [5, 10, 15, 20, 30, 50, 100];
export const timeLimits = [3, 5, 10, 15];
export type Outcome = 'correct' | 'wrong' | 'timeout';

export class Round {
  readonly attempts: { outcome: Outcome; duration: number }[] = [];
  private shownAt: number;
  private locked = false;

  readonly total: number;
  readonly limitMs: number | null;
  private readonly startedAt: number;

  constructor(total: number, limitMs: number | null, startedAt: number) {
    this.total = total;
    this.limitMs = limitMs;
    this.startedAt = startedAt;
    this.shownAt = startedAt;
  }

  get complete(): boolean { return this.attempts.length === this.total; }

  next(now: number): void {
    this.shownAt = now;
    this.locked = false;
  }

  remaining(now: number): number | null {
    return this.limitMs === null ? null : Math.max(0, this.limitMs - (now - this.shownAt));
  }

  answer(now: number, correct: boolean | null): Outcome | undefined {
    if (this.locked || this.complete) return;
    const expired = this.remaining(now) === 0;
    if (correct === null && !expired) return;
    const outcome = expired ? 'timeout' : correct ? 'correct' : 'wrong';
    this.locked = true;
    this.attempts.push({ outcome, duration: now - this.shownAt });
    return outcome;
  }

  summary(now: number) {
    const times = this.attempts.filter(({ outcome }) => outcome !== 'timeout').map(({ duration }) => duration);
    const correctTimes = this.attempts.filter(({ outcome }) => outcome === 'correct').map(({ duration }) => duration);
    const timeout = this.attempts.filter(({ outcome }) => outcome === 'timeout').length;
    const correct = correctTimes.length;
    return {
      correct, wrong: this.attempts.length - correct, timeout,
      rate: this.attempts.length ? correct / this.attempts.length : 0,
      fastestCorrect: correct ? Math.min(...correctTimes) : null,
      slowest: times.length ? Math.max(...times) : null,
      average: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null,
      duration: now - this.startedAt,
    };
  }
}
