import { CLASSES } from '../constants';
import { getItemBase, LEGACY_ITEM_BASE_IDS } from '../data/itemBases';
import type { CharacterTemplate, ClassType, EquipmentSlot, Item, ItemInstance, ItemRarity, PlayerCharacter, SoloCharacterStats, WorldEnemy } from '../types';
import { CLASS_ABILITY_LOADOUT } from '../combat/AbilityRegistry';
import { calculateDerivedStats } from './DerivedStats';
import { consumableEffect, createEnemyDrop, createLootInstance, legacyBaseId, normalizeLegacyItem, type RandomSource } from '../services/itemization';
import { consumableStackKey, MAX_CONSUMABLE_STACK, moveInventoryGridItem, normalizeInventoryGrid, syncInventoryGrid } from '../services/inventoryGrid';

export const itemSlotFor = (item: Item): EquipmentSlot | null => {
  if (item.type === 'WEAPON') return 'weapon';
  if (item.type === 'ARMOR') return 'armor';
  if (item.type === 'SHIELD') return 'offhand';
  if (item.type === 'ACCESSORY') return 'accessory';
  return null;
};

export function createItemInstance(item: Item, instanceId: string, itemLevel = 1, rarity: ItemRarity = 'COMMON'): ItemInstance {
  const { isEquipped: _isEquipped, ...base } = item;
  const baseId = item.baseId || (getItemBase(item.id) ? item.id : LEGACY_ITEM_BASE_IDS[item.id]) || legacyBaseId(item as ItemInstance);
  const definition = getItemBase(baseId);
  return normalizeLegacyItem({
    ...base,
    ...(definition?.consumableEffect && !base.consumableEffect ? { consumableEffect: definition.consumableEffect } : {}),
    baseId,
    instanceId,
    itemLevel: Math.max(1, Math.floor(itemLevel)),
    rarity,
    affixes: [],
    quantity: Math.max(1, item.quantity || 1),
  } as ItemInstance);
}

export function createPlayerCharacter(classId: ClassType, spawn = { x: 1.5, y: 0, z: 1.5 }): PlayerCharacter {
  const template = CLASSES[classId] as CharacterTemplate | undefined;
  if (!template) throw new Error('Unknown class ID: ' + classId);
  const id = 'player_' + classId.toLowerCase();
  const items = template.startItems.map(item => createItemInstance(item, id + '_' + item.id));
  const equipment: PlayerCharacter['equipment'] = { weapon: null, armor: null, offhand: null, accessory: null };
  const inventory: ItemInstance[] = [];
  for (const item of items) {
    const slot = itemSlotFor(item);
    if (slot && !equipment[slot]) equipment[slot] = item;
    else inventory.push(item);
  }
  const stats: SoloCharacterStats = {
    hp: template.stats.maxHp,
    maxHp: template.stats.maxHp,
    mp: template.stats.maxMp,
    maxMp: template.stats.maxMp,
    baseMaxHp: template.stats.maxHp,
    baseMaxMp: template.stats.maxMp,
    str: template.stats.str,
    dex: template.stats.dex,
    int: template.stats.int,
    xp: 0,
    level: 1,
    damageBonus: 0,
    baseArmor: 0,
    armor: 0,
  };
  return refreshPlayerDerivedCaps({
    id,
    classId,
    name: template.name,
    position: { ...spawn },
    rotation: { yaw: 0, pitch: -0.08 },
    stats,
    equipment,
    inventory,
    inventoryGrid: syncInventoryGrid(inventory),
    uniqueEffectStates: [],
    skills: [{ abilityId: CLASS_ABILITY_LOADOUT[classId].skill, rank: 1 }],
    statusEffects: [],
  });
}

export function xpToNextLevel(level: number): number {
  return 20 + Math.max(1, level) * 20;
}

export function grantExperience(player: PlayerCharacter, amount: number): { player: PlayerCharacter; levelsGained: number } {
  let next = { ...player, stats: { ...player.stats, xp: player.stats.xp + Math.max(0, amount) } };
  let levelsGained = 0;
  let threshold = xpToNextLevel(next.stats.level);
  while (next.stats.xp >= threshold) {
    next.stats.xp -= threshold;
    next.stats.level += 1;
    levelsGained += 1;
    next.stats.baseMaxHp = (next.stats.baseMaxHp ?? next.stats.maxHp) + 8;
    next.stats.hp = Math.min(calculateDerivedStats(next).maxHealth, next.stats.hp + 8);
    next.stats.baseMaxMp = (next.stats.baseMaxMp ?? next.stats.maxMp) + 4;
    next.stats.mp = Math.min(calculateDerivedStats(next).maxMana, next.stats.mp + 4);
    const primary = next.classId === 'BARBARIAN' || next.classId === 'PALADIN' ? 'str'
      : next.classId === 'ROGUE' || next.classId === 'RANGER' || next.classId === 'MONK' ? 'dex' : 'int';
    next.stats[primary] += 1;
    threshold = xpToNextLevel(next.stats.level);
  }
  return { player: refreshPlayerDerivedCaps(next), levelsGained };
}

