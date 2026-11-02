import { ITEM_BASES, ITEM_BASE_BY_ID, LEGACY_ITEM_BASE_IDS, getItemBase } from '../data/itemBases';
import { getItemAffix } from '../data/itemAffixes';
import { ITEM_AFFIXES } from '../data/itemAffixes';
import { itemTags } from '../player/DerivedStats';
import { createUniqueInstance } from './uniqueItems';
import { getUniqueItem, isUniqueEffectId, UNIQUE_ITEMS } from '../data/uniqueItems';
import type { Item, ItemBaseDefinition, ItemInstance, ItemRarity, WorldEnemy } from '../types';

export type RandomSource = () => number;
export interface RollItemBaseOptions {
  itemLevel?: number;
  type?: Item['type'];
  tags?: readonly string[];
  allowedBaseIds?: readonly string[];
  excludedBaseIds?: readonly string[];
}
export interface ItemValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const ROLLABLE_BASE_IDS = [
  'labrys', 'dory_spear', 'xiphos', 'kopis', 'labyrinth_bow', 'oracle_staff', 'asclepiad_staff', 'chthonic_staff',
  'pankration_wraps', 'aspis', 'linothorax', 'bronze_cuirass', 'cretan_pelt', 'greaves', 'laurel_circlet',
  'ares_votive', 'chthonic_seal', 'serpent_ring', 'bronze_signet', 'threaded_amulet',
] as const;

const GUARDIAN_REWARDS: Readonly<Record<string, string>> = Object.freeze({
  guardian_bronze_gatekeeper: 'guardian_aspis',
  guardian_serpent_priestess: 'serpent_fang',
  guardian_cyclopean_mason: 'cyclopean_hammer',
  guardian_lamia_cistern: 'lamia_veil',
  guardian_threadbound_warden: 'threadbound_seal',
});

/** Selects from stable base IDs only. A caller supplies the authoritative seeded RNG. */
export function rollItemBase(random: RandomSource, options: RollItemBaseOptions = {}): ItemBaseDefinition {
  const level = safeLevel(options.itemLevel ?? 1);
  const allowed = new Set(options.allowedBaseIds ?? ROLLABLE_BASE_IDS);
  const excluded = new Set(options.excludedBaseIds ?? []);
  const tags = options.tags ? new Set(options.tags) : null;
  const candidates = ITEM_BASES
    .filter(base => base.requiredLevel <= level && base.type !== 'POTION' && base.type !== 'SCROLL')
    .filter(base => !options.type || base.type === options.type)
    .filter(base => allowed.has(base.baseId))
    .filter(base => !excluded.has(base.baseId))
    .filter(base => !tags || [...tags].some(tag => base.tags.includes(tag as ItemBaseDefinition['tags'][number])))
    .sort((a, b) => a.baseId.localeCompare(b.baseId));
  if (!candidates.length) throw new Error('No item base matches the requested loot constraints.');
  return candidates[randomIndex(random, candidates.length)];
}

/** Rolls only R4A rarity pools. UNIQUE is intentionally reserved for the next wave. */
export function rollAffixes(base: ItemBaseDefinition, rarity: ItemRarity, itemLevel: number, random: RandomSource): ItemInstance['affixes'] {
  const count = rarity === 'MAGIC' ? 1 + randomIndex(random, 2) : rarity === 'RARE' ? 3 + randomIndex(random, 2) : 0;
  if (!count) return [];
  const level = safeLevel(itemLevel);
  const candidates = getAffixCandidates(base, level);
  const chosen: ItemInstance['affixes'] = [];
  const groups = new Set<string>();
  while (chosen.length < count && candidates.length) {
    const eligible = candidates.filter(candidate => !groups.has(candidate.group));
    if (!eligible.length) break;
    const definition = eligible[randomIndex(random, eligible.length)];
    const roll = Math.min(0.999999, safeRandom(random));
    const value = definition.minValue + Math.floor(roll * (definition.maxValue - definition.minValue + 1));
    chosen.push({ id: definition.id, value, tier: definition.tier });
    groups.add(definition.group);
  }
  return chosen;
}

