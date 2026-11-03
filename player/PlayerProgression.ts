import { CLASSES } from '../constants';
import { getItemBase, LEGACY_ITEM_BASE_IDS } from '../data/itemBases';
import type { CharacterTemplate, ClassType, EquipmentSlot, Item, ItemInstance, ItemRarity, PlayerCharacter, SoloCharacterStats, WorldEnemy } from '../types';
import { CLASS_ABILITY_LOADOUT } from '../combat/AbilityRegistry';
import { getClassSkillKit } from '../data/classSkillKits';
import { calculateDerivedStats } from './DerivedStats';
import { createClassPassiveState } from './ClassPassives';
import { consumableEffect, createEnemyDrop, createLootInstance, legacyBaseId, normalizeLegacyItem, type RandomSource } from '../services/itemization';
import { consumableStackKey, MAX_CONSUMABLE_STACK, moveInventoryGridItem, normalizeInventoryGrid, syncInventoryGrid } from '../services/inventoryGrid';
import { canStoreInventoryItems, createEmptyEquipment, getEquipmentRequirement, getItemEquipmentSlots, isTwoHandedItem, MAX_INVENTORY_INSTANCES, resolveEquipmentSlot, type EquipmentTransactionResult } from '../services/equipmentRules';

export const itemSlotFor = (item: Item): EquipmentSlot | null => getItemEquipmentSlots(item)[0] ?? null;

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
  const equipment = createEmptyEquipment();
  const inventory: ItemInstance[] = [];
  for (const item of items) {
    const compatible = getItemEquipmentSlots(item);
    const slot = compatible.find(candidate => !equipment[candidate]
      && (candidate !== 'offHand' || !isTwoHandedItem(equipment.mainHand))
      && (candidate !== 'offHand' || item.type !== 'WEAPON' || Boolean(equipment.mainHand && equipment.mainHand.type === 'WEAPON' && !isTwoHandedItem(equipment.mainHand))))
      ?? (compatible.includes('mainHand') && !equipment.mainHand ? 'mainHand' : null);
    if (slot) equipment[slot] = item;
    else inventory.push(item);
  }
  const stats: SoloCharacterStats = {
    hp: template.stats.maxHp,
    maxHp: template.stats.maxHp,
    mp: template.stats.maxMp,
    maxMp: template.stats.maxMp,
    baseMaxHp: template.stats.maxHp,
    baseMaxMp: template.stats.maxMp,
    baseMaxStamina: 100,
    stamina: 100,
    staminaRegenDelaySeconds: 0,
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
    skillPoints: 0,
    skillProgressionVersion: 1,
    classPassiveState: createClassPassiveState(classId),
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
  if (getClassSkillKit(player.classId) && levelsGained > 0) next.skillPoints = (next.skillPoints ?? 0) + levelsGained;
  return { player: refreshPlayerDerivedCaps(next), levelsGained };
}

export function tryEquipItem(player: PlayerCharacter, instanceId: string, reservedIds: readonly string[] = []): EquipmentTransactionResult {
  const itemIndex = player.inventory.findIndex(item => item.instanceId === instanceId);
  if (itemIndex < 0) return equipmentFailure(player, 'ITEM_MISSING', 'That item is no longer in the bag.');
  const item = player.inventory[itemIndex];
  const compatible = getItemEquipmentSlots(item);
  if (!compatible.length) return equipmentFailure(player, 'NOT_EQUIPPABLE', 'This item has no safe equipment slot.');
  const requirement = getEquipmentRequirement(item, player.stats.level);
  if (!requirement.met) return equipmentFailure(player, 'LEVEL_REQUIREMENT', 'Requires level ' + requirement.requiredLevel + '.');
  const slot = resolveEquipmentSlot(player, item);
  if (!slot) return equipmentFailure(player, 'TWO_HAND_CONFLICT', 'The two-handed weapon occupies both hands.');
  if (slot === 'offHand' && isTwoHandedItem(player.equipment.mainHand)) {
    return equipmentFailure(player, 'TWO_HAND_CONFLICT', 'The two-handed weapon occupies both hands.');
  }

  const inventory = player.inventory.filter((_, index) => index !== itemIndex);
  const additions: ItemInstance[] = [];
  if (item.quantity > 1) {
    const splitId = allocateSplitInstanceId(player, item, reservedIds);
    additions.push({ ...item, instanceId: splitId, quantity: item.quantity - 1 });
  }
  const equipment = { ...player.equipment };
  const replaced = equipment[slot];
  if (replaced) additions.push(replaced);
  equipment[slot] = { ...item, quantity: 1 };
  if (slot === 'mainHand' && isTwoHandedItem(item) && equipment.offHand) {
    additions.push(equipment.offHand);
    equipment.offHand = null;
  }
  if (!canStoreInventoryItems(inventory, equipment, additions, reservedIds)) {
    const code = inventory.length + additions.length > MAX_INVENTORY_INSTANCES ? 'INVENTORY_CAPACITY' : 'INVALID_IDENTITY';
    const message = code === 'INVENTORY_CAPACITY'
      ? 'Cannot equip safely: bag and overflow are at their storage limit. No items were moved.'
      : 'Cannot equip safely: an item identity is duplicated or invalid. No items were moved.';
    return equipmentFailure(player, code, message);
  }
  inventory.push(...additions);
  const next = refreshPlayerDerivedCaps({ ...player, equipment, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) });
  return { ok: true, player: next, slot };
}

