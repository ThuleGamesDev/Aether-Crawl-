import { describe, expect, it } from 'vitest';
import { calculateEnemyAttack, calculatePlayerAttack, calculateSkillPower, createStatusEffect, damageEnemies, resolveStatusTurn, upsertStatusEffect } from '../services/combat';
import { Character, Enemy, Skill, StatusEffect } from '../types';

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

  it('absorbs player damage with temporary enemy guard before reducing HP', () => {
    const guarded = { id: 'guarded', hp: 20, maxHp: 20, guard: 8 } as Enemy;
    expect(damageEnemies([guarded], 'guarded', 6)[0]).toMatchObject({ hp: 20, guard: 2 });
    expect(damageEnemies([guarded], 'guarded', 11)[0]).toMatchObject({ hp: 17, guard: 0 });
  });

  it('refreshes the strongest existing status and removes duplicate copies', () => {
    const first: StatusEffect = { id: 'weak-a', type: 'WEAKNESS', name: 'Weakness', value: 2, duration: 2, icon: '-' };
    const duplicate: StatusEffect = { ...first, id: 'weak-b', value: 4, duration: 1 };
    expect(upsertStatusEffect([first, duplicate], createStatusEffect('WEAKNESS', 3, 3))).toEqual([
      { ...first, value: 4, duration: 3 },
    ]);
  });

  it('applies turn-start damage and healing, clamps health, and expires effects', () => {
    const effects: StatusEffect[] = [
      { id: 'poison', type: 'POISON', name: 'Poison', value: 4, duration: 1, icon: '!' },
      { id: 'burn', type: 'BURN', name: 'Burn', value: 10, duration: 3, icon: '!' },
      { id: 'regen', type: 'REGEN', name: 'Regen', value: 5, duration: 2, icon: '+' },
      { id: 'stun', type: 'STUN', name: 'Stun', value: 0, duration: 1, icon: '*' },
    ];

    expect(resolveStatusTurn(15, 20, effects)).toEqual({
      hp: 6,
      statusEffects: [
        { ...effects[1], duration: 2 },
        { ...effects[2], duration: 1 },
      ],
      ticks: [
        { type: 'POISON', value: 4 },
        { type: 'BURN', value: 10 },
        { type: 'REGEN', value: 5 },
      ],
      defeated: false,
    });

    expect(resolveStatusTurn(18, 20, [{ ...effects[2], duration: 1 }]).hp).toBe(20);
  });

  it('marks an enemy defeated when a turn-start status tick reduces its health to zero', () => {
    expect(resolveStatusTurn(3, 20, [
      { id: 'poison', type: 'POISON', name: 'Poison', value: 4, duration: 1, icon: '!' },
    ])).toMatchObject({ hp: 0, defeated: true, statusEffects: [] });
  });
});
