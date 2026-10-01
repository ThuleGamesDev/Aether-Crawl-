import type { Character, Enemy, Skill, StatusEffect, StatusType } from '../types';

export interface AttackResolution {
  damage: number;
  critical: boolean;
}

export interface StatusTurnResolution {
  hp: number;
  statusEffects: StatusEffect[];
  ticks: Array<{ type: Extract<StatusType, 'POISON' | 'BURN' | 'REGEN'>; value: number }>;
  defeated: boolean;
}

const statusIcons: Record<StatusType, string> = {
  POISON: '🤢', BURN: '🔥', REGEN: '💖', SHIELD: '🛡️', STRENGTH: '💪', WEAKNESS: '😓', STUN: '💫',
};

let statusSequence = 0;

export const createStatusEffect = (type: StatusType, duration: number, value: number): StatusEffect => ({
  id: `combat_status_${++statusSequence}`,
  type,
  name: type,
  duration,
  value,
  icon: statusIcons[type],
});

/** Refreshes an existing effect instead of letting identical effects stack without limit. */
export const upsertStatusEffect = (effects: StatusEffect[] = [], effect: StatusEffect): StatusEffect[] => {
  const existingIndex = effects.findIndex(current => current.type === effect.type);
  if (existingIndex === -1) return [...effects, effect];
  const matches = effects.filter(current => current.type === effect.type);
  const refreshed = {
    ...effects[existingIndex],
    duration: Math.max(effect.duration, ...matches.map(current => current.duration)),
    value: Math.max(effect.value, ...matches.map(current => current.value)),
  };
  return effects.flatMap((current, index) => index === existingIndex ? [refreshed] : current.type === effect.type ? [] : [current]);
};

export const resolveStatusTurn = (
  hp: number,
  maxHp: number,
  statusEffects: StatusEffect[] = [],
): StatusTurnResolution => {
  let hpChange = 0;
  const nextEffects: StatusEffect[] = [];
  const ticks: StatusTurnResolution['ticks'] = [];

  for (const effect of statusEffects) {
    if (effect.type === 'POISON') { hpChange -= effect.value; ticks.push({ type: effect.type, value: effect.value }); }
    if (effect.type === 'BURN') { hpChange -= effect.value; ticks.push({ type: effect.type, value: effect.value }); }
    if (effect.type === 'REGEN') { hpChange += effect.value; ticks.push({ type: effect.type, value: effect.value }); }
    if (effect.duration > 1) nextEffects.push({ ...effect, duration: effect.duration - 1 });
  }

  const nextHp = Math.min(maxHp, Math.max(0, hp + hpChange));
  return { hp: nextHp, statusEffects: nextEffects, ticks, defeated: nextHp <= 0 };
};

export const calculatePlayerAttack = (character: Character, random: () => number = Math.random): AttackResolution => {
  let damage = character.stats.str + (character.equipment.weapon?.value ?? 0);
  const strength = character.statusEffects.find(effect => effect.type === 'STRENGTH');
  if (strength) damage += strength.value;
  const weakness = character.statusEffects.find(effect => effect.type === 'WEAKNESS');
  if (weakness) damage = Math.max(1, damage - weakness.value);

  damage = Math.floor(damage * (0.9 + random() * 0.2));
  const critical = random() < character.stats.dex * 0.02;
  if (critical) damage = Math.floor(damage * 1.5);
  return { damage, critical };
};

export const calculateEnemyAttack = (enemy: Enemy, target: Character, multiplier = 1): number => {
  let damage = Math.max(1, Math.floor(enemy.damage * multiplier) - Math.floor(target.stats.dex / 4));
  const strength = enemy.statusEffects?.find(effect => effect.type === 'STRENGTH');
  if (strength) damage += strength.value;
  const weakness = enemy.statusEffects?.find(effect => effect.type === 'WEAKNESS');
  if (weakness) damage = Math.max(1, damage - weakness.value);

  if (target.isDefending) damage = Math.floor(damage / 2);
  if (target.equipment.armor) damage -= target.equipment.armor.value;
  if (target.equipment.offhand?.type === 'SHIELD') damage -= target.equipment.offhand.value;
  return Math.max(1, damage);
};

export const calculateSkillPower = (character: Character, skill: Skill): number => {
  let stat = character.stats.int;
  if (skill.scalingStat === 'STR') stat = character.stats.str;
  if (skill.scalingStat === 'DEX') stat = character.stats.dex;
  return skill.basePower + Math.floor(stat * skill.scaling);
};

export const damageEnemies = (enemies: Enemy[], targetId: string, damage: number, multiTarget = false): Enemy[] =>
  enemies.map(enemy => {
    if (!(multiTarget || enemy.id === targetId) || enemy.hp <= 0) return enemy;
    const absorbed = Math.min(enemy.guard ?? 0, damage);
    return {
      ...enemy,
      guard: Math.max(0, (enemy.guard ?? 0) - absorbed),
      hp: Math.max(0, enemy.hp - Math.max(0, damage - absorbed)),
    };
  });

export const estimateEnemyDamageRange = (enemy: Enemy, multiplier = 1): { minDamage: number; maxDamage: number } => {
  const strength = enemy.statusEffects?.find(effect => effect.type === 'STRENGTH')?.value ?? 0;
  const weakness = enemy.statusEffects?.find(effect => effect.type === 'WEAKNESS')?.value ?? 0;
  const raw = Math.max(1, Math.floor(enemy.damage * multiplier) + strength - weakness);
  return { minDamage: Math.max(1, Math.floor(raw * 0.9)), maxDamage: Math.max(1, Math.ceil(raw * 1.1)) };
};