/** Creates an item exactly once at a gameplay event; rendering and loading never reroll it. */
export function createLootInstance(
  baseId: string,
  instanceId: string,
  itemLevel: number,
  rarity: ItemRarity,
  random: RandomSource,
  valueOverride?: number,
): ItemInstance {
  const base = getItemBase(baseId);
  if (!base) throw new Error('Unknown item base ID: ' + baseId);
  const level = safeLevel(itemLevel);
  const value = valueOverride === undefined ? scaleBaseValue(base, level) : Math.max(0, Math.floor(finite(valueOverride)));
  return {
    id: base.baseId,
    baseId: base.baseId,
    instanceId,
    name: base.name,
    description: base.description,
    type: base.type,
    value,
    itemLevel: level,
    rarity,
    affixes: rollAffixes(base, rarity, level, random),
    quantity: 1,
    ...(base.armorWeight ? { armorWeight: base.armorWeight } : {}),
    ...(base.statBonus ? { statBonus: base.statBonus } : {}),
    ...(base.consumableEffect ? { consumableEffect: base.consumableEffect } : {}),
    ...(base.icon ? { icon: base.icon } : {}),
    ...(base.visualType ? { visualType: base.visualType } : {}),
  };
}

/** Enemy drop policy has one RNG roll at reward grant; Guardian rewards remain guaranteed. */
export function createEnemyDrop(enemy: WorldEnemy, floorLevel: number, random: RandomSource): ItemInstance | null {
  const tier = enemy.isBoss || enemy.definitionId.startsWith('guardian_') ? 'GUARDIAN' : enemy.lootTier ?? 'NORMAL';
  const level = safeLevel(floorLevel);
  if (tier === 'GUARDIAN') {
    const guardianBase = GUARDIAN_REWARDS[enemy.definitionId];
    return createLootInstance(guardianBase ?? 'guardian_aspis', 'drop_' + enemy.id, level, 'RARE', random);
  }

  const dropChance = tier === 'ELITE' ? 0.72 : 0.27;
  if (safeRandom(random) >= dropChance) return null;
  if (tier === 'ELITE' && level >= 2) {
    const uniqueChance = Math.min(0.04, 0.01 + (level - 2) * 0.01);
    if (safeRandom(random) < uniqueChance) {
      const unique = UNIQUE_ITEMS[randomIndex(random, UNIQUE_ITEMS.length)];
      return createUniqueInstance(unique.effectId, 'drop_' + enemy.id, level);
    }
  }
  const rarityRoll = safeRandom(random);
  const floorQuality = Math.min(0.16, Math.max(0, level - 1) * 0.025);
  const rarity: ItemRarity = tier === 'ELITE'
    ? rarityRoll < 0.14 ? 'COMMON' : rarityRoll < 0.72 - floorQuality ? 'MAGIC' : 'RARE'
    : rarityRoll < 0.72 ? 'COMMON' : rarityRoll < 0.98 - floorQuality ? 'MAGIC' : 'RARE';
  const preferred = preferredEnemyBases(enemy);
  const base = rollItemBase(random, { itemLevel: level, allowedBaseIds: preferred });
  return createLootInstance(base.baseId, 'drop_' + enemy.id, level, rarity, random);
}

export function describeItem(item: ItemInstance): string {
  const base = getItemBase(item.baseId);
  const tags = itemTags(item);
  const known = (item.affixes ?? []).flatMap(instance => {
    const affix = getItemAffix(instance.id);
    if (!affix || !Number.isFinite(instance.value) || instance.value < affix.minValue || instance.value > affix.maxValue) return [];
    if (instance.tier !== undefined && instance.tier !== affix.tier) return [];
    if (!affix.validItemTags.some(tag => tags.has(tag))) return [];
    return [affix];
  });
  const prefix = known.find(affix => affix.side === 'PREFIX');
  const suffix = known.find(affix => affix.side === 'SUFFIX');
  const baseName = base?.name ?? item.name;
  return [prefix?.name, baseName, suffix?.name].filter(Boolean).join(' ');
}

