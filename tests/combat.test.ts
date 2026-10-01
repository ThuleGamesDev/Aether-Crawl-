import { describe, expect, it } from 'vitest';
import { calculateEnemyAttack, calculatePlayerAttack, calculateSkillPower, damageEnemies } from '../services/combat';
import { Character, Enemy, Skill } from '../types';

const character = {
  name: 'Vanguard',
  stats: { str: 10, dex: 8, int: 4, hp: 40, maxHp: 40, mp: 10, maxMp: 10, level: 1, xp: 0 },
  equipment: {
    weapon: { id: 'blade', name: 'Blade', type: 'WEAPON', value: 5 },
    armor: { id: 'armor', name: 'Armor', type: 'ARMOR', value: 2 },
    offhand: { id: 'shield', name: 'Shield', type: 'SHIELD', value: 1 },
    accessory: null,
  },
  statusEffects: [
    { id: 'str', type: 'STRENGTH', name: 'Strength', value: 2, duration: 2, icon: '+' },
    { id: 'weak', type: 'WEAKNESS', name: 'Weakness', value: 3, duration: 2, icon: '-' },
  ],
  isDefending: true,
} as Character;

describe('combat calculations', () => {
  it('calculates the player attack, status modifiers, variance, and critical hit', () => {
    const rolls = [0.5, 0];
    expect(calculatePlayerAttack(character, () => rolls.shift() ?? 0)).toEqual({ damage: 21, critical: true });
  });

  it('applies enemy buffs, player defense, armor, and shields', () => {
    const enemy = {
      id: 'enemy', name: 'Raider', hp: 50, maxHp: 50, damage: 20, xpReward: 5,
      visualId: 'raider', isBoss: false,
      statusEffects: [
        { id: 'str', type: 'STRENGTH', name: 'Strength', value: 2, duration: 2, icon: '+' },
        { id: 'weak', type: 'WEAKNESS', name: 'Weakness', value: 3, duration: 2, icon: '-' },
      ],
    } as Enemy;
    expect(calculateEnemyAttack(enemy, character)).toBe(5);
  });

  it('uses the selected stat for skill scaling and supports multi-target damage', () => {
    const skill = { id: 'arcane', name: 'Arcane Bolt', basePower: 6, scaling: 1.5, scalingStat: 'INT' } as Skill;
    expect(calculateSkillPower(character, skill)).toBe(12);
    const enemies = [
      { id: 'one', hp: 20, maxHp: 20 },
      { id: 'two', hp: 5, maxHp: 5 },
    ] as Enemy[];
    expect(damageEnemies(enemies, 'one', 8, true).map(enemy => enemy.hp)).toEqual([12, 0]);
  });
});
