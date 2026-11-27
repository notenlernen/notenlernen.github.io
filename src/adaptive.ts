import type { Outcome } from './round.ts';

export const trainingModes = ['notes', 'intervals', 'ear'] as const;
export type TrainingMode = typeof trainingModes[number];

export interface AdaptiveProfile {
  mode: TrainingMode;
  category: string;
  count: number;
  correct: number;
}

export type ProfileEvidence = Pick<AdaptiveProfile, 'mode' | 'category'> & { outcome: Outcome };

export function isProfileEvidence(value: unknown): value is ProfileEvidence {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return trainingModes.some(mode => mode === row.mode) &&
    typeof row.category === 'string' && row.category.length > 0 && row.category.length <= 120 &&
    ['correct', 'wrong', 'timeout'].some(outcome => outcome === row.outcome);
}

export function isAdaptiveProfile(profile: AdaptiveProfile): boolean {
  return trainingModes.includes(profile.mode) && typeof profile.category === 'string' &&
    Number.isSafeInteger(profile.count) && Number.isSafeInteger(profile.correct) &&
    profile.correct >= 0 && profile.correct <= profile.count;
}

export function advanceProfile(evidence: ProfileEvidence, prior?: AdaptiveProfile): AdaptiveProfile {
  return {
    mode: evidence.mode,
    category: evidence.category,
    count: (prior?.count ?? 0) + 1,
    correct: (prior?.correct ?? 0) + Number(evidence.outcome === 'correct'),
  };
}

export function accumulateProfile(evidence: ProfileEvidence, profiles: Map<string, AdaptiveProfile>): void {
  const key = JSON.stringify([evidence.mode, evidence.category]);
  profiles.set(key, advanceProfile(evidence, profiles.get(key)));
}

export function adaptiveErrorRate(profile: AdaptiveProfile): number {
  return (profile.count - profile.correct) / (profile.count + 4);
}

const candidateCount = 8;

// All candidates come from the ordinary question generator, so adaptation
// cannot introduce a category outside the user's current training settings.
export function chooseAdaptiveQuestion<T>(
  generate: () => T,
  categoryOf: (question: T) => string,
  profiles: ReadonlyMap<string, AdaptiveProfile>,
  random = Math.random,
): T {
  if (![...profiles.values()].some(profile => profile.correct < profile.count)) return generate();

  const candidates = Array.from({ length: candidateCount }, () => {
    const question = generate();
    const profile = profiles.get(categoryOf(question));
    return { question, weight: profile ? 1 + 4 * adaptiveErrorRate(profile) : 1 };
  });
  let remaining = random() * candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  for (const { question, weight } of candidates) {
    remaining -= weight;
    if (remaining < 0) return question;
  }
  return candidates[candidates.length - 1].question;
}

export function weaknesses(profiles: AdaptiveProfile[]): AdaptiveProfile[] {
  return profiles.filter(profile => profile.count >= 3 && profile.correct < profile.count)
    .sort((a, b) => adaptiveErrorRate(b) - adaptiveErrorRate(a) || b.count - a.count ||
      a.category.localeCompare(b.category, 'de'));
}
