import type { Character, Skill } from '../types';
import { characterInitiative, initiativeDuration } from '../services/initiative';

// Milliseconds of simulated time. Initiative scales readiness/recovery, not enemy windups.
export const COMBAT_TIMING = {
  initialReadyMs: 1400,
  baseRecoveryMs: 1000,
  enemyRecoveryMs: 1800,
  interruptRecoveryMs: 650,
  guardMs: 2800,
  tacticalScale: 0.2,
  actionFactors: { attack: 0.9, defend: 1.05, item: 0.95, run: 1.1 },
};

export const playerRecoveryMs = (character: Character, action: 'attack' | 'defend' | 'skill' | 'item' | 'run', skill?: Skill): number => {
  if (action === 'skill' && skill?.recoveryMs !== undefined) return initiativeDuration(skill.recoveryMs, characterInitiative(character));
  const factor = action === 'skill' ? (skill?.targetType === 'MULTI' ? 1.6 : (skill?.cost ?? 0) >= 15 ? 1.35 : 1.15) : COMBAT_TIMING.actionFactors[action];
  return initiativeDuration(COMBAT_TIMING.baseRecoveryMs * factor, characterInitiative(character));
};
