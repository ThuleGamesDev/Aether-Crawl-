import { afterEach, describe, expect, it, vi } from 'vitest';
import { XP_THRESHOLD } from '../services/gameLogic';
import { createBoss, generateLoot, hasSaveGame, loadGame, saveGame } from '../services/gameLogic';
import { getBiomeIdForLevel } from '../data/assetRegistry';
import { SaveData } from '../types';

const makeSave = (): SaveData => ({
  player: { pos: { x: 1, y: 1 }, dir: 'E', party: [], inventory: [], scrap: 0 },
  map: [[0]],
  decorations: [[0]],
  explored: [[true]],
  clearedTiles: [],
  dungeonLevel: 1,
  logs: [],
  date: 1,
});

describe('game progression data', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the existing XP thresholds', () => {
    expect(XP_THRESHOLD(1)).toBe(50);
    expect(XP_THRESHOLD(4)).toBe(200);
  });

  it('selects the established biome boss for each five-level milestone', () => {
    expect(createBoss(5, true)).toMatchObject({ name: 'The Necromancer', visualId: 'the_necromancer', isBoss: true });
    expect(createBoss(15, true)).toMatchObject({ name: 'Lich Lord', visualId: 'lich_lord' });
    expect(createBoss(30, true)).toMatchObject({ name: 'Obsidian Lord', visualId: 'obsidian_lord' });
  });

  it('keeps the biome order aligned with the existing boss progression', () => {
    expect([1, 6, 11, 16, 21, 26].map(getBiomeIdForLevel)).toEqual([
      'dungeon', 'moss', 'catacombs', 'frost', 'gilded', 'obsidian',
    ]);
  });

  it('keeps loot local and assigns a stable weapon visual type', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.8);
    const loot = generateLoot(3, true);
    expect(loot).toMatchObject({ type: 'WEAPON', visualType: 'mace', value: 11 });
  });

  it('gives separate drops unique IDs even when generated in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.3).mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.3).mockReturnValueOnce(0.1);

    const first = generateLoot(3, true)!;
    const second = generateLoot(3, true)!;
    expect(first.id).not.toBe(second.id);
  });

  it('round-trips gameplay save data without storing image payloads or visual URLs', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const save = makeSave();
    save.player.inventory.push({
      id: 'axe', name: 'Battle Axe', type: 'WEAPON', value: 5, description: 'Heavy chopper.',
      icon: '🪓', visualType: 'axe', quantity: 1,
    });

    expect(saveGame(save)).toBe(true);
    const stored = JSON.parse(values.get('aether_crawl_save_v1')!);
    expect(stored.player.inventory[0]).not.toHaveProperty('visualType');
    expect(stored.player.inventory[0]).not.toHaveProperty('texture');
    expect(loadGame()?.player.inventory[0].visualType).toBe('axe');
  });

  it('does not offer Continue for malformed save data', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{' });
    expect(loadGame()).toBeNull();
    expect(hasSaveGame()).toBe(false);
  });

  it('reports a failed save when browser storage rejects the write', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota exceeded'); } });
    expect(saveGame(makeSave())).toBe(false);
  });
});