export function describeAffix(id: string, value: number): string {
  const affix = getItemAffix(id);
  if (!affix || !Number.isFinite(value) || value < affix.minValue || value > affix.maxValue) return 'Unrecognized modifier';
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const values: Record<string, string> = {
    strengthFlat: '+' + amount + ' Strength', dexterityFlat: '+' + amount + ' Dexterity', intelligenceFlat: '+' + amount + ' Intelligence',
    physicalDamageFlat: '+' + amount + ' Physical Damage', physicalDamagePercent: '+' + amount + '% Physical Damage',
    spellDamageFlat: '+' + amount + ' Spell Damage', spellDamagePercent: '+' + amount + '% Spell Damage',
    attackSpeedPercent: '+' + amount + '% Attack Speed', castSpeedPercent: '+' + amount + '% Cast Speed',
    criticalChancePercent: '+' + amount + '% Critical Chance', criticalDamagePercent: '+' + amount + '% Critical Damage',
    maxHealthFlat: '+' + amount + ' Maximum Health', maxHealthPercent: '+' + amount + '% Maximum Health',
    maxManaFlat: '+' + amount + ' Maximum Mana', maxManaPercent: '+' + amount + '% Maximum Mana',
    armorFlat: '+' + amount + ' Armor', armorPercent: '+' + amount + '% Armor', movementSpeedPercent: '+' + amount + '% Movement Speed',
    cooldownReductionPercent: '+' + amount + '% Cooldown Recovery', manaCostReductionPercent: '-' + amount + '% Mana Cost',
    projectileDamagePercent: '+' + amount + '% Projectile Damage', projectileSpeedPercent: '+' + amount + '% Projectile Speed',
    bleedChancePercent: '+' + amount + '% Bleed Chance', bleedPowerPercent: '+' + amount + '% Bleed Damage',
    poisonChancePercent: '+' + amount + '% Poison Chance', poisonPowerPercent: '+' + amount + '% Poison Damage',
    fireChancePercent: '+' + amount + '% Fire Chance', firePowerPercent: '+' + amount + '% Fire Damage',
    lifeOnHit: '+' + amount + ' Life on Hit', lifeOnKill: '+' + amount + ' Life on Kill',
  };
  return values[affix.stat] ?? affix.name;
}

/** Unknown affixes are retained as data but ignored by DerivedStats; malformed item fields are rejected. */
export function validateItemInstance(value: unknown, requireBaseId = true): ItemValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Item must be an object.'], warnings };
  if (typeof value.instanceId !== 'string' || !value.instanceId.trim()) errors.push('Missing instanceId.');
  if (typeof value.id !== 'string' || !value.id.trim()) errors.push('Missing item id.');
  if (typeof value.baseId !== 'string' || !value.baseId.trim()) {
    if (requireBaseId) errors.push('Missing baseId.');
    else warnings.push('Legacy item has no baseId.');
  } else if (!ITEM_BASE_BY_ID[value.baseId]) warnings.push('Unknown baseId; legacy numeric fields are used safely.');
  else if (ITEM_BASE_BY_ID[value.baseId].type !== value.type) errors.push('Item type does not match its base definition.');
  if (typeof value.name !== 'string' || typeof value.description !== 'string') errors.push('Missing item display data.');
  if (!['WEAPON', 'ARMOR', 'POTION', 'SCROLL', 'SHIELD', 'ACCESSORY'].includes(value.type)) errors.push('Unknown item type.');
  if (!Number.isFinite(value.value) || value.value < 0) errors.push('Item value must be finite and non-negative.');
  if (!Number.isInteger(value.quantity) || value.quantity < 1) errors.push('Item quantity must be a positive integer.');
  if (!Number.isInteger(value.itemLevel) || value.itemLevel < 1) errors.push('Item level must be a positive integer.');
  if (!['COMMON', 'MAGIC', 'RARE', 'UNIQUE'].includes(value.rarity)) errors.push('Unknown item rarity.');
  if (!Array.isArray(value.affixes)) errors.push('Affixes must be an array.');
  else for (const affix of value.affixes) {
    if (!isRecord(affix) || typeof affix.id !== 'string' || !Number.isFinite(affix.value)) { errors.push('Malformed affix instance.'); continue; }
    const definition = getItemAffix(affix.id);
    if (!definition) warnings.push('Unknown affix ' + affix.id + ' is preserved but inactive.');
    else if (affix.value < definition.minValue || affix.value > definition.maxValue || (affix.tier !== undefined && affix.tier !== definition.tier)) {
      warnings.push('Out-of-range affix ' + affix.id + ' is preserved but inactive.');
    }
  }
  if (value.uniqueEffectId !== undefined) {
    if (typeof value.uniqueEffectId !== 'string' || !isUniqueEffectId(value.uniqueEffectId)) errors.push('Unknown unique effect ID.');
    else {
      const unique = getUniqueItem(value.uniqueEffectId);
      if (value.rarity !== 'UNIQUE' || value.baseId !== unique?.baseId) errors.push('Unique effect does not match its unique base and rarity.');
    }
  } else if (value.rarity === 'UNIQUE') errors.push('Unique items require a registered effect ID.');
  if (value.consumableEffect !== undefined && value.consumableEffect !== 'HEALTH' && value.consumableEffect !== 'MANA') errors.push('Unknown consumable effect.');
  return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

