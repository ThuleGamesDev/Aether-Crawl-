/** Action-speed limits shared by stat derivation, haste, runtime actions, and save validation. */
export const ACTION_SPEED_RULES = Object.freeze({
  derivedMinimum: 0.5,
  derivedMaximum: 1.75,
  maximumHasteBonus: 0.35,
});

export const MIN_EFFECTIVE_ACTION_SPEED_MULTIPLIER = ACTION_SPEED_RULES.derivedMinimum;
export const MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER =
  ACTION_SPEED_RULES.derivedMaximum * (1 + ACTION_SPEED_RULES.maximumHasteBonus);

/** Combines already-derived stats with the capped live haste multiplier. */
export function combineActionSpeedMultipliers(derivedMultiplier: number, statusMultiplier: number): number {
  const derived = Number.isFinite(derivedMultiplier)
    ? Math.max(ACTION_SPEED_RULES.derivedMinimum, Math.min(ACTION_SPEED_RULES.derivedMaximum, derivedMultiplier))
    : 1;
  const maximumStatusMultiplier = 1 + ACTION_SPEED_RULES.maximumHasteBonus;
  const status = Number.isFinite(statusMultiplier)
    ? Math.max(1, Math.min(maximumStatusMultiplier, statusMultiplier))
    : 1;
  return derived * status;
}

export function isValidEffectiveActionSpeedMultiplier(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_EFFECTIVE_ACTION_SPEED_MULTIPLIER
    && value <= MAX_EFFECTIVE_ACTION_SPEED_MULTIPLIER;
}
