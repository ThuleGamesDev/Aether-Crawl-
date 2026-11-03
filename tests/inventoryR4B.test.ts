import { describe, expect, it } from 'vitest';
import { createPlayerCharacter, createItemInstance, equipItem, splitInventoryStack, addInventoryItem, removeInventoryUnit } from '../player/PlayerProgression';
import { compareDerivedStats, calculateDerivedStats } from '../player/DerivedStats';
import { INVENTORY_GRID_HEIGHT, INVENTORY_GRID_WIDTH, itemFootprint, moveInventoryGridItem, normalizeInventoryGrid, validateInventoryGrid } from '../services/inventoryGrid';
import { getItemBase } from '../data/itemBases';
import { createUniqueInstance } from '../services/uniqueItems';
import { getItemEquipmentSlots } from '../services/equipmentRules';
import { resolveUniqueTrigger, tickUniqueEffects, consumeUniqueCharge, getUniqueStatBonuses } from '../player/UniqueEffects';
import { UNIQUE_ITEMS } from '../data/uniqueItems';
import { createEnemyDrop, validateItemInstance } from '../services/itemization';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import { TileType, type ItemInstance, type PlayerCharacter, type WorldEnemy } from '../types';
import type { KeyValueStorage } from '../services/fpsSave';
import type { InputFrame } from '../engine/InputSystem';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function potion(id: string, itemLevel = 1, quantity = 1, rarity: ItemInstance['rarity'] = 'COMMON'): ItemInstance {
  const base = getItemBase('healing_draught')!;
  return createItemInstance({ ...base, quantity }, id, itemLevel, rarity);
}

function weapon(baseId: string, id: string, quantity = 1): ItemInstance {
  return createItemInstance({ ...getItemBase(baseId)!, quantity }, id);
}

function withUnique(effectId: string, classId: PlayerCharacter['classId'] = 'BARBARIAN'): PlayerCharacter {
  const player = createPlayerCharacter(classId);
  const item = createUniqueInstance(effectId, 'equipped_' + effectId, 1);
  const slot = getItemEquipmentSlots(item)[0];
  if (!slot) throw new Error('Unique fixture has no compatible slot.');
  return { ...player, equipment: { ...player.equipment, [slot]: item } };
}

function enemy(overrides: Partial<WorldEnemy> = {}): WorldEnemy {
  return {
    id: 'r4b_elite', definitionId: 'giant_rat', name: 'Giant Rat', visualId: 'giant_rat', position: { x: 4, y: 0, z: 4 },
    health: 20, maxHealth: 20, damage: 5, xpReward: 8, state: 'DEAD', stateTimer: 0, attackCooldown: 0,
    attackRange: 1, attackTelegraphSeconds: 0.5, rewardGranted: false, isBoss: false, lootTier: 'ELITE', ...overrides,
  };
}

function inputFrame(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
    primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
    skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
    inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
  };
}