/** Maps pre-R4A authored IDs, never display names, to stable bases. */
export function legacyBaseId(item: Pick<ItemInstance, 'id' | 'type' | 'visualType'>): string {
  if (ITEM_BASE_BY_ID[item.id]) return item.id;
  if (LEGACY_ITEM_BASE_IDS[item.id]) return LEGACY_ITEM_BASE_IDS[item.id];
  const prefixes: Array<[string, string]> = [
    ['guardian_aspis_', 'guardian_aspis'], ['serpent_fang_', 'serpent_fang'], ['cyclopean_hammer_', 'cyclopean_hammer'],
    ['lamia_veil_', 'lamia_veil'], ['threadbound_seal_', 'threadbound_seal'], ['shrine_charm_', 'ares_votive'],
    ['vault_blade_', 'kopis'], ['room_health_', 'healing_draught'], ['room_mana_', 'nectar_flask'],
  ];
  const match = prefixes.find(([prefix]) => item.id.startsWith(prefix));
  if (match) return match[1];
  if (item.type === 'POTION') return item.id === 'potion_mp' || item.id === 'room_mana' ? 'nectar_flask' : 'healing_draught';
  if (item.type === 'WEAPON') {
    if (item.visualType === 'axe') return 'labrys';
    if (item.visualType === 'spear') return 'dory_spear';
    if (item.visualType === 'dagger') return 'kopis';
    if (item.visualType === 'bow') return 'labyrinth_bow';
    if (item.visualType === 'staff') return 'oracle_staff';
    if (item.visualType === 'mace') return 'asclepiad_staff';
    if (item.visualType === 'unarmed') return 'pankration_wraps';
  }
  return 'legacy_' + item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function normalizeLegacyItem(item: ItemInstance): ItemInstance {
  const baseId = item.baseId || legacyBaseId(item);
  const base = getItemBase(baseId);
  const affixes = Array.isArray(item.affixes) ? item.affixes.filter(affix => affix && typeof affix.id === 'string' && Number.isFinite(affix.value)).map(affix => ({ ...affix })) : [];
  const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const itemLevel = safeLevel(item.itemLevel);
  const rarity: ItemRarity = ['COMMON', 'MAGIC', 'RARE', 'UNIQUE'].includes(item.rarity) ? item.rarity : 'COMMON';
  return {
    ...item,
    id: item.id || baseId,
    baseId,
    itemLevel,
    rarity,
    quantity,
    affixes,
    ...(base?.consumableEffect ? { consumableEffect: base.consumableEffect } : {}),
  };
}

export function consumableEffect(item: ItemInstance): 'HEALTH' | 'MANA' | null {
  if (item.type !== 'POTION') return null;
  const base = getItemBase(item.baseId);
  if (base?.consumableEffect) return base.consumableEffect;
  if (item.consumableEffect === 'HEALTH' || item.consumableEffect === 'MANA') return item.consumableEffect;
  if (item.id === 'potion_mp' || item.id === 'room_mana' || item.baseId === 'nectar_flask') return 'MANA';
  if (item.id === 'potion_hp' || item.id === 'room_health' || item.baseId === 'healing_draught') return 'HEALTH';
  return null;
}

function getAffixCandidates(base: ItemBaseDefinition, itemLevel: number) {
  return ITEM_AFFIXES.filter(affix => affix.minLevel <= itemLevel && affix.validItemTags.some(tag => base.tags.includes(tag)));
}

function scaleBaseValue(base: ItemBaseDefinition, level: number): number {
  if (base.type === 'POTION' || base.type === 'SCROLL') return base.value;
  const growthEvery = base.type === 'ACCESSORY' ? 4 : 3;
  return base.value + Math.floor(Math.max(0, level - 1) / growthEvery);
}
function preferredEnemyBases(enemy: WorldEnemy): readonly string[] | undefined {
  if (enemy.definitionId === 'giant_rat') return ['cretan_pelt', 'linothorax'];
  if (enemy.definitionId === 'skeleton_warrior') return ['chthonic_seal', 'bronze_signet'];
  if (enemy.attackSetId === 'plunderer' || enemy.attackSetId === 'empusa') return ['kopis', 'serpent_ring'];
  if (enemy.attackSetId === 'raider') return ['dory_spear', 'labyrinth_bow'];
  if (enemy.attackSetId === 'brute' || enemy.attackSetId === 'bull_enforcer') return ['labrys', 'cyclopean_hammer', 'bronze_cuirass'];
  return ROLLABLE_BASE_IDS;
}
function safeLevel(value: number): number { return Math.max(1, Math.min(100, Math.floor(finite(value, 1)))); }
function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }
function safeRandom(random: RandomSource): number {
  try { const value = random(); return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0; }
  catch { return 0; }
}
function randomIndex(random: RandomSource, length: number): number { return Math.floor(safeRandom(random) * Math.max(1, length)); }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