export function equipItem(player: PlayerCharacter, instanceId: string): PlayerCharacter {
  const itemIndex = player.inventory.findIndex(item => item.instanceId === instanceId);
  if (itemIndex < 0) return player;
  const item = player.inventory[itemIndex];
  const slot = itemSlotFor(item);
  if (!slot) return player;
  const base = getItemBase(item.baseId);
  if (player.stats.level < (base?.requiredLevel ?? 1)) return player;
  const weapon = slot === 'weapon' ? item : player.equipment.weapon;
  if (slot === 'offhand' && isTwoHanded(weapon)) return player;

  const inventory = player.inventory.filter((_, index) => index !== itemIndex);
  if (item.quantity > 1) {
    const splitId = allocateSplitInstanceId(player, item);
    inventory.push({ ...item, instanceId: splitId, quantity: item.quantity - 1 });
  }
  const equipment = { ...player.equipment };
  const replaced = equipment[slot];
  if (replaced) inventory.push(replaced);
  equipment[slot] = { ...item, quantity: 1 };
  if (slot === 'weapon' && isTwoHanded(item) && equipment.offhand) {
    inventory.push(equipment.offhand);
    equipment.offhand = null;
  }
  return refreshPlayerDerivedCaps({ ...player, equipment, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) });
}

export function unequipItem(player: PlayerCharacter, slot: EquipmentSlot): PlayerCharacter {
  const item = player.equipment[slot];
  if (!item) return player;
  const equipment = { ...player.equipment, [slot]: null };
  const inventory = [...player.inventory, item];
  return refreshPlayerDerivedCaps({ ...player, equipment, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) });
}

export function rollEnemyDrop(enemy: WorldEnemy, floorLevel: number, random: RandomSource): ItemInstance | null {
  return createEnemyDrop(enemy, floorLevel, random);
}

export function consumePotion(player: PlayerCharacter, instanceId: string): PlayerCharacter | null {
  const index = player.inventory.findIndex(item => item.instanceId === instanceId && item.type === 'POTION');
  if (index < 0) return null;
  const item = player.inventory[index];
  const effect = consumableEffect(item);
  if (!effect) return null;
  const derived = calculateDerivedStats(player);
  const stats = { ...player.stats };
  if (effect === 'MANA') {
    if (stats.mp >= derived.maxMana) return null;
    stats.mp = Math.min(derived.maxMana, stats.mp + item.value);
  } else {
    if (stats.hp >= derived.maxHealth) return null;
    stats.hp = Math.min(derived.maxHealth, stats.hp + item.value);
  }
  const inventory = [...player.inventory];
  if (item.quantity > 1) inventory[index] = { ...item, quantity: item.quantity - 1 };
  else inventory.splice(index, 1);
  return { ...player, stats, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) };
}

export interface AddInventoryItemResult {
  player: PlayerCharacter;
  stored: boolean;
  stacked: boolean;
  overflowIds: string[];
}

/** Adds one reward atomically; overflow remains in the save and is surfaced as a stash. */
export function addInventoryItem(player: PlayerCharacter, incoming: ItemInstance): AddInventoryItemResult {
  const existingIds = new Set([
    ...player.inventory.map(item => item.instanceId),
    ...Object.values(player.equipment).filter((item): item is ItemInstance => Boolean(item)).map(item => item.instanceId),
  ]);
  if (!incoming.instanceId || existingIds.has(incoming.instanceId)) {
    return { player, stored: false, stacked: false, overflowIds: normalizeInventoryGrid(player.inventory, player.inventoryGrid).overflowIds };
  }

  const inventory = [...player.inventory];
  const stackKey = consumableStackKey(incoming);
  let remaining = Math.max(1, Math.floor(incoming.quantity));
  let stacked = false;
  if (stackKey) {
    for (let index = 0; index < inventory.length && remaining > 0; index += 1) {
      const current = inventory[index];
      if (consumableStackKey(current) !== stackKey || current.quantity >= MAX_CONSUMABLE_STACK) continue;
      const accepted = Math.min(remaining, MAX_CONSUMABLE_STACK - current.quantity);
      inventory[index] = { ...current, quantity: current.quantity + accepted };
      remaining -= accepted;
      stacked ||= accepted > 0;
    }
  }
  if (remaining > 0) {
    const idStem = incoming.instanceId;
    let suffix = 1;
    const nextInstanceId = () => {
      let id = idStem + '_stack_' + suffix++;
      while (existingIds.has(id) || inventory.some(item => item.instanceId === id)) id = idStem + '_stack_' + suffix++;
      return id;
    };
    if (existingIds.has(incoming.instanceId) || inventory.some(item => item.instanceId === incoming.instanceId)) incoming = { ...incoming, instanceId: nextInstanceId() };
    while (remaining > 0) {
      const quantity = stackKey ? Math.min(MAX_CONSUMABLE_STACK, remaining) : 1;
      inventory.push({ ...incoming, quantity });
      remaining -= quantity;
      if (remaining > 0) incoming = { ...incoming, instanceId: nextInstanceId() };
    }
  }
  const grid = normalizeInventoryGrid(inventory, player.inventoryGrid);
  return { player: { ...player, inventory, inventoryGrid: grid.placements }, stored: true, stacked, overflowIds: grid.overflowIds };
}

