import { getItemBase } from '../data/itemBases';
import { getItemAffix } from '../data/itemAffixes';
import type { DerivedCharacterStats, ItemAffixStat, ItemInstance, ItemTag, PlayerCharacter } from '../types';
import { getUniqueStatBonuses } from './UniqueEffects';
import { ACTION_SPEED_RULES } from '../combat/actionSpeed';

const MAX_STAT = 100_000;

/**
 * Canonical item/stat pipeline. This function is pure: it never writes cached
 * values back to the player and never trusts display names or unknown affixes.
 */
export function calculateDerivedStats(player: PlayerCharacter): DerivedCharacterStats {
  let weaponPower = 0;
  let armorBase = Math.max(0, finite(player.stats.baseArmor ?? 0));
  let strength = finite(player.stats.str);
  let dexterity = finite(player.stats.dex);
  let intelligence = finite(player.stats.int);
  let maxHealthFlat = 0;
  let maxHealthPercent = 0;
  let maxManaFlat = 0;
  let maxManaPercent = 0;
  let armorFlat = 0;
  let armorPercent = 0;
  let armorMovementPenalty = 0;
  const values: Partial<Record<ItemAffixStat, number>> = {};

  for (const item of equippedItems(player)) {
    const value = Math.max(0, finite(item.value));
    if (item.type === 'WEAPON') weaponPower += value;
    if (item.type === 'ARMOR' || item.type === 'SHIELD') armorBase += value;
    if (item.type === 'ARMOR') {
      const weight = item.armorWeight ?? getItemBase(item.baseId)?.armorWeight;
      armorMovementPenalty += weight === 'HEAVY' ? 0.08 : weight === 'MEDIUM' ? 0.04 : 0;
    }
    if (item.type === 'ACCESSORY') {
      if (item.statBonus === 'STR') strength += value;
      else if (item.statBonus === 'DEX') dexterity += value;
      else if (item.statBonus === 'INT') intelligence += value;
      else if (item.statBonus === 'HP') maxHealthFlat += value;
      else if (item.statBonus === 'MP') maxManaFlat += value;
    }

    const affixes = item.affixes ?? [];
    if (!affixes.length) continue;
    const tags = itemTags(item);
    for (const affix of affixes) {
      const definition = getItemAffix(affix.id);
      if (!definition || !Number.isFinite(affix.value) || affix.value < definition.minValue || affix.value > definition.maxValue) continue;
      if (affix.tier !== undefined && affix.tier !== definition.tier) continue;
      if (!definition.validItemTags.some(tag => tags.has(tag))) continue;
      values[definition.stat] = (values[definition.stat] ?? 0) + affix.value;
    }
  }

  for (const [stat, amount] of Object.entries(getUniqueStatBonuses(player)) as Array<[ItemAffixStat, number]>) {
    values[stat] = (values[stat] ?? 0) + amount;
  }

  maxHealthFlat += values.maxHealthFlat ?? 0;
  maxHealthPercent += values.maxHealthPercent ?? 0;
  maxManaFlat += values.maxManaFlat ?? 0;
  maxManaPercent += values.maxManaPercent ?? 0;
  armorFlat += values.armorFlat ?? 0;
  armorPercent += values.armorPercent ?? 0;
  strength += values.strengthFlat ?? 0;
  dexterity += values.dexterityFlat ?? 0;
  intelligence += values.intelligenceFlat ?? 0;

  const baseMaxHealth = Math.max(1, finite(player.stats.baseMaxHp ?? player.stats.maxHp, 1));
  const baseMaxMana = Math.max(0, finite(player.stats.baseMaxMp ?? player.stats.maxMp));
  const maxHealth = clamp((baseMaxHealth + maxHealthFlat) * (1 + maxHealthPercent / 100), 1, MAX_STAT);
  const maxMana = clamp((baseMaxMana + maxManaFlat) * (1 + maxManaPercent / 100), 0, MAX_STAT);
  const armor = clamp((armorBase + armorFlat) * (1 + armorPercent / 100), 0, 100);

  return {
    strength: clamp(strength, 0, MAX_STAT),
    dexterity: clamp(dexterity, 0, MAX_STAT),
    intelligence: clamp(intelligence, 0, MAX_STAT),
    maxHealth,
    maxMana,
    armor,
    weaponPower: clamp(weaponPower, 0, MAX_STAT),
    physicalDamageFlat: bounded(values.physicalDamageFlat ?? 0, -50, 100),
    physicalDamageMultiplier: multiplier(values.physicalDamagePercent ?? 0, 0.5, 2),
    spellDamageFlat: bounded(values.spellDamageFlat ?? 0, -50, 100),
    spellDamageMultiplier: multiplier(values.spellDamagePercent ?? 0, 0.5, 2),
    attackSpeedMultiplier: multiplier(values.attackSpeedPercent ?? 0, ACTION_SPEED_RULES.derivedMinimum, ACTION_SPEED_RULES.derivedMaximum),
    castSpeedMultiplier: multiplier(values.castSpeedPercent ?? 0, ACTION_SPEED_RULES.derivedMinimum, ACTION_SPEED_RULES.derivedMaximum),
    criticalChance: clamp(0.05 + (values.criticalChancePercent ?? 0) / 100, 0, 0.65),
    criticalDamageMultiplier: clamp(1.5 + (values.criticalDamagePercent ?? 0) / 100, 1.5, 3),
    movementSpeedMultiplier: clamp(multiplier(values.movementSpeedPercent ?? 0, 0.6, 1.5) * (1 - Math.min(0.2, armorMovementPenalty)), 0.6, 1.5),
    cooldownMultiplier: clamp(1 - Math.min(45, Math.max(0, values.cooldownReductionPercent ?? 0)) / 100, 0.55, 1),
    manaCostMultiplier: clamp(1 - Math.min(50, Math.max(0, values.manaCostReductionPercent ?? 0)) / 100, 0.5, 1),
    projectileDamageMultiplier: multiplier(values.projectileDamagePercent ?? 0, 0.5, 1.75),
    projectileSpeedMultiplier: multiplier(values.projectileSpeedPercent ?? 0, 0.5, 1.75),
    bleedChance: chance(values.bleedChancePercent ?? 0),
    bleedPowerMultiplier: multiplier(values.bleedPowerPercent ?? 0, 0.5, 2),
    poisonChance: chance(values.poisonChancePercent ?? 0),
    poisonPowerMultiplier: multiplier(values.poisonPowerPercent ?? 0, 0.5, 2),
    fireChance: chance(values.fireChancePercent ?? 0),
    firePowerMultiplier: multiplier(values.firePowerPercent ?? 0, 0.5, 2),
    lifeOnHit: clamp(finite(values.lifeOnHit ?? 0), 0, 20),
    lifeOnKill: clamp(finite(values.lifeOnKill ?? 0), 0, 50),
  };
}

