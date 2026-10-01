import type { Item, Player, WeaponVisualType } from '../types';

const legacyWeaponNames: Record<string, WeaponVisualType> = {
  'Battle Axe': 'axe',
  'Iron Mace': 'mace',
  'War Hammer': 'mace',
  'Wooden Staff': 'staff',
  'Bone Wand': 'staff',
  'Iron Dagger': 'dagger',
  'Short Bow': 'bow',
  'Leather Wraps': 'unarmed',
};

export const getWeaponVisualType = (item: Item | null | undefined): WeaponVisualType => {
  if (!item) return 'unarmed';
  if (item.visualType) return item.visualType;
  if (legacyWeaponNames[item.name]) return legacyWeaponNames[item.name];
  if (/^Blade \+\d+$/.test(item.name)) return 'sword';
  if (/^Dagger \+\d+$/.test(item.name)) return 'dagger';
  if (/^Mace \+\d+$/.test(item.name)) return 'mace';
  return 'sword';
};

const normalizeItem = (item: Item | null | undefined): Item | null => {
  if (!item) return null;
  const { texture: _legacyTexture, ...safeItem } = item as Item & { texture?: unknown };
  return safeItem.type === 'WEAPON'
    ? { ...safeItem, visualType: getWeaponVisualType(safeItem) }
    : safeItem;
};

export const normalizePlayerWeaponVisuals = (player: Player): Player => ({
  ...player,
  inventory: Array.isArray(player.inventory) ? player.inventory.map(item => normalizeItem(item)!) : [],
  party: Array.isArray(player.party) ? player.party.map(character => {
    const equipment = character.equipment ?? { weapon: null, armor: null, offhand: null, accessory: null };
    return {
      ...character,
      equipment: {
        weapon: normalizeItem(equipment.weapon),
        armor: normalizeItem(equipment.armor),
        offhand: normalizeItem(equipment.offhand),
        accessory: normalizeItem(equipment.accessory),
      },
    };
  }) : [],
});

export const serializeGameplayItem = (item: Item): Omit<Item, 'visualType'> => {
  const { texture: _legacyTexture, visualType: _visualType, ...gameplayItem } = item as Item & { texture?: unknown };
  return gameplayItem;
};
