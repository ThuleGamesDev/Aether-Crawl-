import type { Character, Skill } from '../types';

// Milliseconds of simulated combat time; no DEX speed metabalancing in this wave.
export const COMBAT_TIMING = {
  initialPlayerMs: 450,
  initialEnemyMs: 1400,
  enemyRecoveryMs: 1800,
  interruptRecoveryMs: 650,
  guardMs: 2800,
  tacticalScale: 0.2,
  classRecoveryMs: { BARBARIAN: 1000, PALADIN: 1000, SORCERER: 1100, ROGUE: 800, RANGER: 900, CLERIC: 1000, MONK: 850, NECROMANCER: 1100 },
  actionFactors: { attack: 0.9, defend: 1.05, item: 0.95, run: 1.1 },
};

export const playerRecoveryMs = (character: Character, action: 'attack' | 'defend' | 'skill' | 'item' | 'run', skill?: Skill): number => {
  if (action === 'skill' && skill?.recoveryMs !== undefined) return Math.max(300, Math.min(5000, skill.recoveryMs));
  const factor = action === 'skill' ? (skill?.targetType === 'MULTI' ? 1.6 : (skill?.cost ?? 0) >= 15 ? 1.35 : 1.15) : COMBAT_TIMING.actionFactors[action];
  return Math.round(COMBAT_TIMING.classRecoveryMs[character.classType] * factor);
};
