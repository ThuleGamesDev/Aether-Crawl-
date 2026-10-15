import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Character, ClassType, Player, SaveData } from '../types';
import { CLASSES } from '../constants';
import { createEnemyById, loadGame, saveGame } from '../services/gameLogic';
import { CombatRuntime } from '../services/combatRuntime';
import { playerRecoveryMs } from '../data/combatTiming';
import { characterInitiative, equipmentInitiativePenalty, initiativeDuration, initiativeSpeed } from '../services/initiative';

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
  it('gives a starting Ranger earlier readiness than a Paladin regardless of party order', () => {
    const p = player();
    const a = new CombatRuntime(p, [createEnemyById('stone_golem')]);
    const b = new CombatRuntime(player([...p.party].reverse()), [createEnemyById('stone_golem')]);
    expect(a.actors.RANGER.remainingMs).toBeLessThan(a.actors.PALADIN.remainingMs);
    expect(a.actors.RANGER.remainingMs).toBe(b.actors.RANGER.remainingMs);
    expect(a.actors.PALADIN.remainingMs).toBe(b.actors.PALADIN.remainingMs);
    a.advance(a.actors.RANGER.remainingMs);
    expect(a.isReady('RANGER')).toBe(true); expect(a.isReady('PALADIN')).toBe(false);
  });

  it('uses the same opener for monsters and heroes, so a fast rat can prepare before a Ranger', () => {
    const rat = createEnemyById('giant_rat'), golem = createEnemyById('stone_golem');
    const rt = new CombatRuntime(player(), [golem, rat]);
    expect(rt.actors[rat.id].remainingMs).toBeLessThan(rt.actors.RANGER.remainingMs);
    expect(rt.actors.RANGER.remainingMs).toBeLessThan(rt.actors[golem.id].remainingMs);
    rt.advance(rt.actors[rat.id].remainingMs);
    expect(rt.actors[rat.id].casting).toBeDefined(); expect(rt.isReady('RANGER')).toBe(false);
  });

  it('applies initiative to recurring actions and authored skill recovery without double-scaling', () => {
    const ranger = hero('RANGER'), paladin = hero('PALADIN');
    expect(playerRecoveryMs(ranger, 'attack')).toBeLessThan(playerRecoveryMs(paladin, 'attack'));
    const rt = new CombatRuntime(player(), [createEnemyById('stone_golem')], () => 0.5);
    rt.advance(1700); rt.setPaused(true);
    rt.act({ actorId: ranger.id, type: 'attack', targetId: rt.enemies[0].id });
    expect(rt.actors.RANGER.recoveryMs).toBe(playerRecoveryMs(ranger, 'attack'));
    expect(playerRecoveryMs(ranger, 'skill', { ...ranger.skills[0], recoveryMs: 2000 }))
      .toBe(initiativeDuration(2000, characterInitiative(ranger)));
  });

  it('makes fast enemies act more often while retaining the full authored windup', () => {
    const p = player([hero('PALADIN')]); p.party[0].stats.hp = p.party[0].stats.maxHp = 100000;
    const make = (initiative: number) => ({ ...createEnemyById('giant_rat'), initiative, damage: 1, abilityIds: ['basic_attack'] });
    const fast = new CombatRuntime(p, [make(16)], () => 0.5);
    const slow = new CombatRuntime(p, [make(5)], () => 0.5);
    const fastActions = fast.advance(10000).logs.filter(l => l.includes(' uses ')).length;
    const slowActions = slow.advance(10000).logs.filter(l => l.includes(' uses ')).length;
    expect(fastActions).toBeGreaterThan(slowActions);
    for (const initiative of [5, 16]) {
      const enemy = { ...make(initiative), intent: { abilityId: 'basic_attack', type: 'HEAVY_ATTACK' as const, label: 'Heavy', shortLabel: 'Heavy', icon: '', castTimeMs: 1800, interruptible: true } };
      const rt = new CombatRuntime(p, [enemy]); rt.advance(rt.actors[enemy.id].remainingMs);
      expect(rt.actors[enemy.id].casting?.totalMs).toBe(1800);
    }
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

  it('bounds extreme initiative values and preserves intentional long action delays', () => {
    expect(initiativeSpeed(1)).toBe(0.7); expect(initiativeSpeed(30)).toBe(1.5);
    expect(initiativeDuration(2000, 30)).toBeGreaterThan(initiativeDuration(1000, 30));
    expect(initiativeDuration(NaN, 10)).toBe(1000);
    const invalid = hero('RANGER'); invalid.stats.initiative = NaN;
    expect(characterInitiative(invalid)).toBe(13);
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