export function moveInventoryItem(player: PlayerCharacter, instanceId: string, x: number, y: number): { player: PlayerCharacter; moved: boolean; swapped: boolean } {
  const result = moveInventoryGridItem(player.inventory, player.inventoryGrid ?? [], instanceId, x, y);
  return result.moved
    ? { player: { ...player, inventoryGrid: result.placements }, moved: true, swapped: result.swapped }
    : { player, moved: false, swapped: false };
}

/** Splits a stack into two persistent consumable stacks without changing its total quantity. */
export function splitInventoryStack(player: PlayerCharacter, instanceId: string, reservedIds: readonly string[] = []): PlayerCharacter | null {
  const index = player.inventory.findIndex(item => item.instanceId === instanceId);
  if (index < 0) return null;
  const source = player.inventory[index];
  if (!consumableStackKey(source) || source.quantity < 2) return null;
  const quantity = Math.floor(source.quantity / 2);
  const used = new Set([
    ...reservedIds,
    ...player.inventory.map(item => item.instanceId),
    ...Object.values(player.equipment).filter((item): item is ItemInstance => Boolean(item)).map(item => item.instanceId),
  ]);
  const stem = source.instanceId + '_split_' + quantity;
  let instanceIdForSplit = stem;
  let suffix = 2;
  while (used.has(instanceIdForSplit)) instanceIdForSplit = stem + '_' + suffix++;
  const inventory = [...player.inventory];
  inventory[index] = { ...source, quantity: source.quantity - quantity };
  inventory.push({ ...source, instanceId: instanceIdForSplit, quantity });
  return { ...player, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) };
}

/** Drops one unit; a split stack gets a fresh ID and the source stack remains intact. */
export function removeInventoryUnit(player: PlayerCharacter, instanceId: string): { player: PlayerCharacter; item: ItemInstance } | null {
  const index = player.inventory.findIndex(item => item.instanceId === instanceId);
  if (index < 0) return null;
  const source = player.inventory[index];
  const inventory = [...player.inventory];
  let item: ItemInstance;
  if (source.quantity > 1) {
    let suffix = 1;
    let splitId = source.instanceId + '_drop_' + suffix++;
    while (inventory.some(candidate => candidate.instanceId === splitId) || Object.values(player.equipment).some(candidate => candidate?.instanceId === splitId)) splitId = source.instanceId + '_drop_' + suffix++;
    item = { ...source, instanceId: splitId, quantity: 1 };
    inventory[index] = { ...source, quantity: source.quantity - 1 };
  } else {
    item = source;
    inventory.splice(index, 1);
  }
  return { player: { ...player, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) }, item };
}

/** Recomputes cached legacy armor and clamps resources after load/equipment changes. */
export function refreshPlayerDerivedCaps(player: PlayerCharacter): PlayerCharacter {
  const baseMaxHp = Math.max(1, Number.isFinite(player.stats.baseMaxHp) ? player.stats.baseMaxHp! : player.stats.maxHp);
  const baseMaxMp = Math.max(0, Number.isFinite(player.stats.baseMaxMp) ? player.stats.baseMaxMp! : player.stats.maxMp);
  const withBaseCaps = { ...player, stats: { ...player.stats, baseMaxHp, baseMaxMp, baseArmor: Math.max(0, player.stats.baseArmor ?? 0) } };
  const derived = calculateDerivedStats(withBaseCaps);
  return { ...player, stats: {
    ...player.stats,
    baseMaxHp,
    baseMaxMp,
    baseArmor: withBaseCaps.stats.baseArmor,
    maxHp: derived.maxHealth,
    maxMp: derived.maxMana,
    armor: derived.armor,
    hp: Math.max(0, Math.min(derived.maxHealth, Number.isFinite(player.stats.hp) ? player.stats.hp : derived.maxHealth)),
    mp: Math.max(0, Math.min(derived.maxMana, Number.isFinite(player.stats.mp) ? player.stats.mp : derived.maxMana)),
  } };
}

function isTwoHanded(item: ItemInstance | null): boolean {
  return Boolean(item && (getItemBase(item.baseId)?.twoHanded || item.visualType === 'bow' || item.visualType === 'axe' || item.visualType === 'staff'));
}

function allocateSplitInstanceId(player: PlayerCharacter, item: ItemInstance): string {
  const used = new Set<string>([
    ...player.inventory.map(candidate => candidate.instanceId),
    ...Object.values(player.equipment).filter((candidate): candidate is ItemInstance => Boolean(candidate)).map(candidate => candidate.instanceId),
  ]);
  const stem = item.instanceId + '_split_' + Math.max(1, item.quantity - 1);
  let id = stem;
  let suffix = 2;
  while (used.has(id)) id = stem + '_' + suffix++;
  return id;
}