describe('FPS-R4B inventory grid and transactions', () => {
  it('validates footprints, bounds, overlap and preserves failed move/swap state atomically', () => {
    const axe = weapon('labrys', 'grid_axe');
    const shield = weapon('aspis', 'grid_shield');
    const fit = [{ instanceId: axe.instanceId, x: 0, y: 0 }, { instanceId: shield.instanceId, x: 2, y: 0 }];
    expect(itemFootprint(axe)).toEqual({ width: 2, height: 3 });
    expect(validateInventoryGrid([axe, shield], fit)).toBe(true);
    expect(validateInventoryGrid([axe], [{ instanceId: axe.instanceId, x: 9, y: 0 }])).toBe(false);
    expect(validateInventoryGrid([axe, shield], [{ instanceId: axe.instanceId, x: 0, y: 0 }, { instanceId: shield.instanceId, x: 1, y: 1 }])).toBe(false);

    const first = potion('cell_first');
    const second = potion('cell_second', 2);
    const start = [{ instanceId: first.instanceId, x: 0, y: 0 }, { instanceId: second.instanceId, x: 1, y: 0 }];
    const swapped = moveInventoryGridItem([first, second], start, first.instanceId, 1, 0);
    expect(swapped).toMatchObject({ moved: true, swapped: true });
    expect(Object.fromEntries(swapped.placements.map(entry => [entry.instanceId, `${entry.x},${entry.y}`]))).toEqual({
      [first.instanceId]: '1,0', [second.instanceId]: '0,0',
    });
    const failed = moveInventoryGridItem([first, second], start, first.instanceId, INVENTORY_GRID_WIDTH, INVENTORY_GRID_HEIGHT);
    expect(failed.moved).toBe(false);
    expect(failed.placements).toEqual(start);
  });

  it('auto-stacks only matching consumables up to 20 and keeps equipment as separate instances', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const first = potion('stack_first', 1, 18);
    const added = addInventoryItem({ ...player, inventory: [first] }, potion('stack_second', 1, 5));
    expect(added.stored).toBe(true);
    expect(added.stacked).toBe(true);
    expect(added.player.inventory.map(item => item.quantity)).toEqual([20, 3]);
    expect(added.player.inventory.map(item => item.instanceId)).toEqual(['stack_first', 'stack_second']);

    const separated = addInventoryItem(player, weapon('xiphos', 'sword_batch', 3));
    expect(separated.player.inventory).toHaveLength(3);
    expect(separated.player.inventory.every(item => item.quantity === 1)).toBe(true);
    expect(new Set(separated.player.inventory.map(item => item.instanceId)).size).toBe(3);
    expect(separated.player.inventory[0].instanceId).toBe('sword_batch');
    expect(separated.player.inventory[1].instanceId).toBe('sword_batch_stack_1');
  });

  it('splits, consumes and drops one unit without changing the remaining stack quantity', () => {
    const stack = potion('split_stack', 1, 7);
    const player = { ...createPlayerCharacter('BARBARIAN'), inventory: [stack] };
    const split = splitInventoryStack(player, stack.instanceId)!;
    expect(split.inventory.map(item => item.quantity).sort()).toEqual([3, 4]);
    expect(split.inventory.reduce((total, item) => total + item.quantity, 0)).toBe(7);
    const removed = removeInventoryUnit(split, stack.instanceId)!;
    expect(removed.item.quantity).toBe(1);
    expect(removed.player.inventory.find(item => item.instanceId === stack.instanceId)?.quantity).toBe(3);
    expect(splitInventoryStack(player, 'missing')).toBeNull();
  });

  it('keeps overflow recoverable and automatically fills newly opened cells', () => {
    const items = Array.from({ length: INVENTORY_GRID_WIDTH * INVENTORY_GRID_HEIGHT + 1 }, (_, index) => potion('full_bag_' + index, index + 1));
    const full = normalizeInventoryGrid(items);
    expect(full.placements).toHaveLength(INVENTORY_GRID_WIDTH * INVENTORY_GRID_HEIGHT);
    expect(full.overflowIds).toEqual(['full_bag_50']);
    const afterDrop = items.slice(1);
    const recovered = normalizeInventoryGrid(afterDrop, full.placements.filter(entry => entry.instanceId !== items[0].instanceId));
    expect(recovered.overflowIds).toEqual([]);
    expect(recovered.placements).toHaveLength(INVENTORY_GRID_WIDTH * INVENTORY_GRID_HEIGHT);
    expect(INVENTORY_GRID_HEIGHT).toBe(5);
  });

  it('equip and unequip transactions preserve the shield when a two-handed weapon takes the slot', () => {
    const player = createPlayerCharacter('PALADIN');
    const shield = player.equipment.offHand!;
    const twoHander = weapon('labrys', 'compare_labrys');
    const withWeapon = { ...player, inventory: [twoHander] };
    const delta = compareDerivedStats(withWeapon, equipItem(withWeapon, twoHander.instanceId)).find(row => row.id === 'weaponPower');
    expect(delta?.delta).toBeGreaterThan(0);
    const equipped = equipItem(withWeapon, twoHander.instanceId);
    expect(equipped.equipment.mainHand?.instanceId).toBe(twoHander.instanceId);
    expect(equipped.equipment.offHand).toBeNull();
    expect(equipped.inventory.some(item => item.instanceId === shield.instanceId)).toBe(true);
    expect(calculateDerivedStats(equipped).weaponPower).toBeGreaterThan(calculateDerivedStats(player).weaponPower);
  });

  it('cancels a held charge when inventory opens so closing it cannot fire an attack', () => {
    const runtime = new FPSGameRuntime('SORCERER');
    runtime.update(0.05, inputFrame({ secondaryPressed: true, secondaryDown: true }));
    runtime.update(0.05, inputFrame({ inventoryPressed: true, secondaryDown: true }));
    expect(runtime.inventoryOpen).toBe(true);
    runtime.inventoryOpen = false;
    runtime.update(0.05, inputFrame());
    expect(runtime.projectiles).toHaveLength(0);
    expect(runtime.player.stats.mp).toBe(createPlayerCharacter('SORCERER').stats.mp);
  });
});