/** Pure comparison helper for the inventory; equipment transactions remain the source of truth. */
export function compareDerivedStats(before: PlayerCharacter, after: PlayerCharacter): Array<{ id: string; label: string; before: number; after: number; delta: number }> {
  const left = calculateDerivedStats(before);
  const right = calculateDerivedStats(after);
  const rows: Array<{ id: string; label: string; before: number; after: number }> = [
    { id: 'strength', label: 'Strength', before: left.strength, after: right.strength },
    { id: 'dexterity', label: 'Dexterity', before: left.dexterity, after: right.dexterity },
    { id: 'intelligence', label: 'Intelligence', before: left.intelligence, after: right.intelligence },
    { id: 'weaponPower', label: 'Weapon power', before: left.weaponPower, after: right.weaponPower },
    { id: 'physicalDamageFlat', label: 'Flat physical damage', before: left.physicalDamageFlat, after: right.physicalDamageFlat },
    { id: 'physicalDamageMultiplier', label: 'Physical damage', before: left.physicalDamageMultiplier * 100, after: right.physicalDamageMultiplier * 100 },
    { id: 'spellDamageFlat', label: 'Flat spell damage', before: left.spellDamageFlat, after: right.spellDamageFlat },
    { id: 'spellDamageMultiplier', label: 'Spell damage', before: left.spellDamageMultiplier * 100, after: right.spellDamageMultiplier * 100 },
    { id: 'attackSpeedMultiplier', label: 'Attack speed', before: left.attackSpeedMultiplier * 100, after: right.attackSpeedMultiplier * 100 },
    { id: 'castSpeedMultiplier', label: 'Cast speed', before: left.castSpeedMultiplier * 100, after: right.castSpeedMultiplier * 100 },
    { id: 'armor', label: 'Armor', before: left.armor, after: right.armor },
    { id: 'maxHealth', label: 'Max health', before: left.maxHealth, after: right.maxHealth },
    { id: 'maxMana', label: 'Max mana', before: left.maxMana, after: right.maxMana },
    { id: 'movementSpeedMultiplier', label: 'Movement speed', before: left.movementSpeedMultiplier * 100, after: right.movementSpeedMultiplier * 100 },
    { id: 'criticalChance', label: 'Critical chance', before: left.criticalChance * 100, after: right.criticalChance * 100 },
    { id: 'criticalDamageMultiplier', label: 'Critical damage', before: left.criticalDamageMultiplier * 100, after: right.criticalDamageMultiplier * 100 },
    { id: 'cooldownRecovery', label: 'Cooldown recovery', before: (1 - left.cooldownMultiplier) * 100, after: (1 - right.cooldownMultiplier) * 100 },
    { id: 'manaCostReduction', label: 'Mana cost reduction', before: (1 - left.manaCostMultiplier) * 100, after: (1 - right.manaCostMultiplier) * 100 },
    { id: 'projectileDamageMultiplier', label: 'Projectile damage', before: left.projectileDamageMultiplier * 100, after: right.projectileDamageMultiplier * 100 },
    { id: 'projectileSpeedMultiplier', label: 'Projectile speed', before: left.projectileSpeedMultiplier * 100, after: right.projectileSpeedMultiplier * 100 },
    { id: 'bleedChance', label: 'Bleed chance', before: left.bleedChance * 100, after: right.bleedChance * 100 },
    { id: 'bleedPowerMultiplier', label: 'Bleed power', before: left.bleedPowerMultiplier * 100, after: right.bleedPowerMultiplier * 100 },
    { id: 'poisonChance', label: 'Poison chance', before: left.poisonChance * 100, after: right.poisonChance * 100 },
    { id: 'poisonPowerMultiplier', label: 'Poison power', before: left.poisonPowerMultiplier * 100, after: right.poisonPowerMultiplier * 100 },
    { id: 'fireChance', label: 'Fire chance', before: left.fireChance * 100, after: right.fireChance * 100 },
    { id: 'firePowerMultiplier', label: 'Fire power', before: left.firePowerMultiplier * 100, after: right.firePowerMultiplier * 100 },
    { id: 'lifeOnHit', label: 'Life on hit', before: left.lifeOnHit, after: right.lifeOnHit },
    { id: 'lifeOnKill', label: 'Life on kill', before: left.lifeOnKill, after: right.lifeOnKill },
  ];
  return rows.map(row => ({ ...row, delta: row.after - row.before }));
}

