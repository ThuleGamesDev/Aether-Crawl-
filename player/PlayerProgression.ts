import { CLASSES } from '../constants';
import type { CharacterTemplate, ClassType, EquipmentSlot, Item, ItemInstance, ItemRarity, PlayerCharacter, SoloCharacterStats, WorldEnemy } from '../types';
import { CLASS_ABILITY_LOADOUT } from '../combat/AbilityRegistry';

export const itemSlotFor = (item: Item): EquipmentSlot | null => {
  if (item.type === 'WEAPON') return 'weapon';
  if (item.type === 'ARMOR') return 'armor';
  if (item.type === 'SHIELD') return 'offhand';
  if (item.type === 'ACCESSORY') return 'accessory';
  return null;
};

export function createItemInstance(item: Item, instanceId: string, itemLevel = 1, rarity: ItemRarity = 'COMMON'): ItemInstance {
  const { isEquipped: _isEquipped, ...base } = item;
  return { ...base, instanceId, itemLevel: Math.max(1, Math.floor(itemLevel)), rarity, affixes: [], quantity: Math.max(1, item.quantity || 1) };
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
    str: template.stats.str,
    dex: template.stats.dex,
    int: template.stats.int,
    xp: 0,
    level: 1,
    damageBonus: 0,
    armor: 0,
  };
  return {
    id,
    classId,
    name: template.name,
    position: { ...spawn },
    rotation: { yaw: 0, pitch: -0.08 },
    stats,
    equipment,
    inventory,
    skills: [{ abilityId: CLASS_ABILITY_LOADOUT[classId].skill, rank: 1 }],
    statusEffects: [],
  };
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
    next.stats.maxHp += 8;
    next.stats.hp = Math.min(next.stats.maxHp, next.stats.hp + 8);
    next.stats.maxMp += 4;
    next.stats.mp = Math.min(next.stats.maxMp, next.stats.mp + 4);
    const primary = next.classId === 'BARBARIAN' || next.classId === 'PALADIN' ? 'str'
      : next.classId === 'ROGUE' || next.classId === 'RANGER' || next.classId === 'MONK' ? 'dex' : 'int';
    next.stats[primary] += 1;
    threshold = xpToNextLevel(next.stats.level);
  }
  return { player: next, levelsGained };
}

export function equipItem(player: PlayerCharacter, instanceId: string): PlayerCharacter {
  const itemIndex = player.inventory.findIndex(item => item.instanceId === instanceId);
  if (itemIndex < 0) return player;
  const item = player.inventory[itemIndex];
  const slot = itemSlotFor(item);
  if (!slot) return player;
  const inventory = player.inventory.filter((_, index) => index !== itemIndex);
  const replaced = player.equipment[slot];
  if (replaced) inventory.push(replaced);
  const equipment = { ...player.equipment, [slot]: item };
  const armor = (equipment.armor?.value ?? 0) + (equipment.offhand?.value ?? 0);
  return { ...player, equipment, inventory, stats: { ...player.stats, armor } };
}

export function unequipItem(player: PlayerCharacter, slot: EquipmentSlot): PlayerCharacter {
  const item = player.equipment[slot];
  if (!item) return player;
  const equipment = { ...player.equipment, [slot]: null };
  const armor = (equipment.armor?.value ?? 0) + (equipment.offhand?.value ?? 0);
  return { ...player, equipment, inventory: [...player.inventory, item], stats: { ...player.stats, armor } };
}

export function makeEnemyDrop(enemy: WorldEnemy, floorLevel: number): ItemInstance {
  if (enemy.definitionId === 'giant_rat') {
    return createItemInstance({ id: 'rat_hide_' + enemy.id, name: 'Tough Rat Hide', description: 'A crude piece of armor with a surprising amount of bite.', type: 'ARMOR', value: 2 + Math.floor(floorLevel / 2), armorWeight: 'LIGHT', icon: '▧', quantity: 1 }, 'drop_' + enemy.id, floorLevel);
  }
  if (enemy.definitionId === 'skeleton_warrior') {
    return createItemInstance({ id: 'bone_charm_' + enemy.id, name: 'Bone Charm', description: 'A cold charm that sharpens the wearer’s attacks.', type: 'ACCESSORY', value: 2 + Math.floor(floorLevel / 2), statBonus: 'STR', icon: '◇', quantity: 1 }, 'drop_' + enemy.id, floorLevel, enemy.isBoss ? 'RARE' : 'COMMON');
  }
  return createItemInstance({ id: 'dungeon_cache_' + enemy.id, name: 'Dungeon Cache', description: 'Recovered gear from a defeated foe.', type: 'WEAPON', value: 3 + floorLevel, visualType: 'sword', icon: '†', quantity: 1 }, 'drop_' + enemy.id, floorLevel);
}

export function consumePotion(player: PlayerCharacter, instanceId: string): PlayerCharacter | null {
  const index = player.inventory.findIndex(item => item.instanceId === instanceId && item.type === 'POTION');
  if (index < 0) return null;
  const item = player.inventory[index];
  const isMana = /mana|mp/i.test(item.name);
  const stats = { ...player.stats };
  if (isMana) {
    if (stats.mp >= stats.maxMp) return null;
    stats.mp = Math.min(stats.maxMp, stats.mp + item.value);
  } else {
    if (stats.hp >= stats.maxHp) return null;
    stats.hp = Math.min(stats.maxHp, stats.hp + item.value);
  }
  const inventory = [...player.inventory];
  if (item.quantity > 1) inventory[index] = { ...item, quantity: item.quantity - 1 };
  else inventory.splice(index, 1);
  return { ...player, stats, inventory };
}
