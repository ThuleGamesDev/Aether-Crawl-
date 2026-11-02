import { getUniqueItem } from '../data/uniqueItems';
import type { ItemAffixStat, PlayerCharacter, UniqueEffectId, UniqueEffectState } from '../types';

export type UniqueTrigger = 'DODGE_SUCCESS' | 'BLOCK_SUCCESS' | 'POISON_APPLIED' | 'BURN_APPLIED'
  | 'SOUL_SKILL_CAST' | 'PROJECTILE_HIT' | 'HEAVY_MELEE_HIT' | 'SELF_HEAL';

export interface UniqueTriggerResult {
  player: PlayerCharacter;
  activated: boolean;
  magnitude: number;
}

const EXPECTED_TRIGGER: Readonly<Record<UniqueEffectId, UniqueTrigger>> = {
  ariadnes_thread: 'DODGE_SUCCESS',
  aspis_bronze_gate: 'BLOCK_SUCCESS',
  serpent_queen_fang: 'POISON_APPLIED',
  promethean_ember: 'BURN_APPLIED',
  stygian_seal: 'SOUL_SKILL_CAST',
  artemis_mark: 'PROJECTILE_HIT',
  cyclopean_mallet: 'HEAVY_MELEE_HIT',
  laurel_asclepius: 'SELF_HEAL',
};

/** Pure trigger resolution; callers apply returned magnitudes through existing combat/status systems. */
export function resolveUniqueTrigger(
  player: PlayerCharacter,
  effectId: UniqueEffectId,
  trigger: UniqueTrigger,
  sourceMagnitude = 0,
): UniqueTriggerResult {
  const definition = getUniqueItem(effectId);
  if (!definition || EXPECTED_TRIGGER[effectId] !== trigger || !isUniqueEquipped(player, effectId)) {
    return { player, activated: false, magnitude: 0 };
  }
  if (definition.requiredClass && player.classId !== definition.requiredClass) return { player, activated: false, magnitude: 0 };
  const state = player.uniqueEffectStates?.find(candidate => candidate.effectId === effectId);
  if ((state?.cooldownRemaining ?? 0) > 0) return { player, activated: false, magnitude: 0 };

  let cooldown = 0;
  let duration = 0;
  let charges = 0;
  let magnitude = 0;
  switch (effectId) {
    case 'ariadnes_thread': cooldown = 8; duration = 2.25; magnitude = 1.25; break;
    case 'aspis_bronze_gate': cooldown = 4; magnitude = Math.max(1, Math.min(12, Math.round(Math.max(0, sourceMagnitude) * 0.35))); break;
    case 'serpent_queen_fang': cooldown = 5; magnitude = 1.35; break;
    case 'promethean_ember': cooldown = 8; duration = 8; charges = 1; magnitude = 1.25; break;
    case 'stygian_seal': cooldown = 10; duration = 2.5; magnitude = 0.2; break;
    case 'artemis_mark': cooldown = 3; duration = 6; charges = 1; magnitude = 1.2; break;
    case 'cyclopean_mallet': cooldown = 10; magnitude = 0.45; break;
    case 'laurel_asclepius': cooldown = 12; duration = 3; magnitude = 0.25; break;
  }
  const nextState: UniqueEffectState = { effectId, cooldownRemaining: cooldown, durationRemaining: duration, charges };
  return {
    player: { ...player, uniqueEffectStates: [...(player.uniqueEffectStates ?? []).filter(candidate => candidate.effectId !== effectId), nextState] },
    activated: true,
    magnitude,
  };
}

export function tickUniqueEffects(player: PlayerCharacter, deltaSeconds: number): PlayerCharacter {
  const dt = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(0.05, deltaSeconds)) : 0;
  const states = (player.uniqueEffectStates ?? []).map(state => {
    const durationRemaining = remaining(state.durationRemaining, dt);
    return {
      ...state,
      cooldownRemaining: remaining(state.cooldownRemaining, dt),
      durationRemaining,
      charges: durationRemaining > 0 ? state.charges : 0,
    };
  }).filter(state => state.cooldownRemaining > 0 || state.durationRemaining > 0 || state.charges > 0);
  return states.length === (player.uniqueEffectStates ?? []).length && states.every((state, index) => state === player.uniqueEffectStates![index])
    ? player
    : { ...player, uniqueEffectStates: states };
}

function remaining(current: number, delta: number): number {
  const next = Math.max(0, current - delta);
  return next <= 0.000001 ? 0 : next;
}

export function consumeUniqueCharge(player: PlayerCharacter, effectId: UniqueEffectId): { player: PlayerCharacter; consumed: boolean } {
  if (!isUniqueEquipped(player, effectId)) return { player, consumed: false };
  const states = player.uniqueEffectStates ?? [];
  const index = states.findIndex(state => state.effectId === effectId && state.durationRemaining > 0 && state.charges > 0);
  if (index < 0) return { player, consumed: false };
  const next = [...states];
  next[index] = { ...next[index], charges: next[index].charges - 1 };
  return { player: { ...player, uniqueEffectStates: next }, consumed: true };
}

export function uniqueEffectRemaining(player: PlayerCharacter, effectId: UniqueEffectId): number {
  if (!isUniqueEquipped(player, effectId)) return 0;
  return Math.max(0, player.uniqueEffectStates?.find(state => state.effectId === effectId)?.durationRemaining ?? 0);
}

export function getUniqueStatBonuses(player: PlayerCharacter): Partial<Record<ItemAffixStat, number>> {
  const result: Partial<Record<ItemAffixStat, number>> = {};
  for (const item of Object.values(player.equipment)) {
    if (item?.rarity !== 'UNIQUE' || !item.uniqueEffectId) continue;
    const definition = getUniqueItem(item.uniqueEffectId);
    if (!definition || item.baseId !== definition.baseId || definition.requiredClass && player.classId !== definition.requiredClass) continue;
    for (const [stat, amount] of Object.entries(definition.statBonuses) as Array<[ItemAffixStat, number]>) {
      result[stat] = (result[stat] ?? 0) + amount;
    }
  }
  if (uniqueEffectRemaining(player, 'ariadnes_thread') > 0) {
    result.movementSpeedPercent = (result.movementSpeedPercent ?? 0) + 25;
  }
  return result;
}

export function isUniqueEquipped(player: PlayerCharacter, effectId: UniqueEffectId): boolean {
  const definition = getUniqueItem(effectId);
  return Boolean(definition && Object.values(player.equipment).some(item => item?.rarity === 'UNIQUE'
    && item.uniqueEffectId === effectId && item.baseId === definition.baseId));
}
