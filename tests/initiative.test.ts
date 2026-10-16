import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character, ClassType, Player, SaveData } from '../types';
import { CLASSES } from '../constants';
import { createEnemyById, loadGame, saveGame } from '../services/gameLogic';
import { CombatRuntime } from '../services/combatRuntime';
import { characterInitiative, equipmentInitiativePenalty } from '../services/initiative';

function hero(classType: ClassType): Character {
  const template = CLASSES[classType];
  return { id: classType, name: template.name, classType, stats: { ...template.stats },
    equipment: { weapon: template.startItems.find(i => i.type === 'WEAPON') ?? null,
      offhand: template.startItems.find(i => i.type === 'SHIELD') ?? null, armor: null, accessory: null },
    skills: template.startSkills, statusEffects: [], isDefending: false };
}
const player = (party = [hero('PALADIN'), hero('RANGER')]): Player => ({ pos: { x: 1, y: 1 }, dir: 'E', party, inventory: [], scrap: 0 });
afterEach(() => { vi.unstubAllGlobals(); });

describe('initiative and equipment load', () => {
  it('orders a Ranger ahead of a shield-bearing Paladin independently of party order', () => {
    const p = player(), enemy = createEnemyById('stone_golem');
    const a = new CombatRuntime(p, [enemy]), b = new CombatRuntime(player([...p.party].reverse()), [enemy]);
    expect(a.order).toEqual(['RANGER', 'PALADIN', enemy.id]); expect(a.order).toEqual(b.order);
    expect(a.isReady('RANGER')).toBe(true); expect(a.isReady('PALADIN')).toBe(false);
  });
  it('lets a fast rat precede heroes and heavy armor move a hero later', () => {
    const p = player(), rat = createEnemyById('giant_rat');
    p.party[1].equipment.armor = { id: 'heavy', name: '', description: '', type: 'ARMOR', armorWeight: 'HEAVY', value: 4, quantity: 1 };
    const rt = new CombatRuntime(p, [rat]); expect(rt.order).toEqual([rat.id, 'RANGER', 'PALADIN']); expect(rt.actors.RANGER.initiative).toBe(9);
  });

  it('derives armor and shield load without mutating base initiative or scaling it with item tier', () => {
    const ranger = hero('RANGER'); const base = characterInitiative(ranger);
    const armor = { id: 'armor', name: 'Armor', description: '', type: 'ARMOR' as const, quantity: 1, value: 999 };
    ranger.equipment.armor = { ...armor, armorWeight: 'HEAVY' };
    expect(characterInitiative(ranger)).toBe(base - 4); expect(ranger.stats.initiative).toBe(13);
    ranger.equipment.armor = { ...armor, armorWeight: 'LIGHT' };
    expect(characterInitiative(ranger)).toBe(base - 1);
    expect(equipmentInitiativePenalty(armor)).toBe(2);
    ranger.equipment.armor = null; expect(characterInitiative(ranger)).toBe(base);
  });

  it('uses a class fallback for invalid initiative and never drops below one under load', () => {
    const ranger = hero('RANGER'); ranger.stats.initiative = NaN;
    expect(characterInitiative(ranger)).toBe(13);
    ranger.stats.initiative = 1; ranger.equipment.armor = { id: 'heavy', name: '', description: '', type: 'ARMOR', armorWeight: 'HEAVY', value: 4, quantity: 1 };
    expect(characterInitiative(ranger)).toBe(1);
  });

  it('migrates legacy saves and round-trips base initiative and armor weight without cumulative penalties', () => {
    const legacy: SaveData = { player: player(), map: [[0]], decorations: [[0]], explored: [[true]], clearedTiles: [], dungeonLevel: 1, logs: [], date: 1 };
    legacy.player.party.forEach(c => { delete c.stats.initiative; });
    const storage = new Map([['aether_crawl_save_v1', JSON.stringify(legacy)]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
    const restored = loadGame()!; expect(restored.player.party.map(c => c.stats.initiative)).toEqual([8, 13]);
    restored.player.party[1].equipment.armor = { id: 'heavy', name: 'Heavy', description: '', type: 'ARMOR', armorWeight: 'HEAVY', value: 6, quantity: 1 };
    expect(saveGame(restored)).toBe(true); const again = loadGame()!;
    expect(again.player.party[1].stats.initiative).toBe(13); expect(characterInitiative(again.player.party[1])).toBe(9);
    saveGame(again); expect(characterInitiative(loadGame()!.player.party[1])).toBe(9);
  });
});