/** Compatibility wrapper for existing simulation callers; UI uses the result API to report failures. */
export function equipItem(player: PlayerCharacter, instanceId: string): PlayerCharacter {
  return tryEquipItem(player, instanceId).player;
}

export function tryUnequipItem(player: PlayerCharacter, slot: EquipmentSlot, reservedIds: readonly string[] = []): EquipmentTransactionResult {
  const item = player.equipment[slot];
  if (!item) return equipmentFailure(player, 'ITEM_MISSING', 'That equipment slot is already empty.');
  const equipment = { ...player.equipment, [slot]: null };
  const inventory = [...player.inventory, item];
  if (!canStoreInventoryItems(player.inventory, equipment, [item], reservedIds)) {
    return equipmentFailure(player, 'INVENTORY_CAPACITY', 'Cannot unequip safely: bag and overflow are at their storage limit. No items were moved.');
  }
  const next = refreshPlayerDerivedCaps({ ...player, equipment, inventory, inventoryGrid: syncInventoryGrid(inventory, player.inventoryGrid) });
  return { ok: true, player: next, slot };
}

export function unequipItem(player: PlayerCharacter, slot: EquipmentSlot): PlayerCharacter {
  return tryUnequipItem(player, slot).player;
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
  if (inventory.length > MAX_INVENTORY_INSTANCES) {
    return { player, stored: false, stacked: false, overflowIds: normalizeInventoryGrid(player.inventory, player.inventoryGrid).overflowIds };
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
  if (player.inventory.length >= MAX_INVENTORY_INSTANCES) return null;
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
  const baseMaxStamina = Math.max(1, Number.isFinite(player.stats.baseMaxStamina) ? player.stats.baseMaxStamina! : 100);
  const withBaseCaps = { ...player, stats: { ...player.stats, baseMaxHp, baseMaxMp, baseMaxStamina, baseArmor: Math.max(0, player.stats.baseArmor ?? 0) } };
  const derived = calculateDerivedStats(withBaseCaps);
  return { ...player, stats: {
    ...player.stats,
    baseMaxHp,
    baseMaxMp,
    baseMaxStamina,
    baseArmor: withBaseCaps.stats.baseArmor,
    maxHp: derived.maxHealth,
    maxMp: derived.maxMana,
    armor: derived.armor,
    hp: Math.max(0, Math.min(derived.maxHealth, Number.isFinite(player.stats.hp) ? player.stats.hp : derived.maxHealth)),
    mp: Math.max(0, Math.min(derived.maxMana, Number.isFinite(player.stats.mp) ? player.stats.mp : derived.maxMana)),
    stamina: Math.max(0, Math.min(derived.maxStamina, Number.isFinite(player.stats.stamina) ? player.stats.stamina! : derived.maxStamina)),
    staminaRegenDelaySeconds: Math.max(0, Math.min(10, Number.isFinite(player.stats.staminaRegenDelaySeconds) ? player.stats.staminaRegenDelaySeconds! : 0)),
  } };
}

function allocateSplitInstanceId(player: PlayerCharacter, item: ItemInstance, reservedIds: readonly string[] = []): string {
  const used = new Set<string>([
    ...reservedIds,
    ...player.inventory.map(candidate => candidate.instanceId),
    ...Object.values(player.equipment).filter((candidate): candidate is ItemInstance => Boolean(candidate)).map(candidate => candidate.instanceId),
  ]);
  const stem = item.instanceId + '_split_' + Math.max(1, item.quantity - 1);
  let id = stem;
  let suffix = 2;
  while (used.has(id)) id = stem + '_' + suffix++;
  return id;
}

function equipmentFailure(player: PlayerCharacter, errorCode: EquipmentTransactionResult['errorCode'], message: string): EquipmentTransactionResult {
  return { ok: false, player, errorCode, message };
}
