import { getItemBase, ITEM_BASE_BY_ID, LEGACY_ITEM_BASE_IDS } from '../data/itemBases';
import type { EquipmentLoadout, EquipmentSlot, Item, ItemInstance, LegacyEquipmentLoadout, PlayerCharacter } from '../types';

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'mainHand', 'offHand', 'head', 'torso', 'arms', 'legs', 'feet', 'neck', 'ring1', 'ring2', 'divineSigil',
];

/** The persisted inventory includes placed items and safe overflow items. */
export const MAX_INVENTORY_INSTANCES = 1024;

export function createEmptyEquipment(): EquipmentLoadout {
  return { mainHand: null, offHand: null, head: null, torso: null, arms: null, legs: null, feet: null, neck: null, ring1: null, ring2: null, divineSigil: null };
}

export function getItemEquipmentSlots(item: Item): readonly EquipmentSlot[] {
  const baseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  return getItemBase(baseId)?.equipmentSlots ?? [];
}

export function getEquipmentRequirement(item: Item, playerLevel: number): { requiredLevel: number; met: boolean } {
  const baseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  const requiredLevel = getItemBase(baseId)?.requiredLevel ?? 1;
  return { requiredLevel, met: Number.isFinite(playerLevel) && playerLevel >= requiredLevel };
}

export function isTwoHandedItem(item: ItemInstance | Item | null | undefined): boolean {
  if (!item) return false;
  const baseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  const base = getItemBase(baseId);
  if (base) return base.twoHanded === true || base.tags.includes('TWO_HANDED');
  return item.type === 'WEAPON' && (item.visualType === 'bow' || item.visualType === 'axe' || item.visualType === 'staff');
}

export function isShieldItem(item: ItemInstance | Item | null | undefined): boolean {
  if (!item) return false;
  const baseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  return item.type === 'SHIELD' || Boolean(getItemBase(baseId)?.tags.includes('SHIELD'));
}

export function isFocusItem(item: ItemInstance | Item | null | undefined): boolean {
  if (!item) return false;
  const baseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  return Boolean(getItemBase(baseId)?.tags.includes('FOCUS'));
}

export function isDualWieldLoadout(equipment: EquipmentLoadout): boolean {
  return Boolean(equipment.mainHand?.type === 'WEAPON' && !isTwoHandedItem(equipment.mainHand)
    && equipment.offHand?.type === 'WEAPON' && !isTwoHandedItem(equipment.offHand));
}

export type EquipmentErrorCode = 'ITEM_MISSING' | 'NOT_EQUIPPABLE' | 'LEVEL_REQUIREMENT' | 'TWO_HAND_CONFLICT' | 'INVENTORY_CAPACITY' | 'INVALID_IDENTITY' | 'INVALID_LOADOUT';

export interface EquipmentTransactionResult {
  ok: boolean;
  player: PlayerCharacter;
  slot?: EquipmentSlot;
  errorCode?: EquipmentErrorCode;
  message?: string;
}

/** Chooses a concrete slot from item metadata and the current hand/ring occupancy. */
export function resolveEquipmentSlot(player: PlayerCharacter, item: Item): EquipmentSlot | null {
  const compatible = getItemEquipmentSlots(item);
  if (!compatible.length) return null;
  if (compatible.length === 1) return compatible[0];
  if (compatible.includes('mainHand') && compatible.includes('offHand')) {
    if (!player.equipment.mainHand) return 'mainHand';
    if (isTwoHandedItem(player.equipment.mainHand)) return 'mainHand';
    if (!player.equipment.offHand) return 'offHand';
    return 'mainHand';
  }
  if (compatible.includes('ring1') && compatible.includes('ring2')) {
    return !player.equipment.ring1 ? 'ring1' : !player.equipment.ring2 ? 'ring2' : 'ring1';
  }
  return compatible[0] ?? null;
}

export function validateEquipmentLoadout(equipment: unknown): equipment is EquipmentLoadout {
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) return false;
  const candidate = equipment as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (keys.length !== EQUIPMENT_SLOTS.length || keys.some((key, index) => key !== [...EQUIPMENT_SLOTS].sort()[index])) return false;
  const ids = new Set<string>();
  for (const slot of EQUIPMENT_SLOTS) {
    const item = candidate[slot];
    if (item === null) continue;
    if (!item || typeof item !== 'object') return false;
    const instance = item as ItemInstance;
    if (typeof instance.instanceId !== 'string' || !instance.instanceId || ids.has(instance.instanceId)) return false;
    if (!getItemEquipmentSlots(instance).includes(slot)) return false;
    if (instance.quantity !== 1) return false;
    ids.add(instance.instanceId);
  }
  const main = candidate.mainHand as ItemInstance | null;
  const off = candidate.offHand as ItemInstance | null;
  if (main && isTwoHandedItem(main) && off) return false;
  if (off?.type === 'WEAPON' && (!main || main.type !== 'WEAPON' || isTwoHandedItem(main) || isTwoHandedItem(off))) return false;
  return true;
}

export function legacyEquipmentSlots(): readonly (keyof LegacyEquipmentLoadout)[] {
  return ['weapon', 'armor', 'offhand', 'accessory'];
}

export function equipmentSlotLabel(slot: EquipmentSlot): string {
  const labels: Record<EquipmentSlot, string> = {
    mainHand: 'Main Hand', offHand: 'Off Hand', head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs', feet: 'Feet', neck: 'Neck', ring1: 'Ring 1', ring2: 'Ring 2', divineSigil: 'Divine Sigil',
  };
  return labels[slot];
}

export function canStoreInventoryItems(inventory: readonly ItemInstance[], equipment: EquipmentLoadout, additions: readonly ItemInstance[], reservedIds: readonly string[] = []): boolean {
  if (inventory.length + additions.length > MAX_INVENTORY_INSTANCES) return false;
  const ids = new Set<string>(reservedIds);
  for (const item of [...inventory, ...Object.values(equipment).filter((entry): entry is ItemInstance => Boolean(entry)), ...additions]) {
    if (!item.instanceId || ids.has(item.instanceId) || !Number.isInteger(item.quantity) || item.quantity < 1) return false;
    ids.add(item.instanceId);
  }
  return true;
}