export function itemTags(item: ItemInstance): Set<ItemTag> {
  const definition = getItemBase(item.baseId);
  if (definition) return new Set(definition.tags);
  const tags: ItemTag[] = [];
  if (item.type === 'WEAPON') {
    tags.push('WEAPON');
    tags.push(['staff'].includes(item.visualType ?? '') ? 'SPELL' : 'PHYSICAL');
    tags.push(item.visualType === 'bow' ? 'PROJECTILE' : 'MELEE');
    if (item.visualType === 'bow') tags.push('BOW');
    if (item.visualType === 'dagger') tags.push('DAGGER');
    if (item.visualType === 'staff') tags.push('STAFF');
  } else if (item.type === 'ARMOR') tags.push('ARMOR');
  else if (item.type === 'SHIELD') tags.push('SHIELD', 'ARMOR');
  else if (item.type === 'ACCESSORY') tags.push('ACCESSORY');
  else tags.push('CONSUMABLE');
  return new Set(tags);
}

function equippedItems(player: PlayerCharacter): ItemInstance[] {
  return Object.values(player.equipment).filter((item): item is ItemInstance => Boolean(item));
}
function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, finite(value, min))); }
function bounded(value: number, min: number, max: number): number { return clamp(value, min, max); }
function multiplier(percent: number, min: number, max: number): number { return clamp(1 + finite(percent) / 100, min, max); }
function chance(percent: number): number { return clamp(finite(percent) / 100, 0, 0.6); }
