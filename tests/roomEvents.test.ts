import { describe, it, expect } from 'vitest';
import {
  ROOM_EVENT_DEFINITIONS,
  calculateEnvironmentalDC,
  getCharacterEventModifiers,
  resolveCharacterCheck,
  createRoomEvent,
  applyRoomEventToParty,
  shouldTriggerRoomEvent,
} from '../services/roomEvents';
import { Character, ClassType, StatusEffect } from '../types';
import { createStatusEffect } from '../services/combat';

const mockCharacter = (overrides?: Partial<Character>): Character => ({
  id: 'c1',
  name: 'Valerius',
  classType: 'PALADIN',
  stats: {
    hp: 40,
    maxHp: 40,
    mp: 20,
    maxMp: 20,
    str: 16,
    dex: 12,
    int: 14,
    xp: 0,
    level: 1,
  },
  equipment: {
    weapon: null,
    armor: null,
    offhand: null,
    accessory: null,
  },
  skills: [],
  statusEffects: [],
  isDefending: false,
  ...overrides,
});

describe('roomEvents service', () => {
  it('scales environmental difficulty class with dungeon level', () => {
    expect(calculateEnvironmentalDC(1)).toBe(10);
    expect(calculateEnvironmentalDC(4)).toBe(13);
    expect(calculateEnvironmentalDC(8)).toBe(16);
  });

  describe('status effect modifiers', () => {
    it('applies shield modifiers for traps, collapse, mist, and arcane surges', () => {
      const char = mockCharacter({
        statusEffects: [createStatusEffect('SHIELD', 3, 10)],
      });

      const trapMods = getCharacterEventModifiers(char, 'TRAP');
      expect(trapMods.some(m => m.label.includes('Shield Ward') && m.value === 3)).toBe(true);

      const mistMods = getCharacterEventModifiers(char, 'MIST');
      expect(mistMods.some(m => m.label.includes('Aegis Barrier') && m.value === 2)).toBe(true);
    });

    it('applies weakness penalties to physical and mental checks', () => {
      const char = mockCharacter({
        statusEffects: [createStatusEffect('WEAKNESS', 2, 2)],
      });

      const trapMods = getCharacterEventModifiers(char, 'TRAP');
      expect(trapMods.some(m => m.value === -3)).toBe(true);

      const mistMods = getCharacterEventModifiers(char, 'MIST');
      expect(mistMods.some(m => m.value === -2)).toBe(true);
    });

    it('applies poison penalty to toxic spore checks and trap checks', () => {
      const char = mockCharacter({
        statusEffects: [createStatusEffect('POISON', 3, 2)],
      });

      const sporeMods = getCharacterEventModifiers(char, 'SPORES');
      expect(sporeMods.some(m => m.value === -4)).toBe(true);

      const trapMods = getCharacterEventModifiers(char, 'TRAP');
      expect(trapMods.some(m => m.value === -2)).toBe(true);
    });

    it('applies inner flame bonus against frost checks', () => {
      const char = mockCharacter({
        statusEffects: [createStatusEffect('BURN', 2, 2)],
      });

      const frostMods = getCharacterEventModifiers(char, 'FROST');
      expect(frostMods.some(m => m.value === 4)).toBe(true);
    });

    it('penalizes characters with depleted mana during mana mist events', () => {
      const char = mockCharacter({
        stats: { ...mockCharacter().stats, mp: 0 },
      });

      const mistMods = getCharacterEventModifiers(char, 'MIST');
      expect(mistMods.some(m => m.value === -3)).toBe(true);
    });
  });

  describe('resolveCharacterCheck', () => {
    const trapEvent = ROOM_EVENT_DEFINITIONS.find(e => e.id === 'trap_corridor')!;
    const mistEvent = ROOM_EVENT_DEFINITIONS.find(e => e.id === 'mana_mist')!;
    const sporeEvent = ROOM_EVENT_DEFINITIONS.find(e => e.id === 'toxic_spores')!;

    it('resolves trap corridor successfully on high roll', () => {
      const char = mockCharacter({ stats: { ...mockCharacter().stats, dex: 15 } });
      const result = resolveCharacterCheck(char, trapEvent, 1, 18);

      expect(result.success).toBe(true);
      expect(result.hpChange).toBe(0);
      expect(result.mpChange).toBe(0);
    });

    it('deals physical damage on trap failure and halves damage if protected', () => {
      const unprotected = mockCharacter({ stats: { ...mockCharacter().stats, dex: 8 } });
      const failUnprotected = resolveCharacterCheck(unprotected, trapEvent, 1, 2);
      expect(failUnprotected.success).toBe(false);
      expect(failUnprotected.hpChange).toBeLessThan(0);

      const protectedChar = mockCharacter({
        stats: { ...mockCharacter().stats, dex: 8 },
        statusEffects: [createStatusEffect('SHIELD', 3, 10)],
      });
      const failProtected = resolveCharacterCheck(protectedChar, trapEvent, 1, 2);
      expect(Math.abs(failProtected.hpChange)).toBeLessThan(Math.abs(failUnprotected.hpChange));
    });

    it('drains mana on mist failure and inflicts weakness/vitality damage when out of MP', () => {
      const depletedChar = mockCharacter({
        stats: { ...mockCharacter().stats, mp: 0, int: 8 },
      });
      const result = resolveCharacterCheck(depletedChar, mistEvent, 1, 2);

      expect(result.success).toBe(false);
      expect(result.hpChange).toBeLessThan(0);
      expect(result.statusApplied).toBe('WEAKNESS');
    });

    it('inflicts poison status on toxic spores failure', () => {
      const char = mockCharacter({ stats: { ...mockCharacter().stats, str: 8 } });
      const result = resolveCharacterCheck(char, sporeEvent, 1, 2);

      expect(result.success).toBe(false);
      expect(result.hpChange).toBeLessThan(0);
      expect(result.statusApplied).toBe('POISON');
    });
  });

  describe('createRoomEvent and applyRoomEventToParty', () => {
    it('creates active room event and resolves for all living party members', () => {
      const p1 = mockCharacter({ id: 'p1', name: 'Warrior', stats: { ...mockCharacter().stats, hp: 30 } });
      const p2 = mockCharacter({ id: 'p2', name: 'Mage', stats: { ...mockCharacter().stats, hp: 0 } }); // Dead
      const p3 = mockCharacter({ id: 'p3', name: 'Rogue', stats: { ...mockCharacter().stats, hp: 25 } });

      const event = createRoomEvent([p1, p2, p3], 2, 'trap_corridor');
      expect(event.results.length).toBe(2);
      expect(event.results.map(r => r.characterId)).toEqual(['p1', 'p3']);
    });

    it('applies damage and status effects to party members', () => {
      const p1 = mockCharacter({ id: 'p1', stats: { ...mockCharacter().stats, hp: 30, maxHp: 30 } });
      const results = [
        {
          characterId: 'p1',
          characterName: 'Valerius',
          classType: 'PALADIN' as ClassType,
          baseStat: 'STR' as const,
          statValue: 16,
          statBonus: 5,
          modifiers: [],
          roll: 3,
          totalScore: 8,
          difficultyClass: 11,
          success: false,
          criticalSuccess: false,
          criticalFailure: false,
          hpChange: -10,
          mpChange: 0,
          statusApplied: 'POISON' as const,
          statusDuration: 3,
          logSummary: 'Took poison damage',
        },
      ];

      const updated = applyRoomEventToParty([p1], results);
      expect(updated[0].stats.hp).toBe(20);
      expect(updated[0].statusEffects.some(s => s.type === 'POISON')).toBe(true);
    });
  });

  describe('shouldTriggerRoomEvent', () => {
    it('does not trigger below step cooldown', () => {
      expect(shouldTriggerRoomEvent(5, false, false, false, 0.01)).toBe(false);
      expect(shouldTriggerRoomEvent(8, false, false, false, 0.01)).toBe(false);
    });

    it('does not trigger if combat was triggered or on exit tile', () => {
      expect(shouldTriggerRoomEvent(20, true, false, false, 0.01)).toBe(false);
      expect(shouldTriggerRoomEvent(20, false, true, false, 0.01)).toBe(false);
    });

    it('triggers reliably once step threshold is high', () => {
      expect(shouldTriggerRoomEvent(24, false, false, false, 0.99)).toBe(true);
      expect(shouldTriggerRoomEvent(15, false, false, false, 0.05)).toBe(true);
    });
  });
});
