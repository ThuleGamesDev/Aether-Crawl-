import type { Character, Enemy, Skill } from '../types';

export interface AttackResolution {
  damage: number;
  critical: boolean;
}

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

export const calculateEnemyAttack = (enemy: Enemy, target: Character): number => {
  let damage = Math.max(1, enemy.damage - Math.floor(target.stats.dex / 4));
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
  enemies.map(enemy => multiTarget || enemy.id === targetId
    ? { ...enemy, hp: Math.max(0, enemy.hp - damage) }
    : enemy);
