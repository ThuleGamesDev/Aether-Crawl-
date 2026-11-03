import type { MazeLawId } from '../types';
import { isMazeLawId } from './mazeLaws';

export const MINOTAUR_LAW_CONTRACT_VERSION = 1;
export const MINOTAUR_LAW_MODIFIER_LIMIT = 3;

/** Data-only shape for a future Guardian. This contract does not create or start a boss encounter. */
export interface MinotaurLawModifierContract {
  version: typeof MINOTAUR_LAW_CONTRACT_VERSION;
  modifierIds: MazeLawId[];
}

export function createMinotaurLawModifierContract(activeLawIds: readonly MazeLawId[]): MinotaurLawModifierContract {
  return {
    version: MINOTAUR_LAW_CONTRACT_VERSION,
    modifierIds: [...new Set(activeLawIds)].filter(isMazeLawId).slice(0, MINOTAUR_LAW_MODIFIER_LIMIT),
  };
}

export function isMinotaurLawModifierContract(value: unknown): value is MinotaurLawModifierContract {
  if (!value || typeof value !== 'object') return false;
  const contract = value as MinotaurLawModifierContract;
  return contract.version === MINOTAUR_LAW_CONTRACT_VERSION && Array.isArray(contract.modifierIds)
    && contract.modifierIds.length <= MINOTAUR_LAW_MODIFIER_LIMIT && new Set(contract.modifierIds).size === contract.modifierIds.length
    && contract.modifierIds.every(isMazeLawId);
}
