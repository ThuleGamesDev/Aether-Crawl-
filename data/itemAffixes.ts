import type { ItemAffixDefinition, ItemTag } from '../types';

const EQUIPMENT: ItemTag[] = ['WEAPON', 'ARMOR', 'SHIELD', 'ACCESSORY'];
const WEAPON: ItemTag[] = ['WEAPON'];
const PHYSICAL: ItemTag[] = ['WEAPON', 'PHYSICAL'];
const SPELL: ItemTag[] = ['WEAPON', 'SPELL'];
const ACCESSORY: ItemTag[] = ['ACCESSORY'];
const ARMOR: ItemTag[] = ['ARMOR', 'SHIELD', 'ACCESSORY'];

/** Static, localized-at-the-edge affix data. Values are stored as whole percentage points. */
export const ITEM_AFFIXES: readonly ItemAffixDefinition[] = [
  { id: 'affix_strong_t1', name: 'Mighty', side: 'PREFIX', stat: 'strengthFlat', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 1, maxValue: 3, group: 'attribute.strength' },
  { id: 'affix_quick_t1', name: 'Quick', side: 'PREFIX', stat: 'dexterityFlat', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 1, maxValue: 3, group: 'attribute.dexterity' },
  { id: 'affix_sagacious_t1', name: 'Sagacious', side: 'PREFIX', stat: 'intelligenceFlat', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 1, maxValue: 3, group: 'attribute.intelligence' },
  { id: 'affix_impact_t1', name: 'Impacting', side: 'PREFIX', stat: 'physicalDamageFlat', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...ACCESSORY], minValue: 1, maxValue: 3, group: 'damage.physical.flat' },
  { id: 'affix_martial_t2', name: 'Martial', side: 'PREFIX', stat: 'physicalDamagePercent', tier: 2, minLevel: 4, validItemTags: [...PHYSICAL, ...ACCESSORY], minValue: 4, maxValue: 8, group: 'damage.physical.percent' },
  { id: 'affix_omen_t1', name: 'Omen-Touched', side: 'PREFIX', stat: 'spellDamageFlat', tier: 1, minLevel: 1, validItemTags: [...SPELL, ...ACCESSORY], minValue: 1, maxValue: 3, group: 'damage.spell.flat' },
  { id: 'affix_oracular_t2', name: 'Oracular', side: 'PREFIX', stat: 'spellDamagePercent', tier: 2, minLevel: 4, validItemTags: [...SPELL, ...ACCESSORY], minValue: 4, maxValue: 8, group: 'damage.spell.percent' },
  { id: 'affix_swift_t1', name: 'Swift', side: 'SUFFIX', stat: 'attackSpeedPercent', tier: 1, minLevel: 1, validItemTags: [...WEAPON, ...ACCESSORY], minValue: 2, maxValue: 5, group: 'speed.attack' },
  { id: 'affix_channeling_t1', name: 'of Channeling', side: 'SUFFIX', stat: 'castSpeedPercent', tier: 1, minLevel: 1, validItemTags: [...SPELL, ...ACCESSORY], minValue: 2, maxValue: 5, group: 'speed.cast' },
  { id: 'affix_precise_t1', name: 'Precise', side: 'PREFIX', stat: 'criticalChancePercent', tier: 1, minLevel: 1, validItemTags: [...WEAPON, ...ACCESSORY], minValue: 1, maxValue: 3, group: 'critical.chance' },
  { id: 'affix_deadly_t2', name: 'Deadly', side: 'SUFFIX', stat: 'criticalDamagePercent', tier: 2, minLevel: 4, validItemTags: [...WEAPON, ...ACCESSORY], minValue: 8, maxValue: 16, group: 'critical.damage' },
  { id: 'affix_vital_t1', name: 'Vital', side: 'PREFIX', stat: 'maxHealthFlat', tier: 1, minLevel: 1, validItemTags: [...ARMOR], minValue: 6, maxValue: 16, group: 'resource.health.flat' },
  { id: 'affix_enduring_t2', name: 'Enduring', side: 'SUFFIX', stat: 'maxHealthPercent', tier: 2, minLevel: 4, validItemTags: [...ARMOR], minValue: 4, maxValue: 8, group: 'resource.health.percent' },
  { id: 'affix_clear_minded_t1', name: 'Clear-Minded', side: 'PREFIX', stat: 'maxManaFlat', tier: 1, minLevel: 1, validItemTags: [...ARMOR, ...SPELL], minValue: 5, maxValue: 14, group: 'resource.mana.flat' },
  { id: 'affix_ambrosial_t2', name: 'Ambrosial', side: 'SUFFIX', stat: 'maxManaPercent', tier: 2, minLevel: 4, validItemTags: [...ARMOR, ...SPELL], minValue: 4, maxValue: 8, group: 'resource.mana.percent' },
  { id: 'affix_guarded_t1', name: 'Guarded', side: 'PREFIX', stat: 'armorFlat', tier: 1, minLevel: 1, validItemTags: [...ARMOR], minValue: 1, maxValue: 3, group: 'defense.armor.flat' },
  { id: 'affix_fortified_t2', name: 'Fortified', side: 'SUFFIX', stat: 'armorPercent', tier: 2, minLevel: 4, validItemTags: [...ARMOR], minValue: 4, maxValue: 8, group: 'defense.armor.percent' },
  { id: 'affix_wandering_t1', name: 'Wandering', side: 'PREFIX', stat: 'movementSpeedPercent', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 2, maxValue: 4, group: 'movement.speed' },
  { id: 'affix_tempered_t1', name: 'Tempered', side: 'SUFFIX', stat: 'cooldownReductionPercent', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 2, maxValue: 4, group: 'cooldown.reduction' },
  { id: 'affix_economical_t1', name: 'Economical', side: 'PREFIX', stat: 'manaCostReductionPercent', tier: 1, minLevel: 1, validItemTags: [...SPELL, ...ACCESSORY], minValue: 2, maxValue: 4, group: 'resource.mana_cost' },
  { id: 'affix_flight_t1', name: 'Far-Shooting', side: 'PREFIX', stat: 'projectileDamagePercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...SPELL, ...ACCESSORY], minValue: 3, maxValue: 7, group: 'projectile.damage' },
  { id: 'affix_feathered_t1', name: 'Feathered', side: 'SUFFIX', stat: 'projectileSpeedPercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...SPELL, ...ACCESSORY], minValue: 4, maxValue: 9, group: 'projectile.speed' },
  { id: 'affix_bloodletting_t1', name: 'Bloodletting', side: 'PREFIX', stat: 'bleedChancePercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...ACCESSORY], minValue: 4, maxValue: 9, group: 'status.bleed.chance' },
  { id: 'affix_gaping_t1', name: 'of Open Wounds', side: 'SUFFIX', stat: 'bleedPowerPercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...ACCESSORY], minValue: 8, maxValue: 18, group: 'status.bleed.power' },
  { id: 'affix_venomous_t1', name: 'Venomous', side: 'PREFIX', stat: 'poisonChancePercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...SPELL, ...ACCESSORY], minValue: 4, maxValue: 9, group: 'status.poison.chance' },
  { id: 'affix_toxic_t1', name: 'of the Serpent', side: 'SUFFIX', stat: 'poisonPowerPercent', tier: 1, minLevel: 1, validItemTags: [...PHYSICAL, ...SPELL, ...ACCESSORY], minValue: 8, maxValue: 18, group: 'status.poison.power' },
  { id: 'affix_scorching_t1', name: 'Scorching', side: 'PREFIX', stat: 'fireChancePercent', tier: 1, minLevel: 1, validItemTags: [...SPELL, ...ACCESSORY], minValue: 4, maxValue: 9, group: 'status.fire.chance' },
  { id: 'affix_igniting_t1', name: 'of Prometheus', side: 'SUFFIX', stat: 'firePowerPercent', tier: 1, minLevel: 1, validItemTags: [...SPELL, ...ACCESSORY], minValue: 8, maxValue: 18, group: 'status.fire.power' },
  { id: 'affix_sanguine_t1', name: 'Sanguine', side: 'SUFFIX', stat: 'lifeOnHit', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 1, maxValue: 3, group: 'recovery.life_on_hit' },
  { id: 'affix_predatory_t1', name: 'Predatory', side: 'SUFFIX', stat: 'lifeOnKill', tier: 1, minLevel: 1, validItemTags: [...EQUIPMENT], minValue: 2, maxValue: 6, group: 'recovery.life_on_kill' },
] satisfies readonly ItemAffixDefinition[];

const affixIndex = Object.create(null) as Record<string, ItemAffixDefinition>;
for (const affix of ITEM_AFFIXES) affixIndex[affix.id] = affix;
export const ITEM_AFFIX_BY_ID: Readonly<Record<string, ItemAffixDefinition>> = Object.freeze(affixIndex);

export function getItemAffix(id: string): ItemAffixDefinition | undefined {
  return ITEM_AFFIX_BY_ID[id];
}