describe('FPS-R4B mythic uniques and loot policy', () => {
  it('has eight stable functional effect IDs with a capped trigger, cooldown, and class fallback', () => {
    expect(UNIQUE_ITEMS).toHaveLength(8);
    expect(new Set(UNIQUE_ITEMS.map(item => item.effectId)).size).toBe(8);
    const triggers = [
      ['ariadnes_thread', 'DODGE_SUCCESS', 0, 1.25],
      ['aspis_bronze_gate', 'BLOCK_SUCCESS', 100, 12],
      ['serpent_queen_fang', 'POISON_APPLIED', 0, 1.35],
      ['promethean_ember', 'BURN_APPLIED', 0, 1.25],
      ['stygian_seal', 'SOUL_SKILL_CAST', 0, 0.2],
      ['artemis_mark', 'PROJECTILE_HIT', 0, 1.2],
      ['cyclopean_mallet', 'HEAVY_MELEE_HIT', 40, 0.45],
      ['laurel_asclepius', 'SELF_HEAL', 10, 0.25],
    ] as const;
    for (const [effectId, trigger, magnitude, expected] of triggers) {
      const classId = effectId === 'stygian_seal' ? 'NECROMANCER' : 'BARBARIAN';
      const equipped = withUnique(effectId, classId);
      const activated = resolveUniqueTrigger(equipped, effectId, trigger, magnitude);
      expect(activated.activated, effectId).toBe(true);
      expect(activated.magnitude, effectId).toBe(expected);
      expect(resolveUniqueTrigger(activated.player, effectId, trigger, magnitude).activated, effectId).toBe(false);
    }

    const fallback = UNIQUE_ITEMS.find(item => item.effectId === 'stygian_seal')!;
    const incompatible = withUnique('stygian_seal', 'PALADIN');
    expect(fallback.fallbackSummary).toBeTruthy();
    expect(resolveUniqueTrigger(incompatible, 'stygian_seal', 'SOUL_SKILL_CAST').activated).toBe(false);
    expect(getUniqueStatBonuses(incompatible)).toEqual({});
    const forged = withUnique('ariadnes_thread');
    const uniqueSlot = getItemEquipmentSlots(forged.equipment.neck!)[0];
    const uniqueItem = forged.equipment[uniqueSlot]!;
    forged.equipment[uniqueSlot] = { ...uniqueItem, rarity: 'RARE' };
    expect(getUniqueStatBonuses(forged)).toEqual({});
    expect(resolveUniqueTrigger(forged, 'ariadnes_thread', 'DODGE_SUCCESS').activated).toBe(false);
    expect(validateItemInstance(forged.equipment[uniqueSlot]).valid).toBe(false);
  });

  it('consumes a single temporary projectile charge and expires unused charges', () => {
    const artemis = resolveUniqueTrigger(withUnique('artemis_mark'), 'artemis_mark', 'PROJECTILE_HIT');
    const used = consumeUniqueCharge(artemis.player, 'artemis_mark');
    expect(used.consumed).toBe(true);
    expect(consumeUniqueCharge(used.player, 'artemis_mark').consumed).toBe(false);
    let expired = resolveUniqueTrigger(withUnique('promethean_ember'), 'promethean_ember', 'BURN_APPLIED').player;
    for (let index = 0; index < 160; index += 1) expired = tickUniqueEffects(expired, 0.05);
    expect(expired.uniqueEffectStates).toEqual([]);
    expect(consumeUniqueCharge(expired, 'promethean_ember').consumed).toBe(false);
  });

  it('rolls uniques only from eligible elite drops and preserves authored Guardian rewards', () => {
    const eliteUnique = createEnemyDrop(enemy(), 2, () => 0);
    expect(eliteUnique?.rarity).toBe('UNIQUE');
    expect(eliteUnique?.uniqueEffectId).toBeTruthy();
    const guardian = createEnemyDrop(enemy({ id: 'guardian-reward', definitionId: 'guardian_serpent_priestess', isBoss: true, lootTier: 'GUARDIAN' }), 2, () => 0);
    expect(guardian).toMatchObject({ baseId: 'serpent_fang', rarity: 'RARE' });
    expect(guardian?.uniqueEffectId).toBeUndefined();
  });

  it('collects a full-bag unique into saved overflow without deleting its world drop', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const inventory = Array.from({ length: 50 }, (_, index) => potion('pickup_bag_' + index, index + 1));
    const player = { ...runtime.player, inventory, inventoryGrid: normalizeInventoryGrid(inventory).placements };
    const openCell = runtime.world.map.flatMap((row, z) => row.map((tile, x) => ({ tile, x, z })))
      .find(cell => cell.tile === TileType.EMPTY && runtime.world.map[cell.z]?.[cell.x + 1] === TileType.EMPTY)!;
    player.position = { x: openCell.x + 0.5, y: 0, z: openCell.z + 0.5 };
    player.rotation = { yaw: 0, pitch: 0 };
    const unique = createUniqueInstance('ariadnes_thread', 'world_unique_r4b', 2);
    runtime.player = player;
    runtime.loot = [{ id: unique.instanceId, position: { x: player.position.x + 0.8, y: 0, z: player.position.z }, item: unique }];
    runtime.interact();
    expect(runtime.loot).toHaveLength(0);
    expect(runtime.player.inventory.some(item => item.instanceId === unique.instanceId)).toBe(true);
    expect(normalizeInventoryGrid(runtime.player.inventory, runtime.player.inventoryGrid).overflowIds).toContain(unique.instanceId);
    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const resumed = loadMazeGame(storage);
    expect(resumed.save?.player.inventory.some(item => item.instanceId === unique.instanceId)).toBe(true);
  });
});

