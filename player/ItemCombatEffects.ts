import type { DerivedCharacterStats, RealtimeStatusId } from '../types';

export interface ItemStatusProc {
  statusId: Extract<RealtimeStatusId, 'BLEED' | 'POISON' | 'BURN'>;
  powerMultiplier: number;
  durationSeconds: number;
}

/** Rolls at most one damaging status per successful player hit, capped at 60% total chance. */
export function rollItemStatusProc(derived: DerivedCharacterStats, random: () => number): ItemStatusProc | null {
  const options: Array<ItemStatusProc & { chance: number }> = [
    { statusId: 'BLEED' as const, powerMultiplier: derived.bleedPowerMultiplier, durationSeconds: 3, chance: derived.bleedChance },
    { statusId: 'POISON' as const, powerMultiplier: derived.poisonPowerMultiplier, durationSeconds: 3, chance: derived.poisonChance },
    { statusId: 'BURN' as const, powerMultiplier: derived.firePowerMultiplier, durationSeconds: 3, chance: derived.fireChance },
  ].filter(option => option.chance > 0);
  const rawTotal = options.reduce((total, option) => total + option.chance, 0);
  const totalChance = Math.min(0.6, rawTotal);
  if (!options.length) return null;
  if (safeRandom(random) >= totalChance) return null;
  const scale = rawTotal > totalChance ? totalChance / rawTotal : 1;
  let roll = safeRandom(random) * totalChance;
  for (const option of options) {
    const weight = option.chance * scale;
    if (roll < weight) return { statusId: option.statusId, powerMultiplier: option.powerMultiplier, durationSeconds: option.durationSeconds };
    roll -= weight;
  }
  const final = options[options.length - 1];
  return final ? { statusId: final.statusId, powerMultiplier: final.powerMultiplier, durationSeconds: final.durationSeconds } : null;
}

function safeRandom(random: () => number): number {
  try {
    const value = random();
    return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0;
  } catch { return 0; }
}