describe('FPS-R4B save migration', () => {
  it('migrates R4A version 3 to version 5 without replacing the old save or losing items', () => {
    const runtime = new FPSGameRuntime('PALADIN');
    const inventory = Array.from({ length: 55 }, (_, index) => potion('legacy_v3_item_' + index, index + 1));
    const unique = createUniqueInstance('artemis_mark', 'legacy_v3_world_unique', 3);
    runtime.player = { ...runtime.player, inventory, inventoryGrid: undefined, uniqueEffectStates: undefined };
    runtime.loot = [{ id: unique.instanceId, item: unique, position: { ...runtime.player.position } }];
    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const r4a = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as Record<string, any>;
    r4a.version = 3;
    const canonicalEquipment = r4a.player.equipment;
    r4a.player.equipment = {
      weapon: canonicalEquipment.mainHand,
      armor: canonicalEquipment.torso,
      offhand: canonicalEquipment.offHand,
      accessory: canonicalEquipment.ring1 ?? canonicalEquipment.ring2 ?? canonicalEquipment.neck ?? null,
    };
    delete r4a.player.inventoryGrid;
    delete r4a.player.uniqueEffectStates;
    const original = JSON.stringify(r4a);
    storage.setItem(MAZE_SAVE_KEY, original);

    const migrated = loadMazeGame(storage);
    expect(migrated.invalid).toBe(false);
    expect(migrated.migratedFromR4A).toBe(true);
    expect(migrated.migrationRequired).toBe(true);
    expect(storage.getItem(MAZE_SAVE_KEY)).toBe(original);
    const actualIds = [...migrated.save!.player.inventory, ...Object.values(migrated.save!.player.equipment).filter((item): item is ItemInstance => Boolean(item)), ...migrated.save!.loot.map(drop => drop.item)].map(item => item.instanceId).sort();
    const legacyEquipment = Object.values(r4a.player.equipment).filter(Boolean) as ItemInstance[];
    const expectedIds = [...inventory, ...legacyEquipment, unique].map(item => item.instanceId).sort();
    expect(actualIds).toEqual(expectedIds);
    expect(normalizeInventoryGrid(migrated.save!.player.inventory, migrated.save!.player.inventoryGrid).overflowIds.length).toBe(5);
    expect(migrated.save!.player.inventoryGrid).toEqual(loadMazeGame(storage).save!.player.inventoryGrid);
    expect(saveMazeGame(migrated.save!, storage)).toBe(true);
    expect(JSON.parse(storage.getItem(MAZE_SAVE_KEY)!).version).toBe(6);
    expect(loadMazeGame(storage).migrationRequired).toBe(false);
  });
});
