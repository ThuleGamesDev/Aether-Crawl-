import type { ClassType, ItemAffixStat, UniqueEffectId } from '../types';

export interface UniqueItemDefinition {
  effectId: UniqueEffectId;
  baseId: string;
  name: string;
  description: string;
  triggerRule: string;
  cooldownRule: string;
  capRule: string;
  effectSummary: string;
  requiredClass?: ClassType;
  fallbackSummary?: string;
  statBonuses: Partial<Record<ItemAffixStat, number>>;
}

/** Curated R4B uniques; Guardian rewards retain their authored R4A identities. */
export const UNIQUE_ITEMS: readonly UniqueItemDefinition[] = [
  {
    effectId: 'ariadnes_thread', baseId: 'threaded_amulet', name: "Ariadne's Thread",
    description: 'A red thread that remembers every path out of danger.',
    triggerRule: 'Successful dodge', cooldownRule: '8 seconds', capRule: 'One movement surge; 2.25 seconds',
    effectSummary: '+25% movement speed after a successful dodge.', statBonuses: { movementSpeedPercent: 4 },
  },
  {
    effectId: 'aspis_bronze_gate', baseId: 'guardian_aspis', name: 'Aspis of the Bronze Gate',
    description: 'The Gatekeeper’s shield turns a measured block into a short countershock.',
    triggerRule: 'Block a facing attack while guarding', cooldownRule: '4 seconds', capRule: 'One counter per block; counter damage capped at 12',
    effectSummary: 'Returns 35% of blocked damage, up to 12, without starting another proc chain.', statBonuses: { armorFlat: 2 },
  },
  {
    effectId: 'serpent_queen_fang', baseId: 'serpent_fang', name: "Serpent Queen's Fang",
    description: 'Venom gathers in the bronze groove, then deepens the next poison application.',
    triggerRule: 'Apply poison to a target', cooldownRule: '5 seconds', capRule: 'One empowered application; +35% poison magnitude',
    effectSummary: 'The next poison application every 5 seconds deals 35% more tick damage.', statBonuses: { poisonPowerPercent: 15 },
  },
  {
    effectId: 'promethean_ember', baseId: 'oracle_staff', name: 'Promethean Ember',
    description: 'A coal from the first fire, kept alive beneath an oracle’s bronze cap.',
    triggerRule: 'Apply burn to an enemy', cooldownRule: '8-second charge expiry', capRule: 'One stored charge; consumed by the next fire spell',
    effectSummary: 'The next fire spell deals 25% more damage. The charge expires after 8 seconds.', statBonuses: { firePowerPercent: 15 },
  },
  {
    effectId: 'stygian_seal', baseId: 'chthonic_seal', name: 'Stygian Seal',
    description: 'A seal that answers soulcraft with a brief ward from below.',
    triggerRule: 'Necromancer casts a class ability', cooldownRule: '10 seconds', capRule: 'One 20% ward; 2.5 seconds, no stacking',
    effectSummary: 'Necromancer abilities grant 20% damage reduction for 2.5 seconds.',
    requiredClass: 'NECROMANCER', fallbackSummary: 'Other classes keep the accessory base stats; the soul ward requires Necromancer.',
    statBonuses: {},
  },
  {
    effectId: 'artemis_mark', baseId: 'labyrinth_bow', name: "Artemis' Mark",
    description: 'A silver sighting mark that guides one follow-up projectile.',
    triggerRule: 'A player projectile hits an enemy', cooldownRule: '3 seconds', capRule: 'One stored charge; expires after 6 seconds',
    effectSummary: 'Your next projectile deals 20% more damage. One mark can be stored.', statBonuses: { projectileDamagePercent: 8, criticalChancePercent: 2 },
  },
  {
    effectId: 'cyclopean_mallet', baseId: 'cyclopean_hammer', name: 'Cyclopean Mallet',
    description: 'Stone and bronze answer a crushing blow with one compact shockwave.',
    triggerRule: 'Heavy melee hit at 1.3× action power or higher', cooldownRule: '10 seconds', capRule: 'One shockwave per attack; 45% damage, 1.35 m radius',
    effectSummary: 'Heavy melee hits release one bounded shockwave at 45% of hit damage.', statBonuses: { physicalDamagePercent: 8 },
  },
  {
    effectId: 'laurel_asclepius', baseId: 'laurel_circlet', name: 'Laurel of Asclepius',
    description: 'Laurel leaves harden briefly when their bearer restores life.',
    triggerRule: 'Use a self-healing ability', cooldownRule: '12 seconds', capRule: 'One 25% ward; 3 seconds, no stacking',
    effectSummary: 'A successful self-heal grants 25% damage reduction for 3 seconds.', statBonuses: { maxHealthFlat: 4 },
  },
] as const;

const uniqueById = new Map(UNIQUE_ITEMS.map(item => [item.effectId, item]));

export function getUniqueItem(effectId: string | undefined): UniqueItemDefinition | undefined {
  return effectId ? uniqueById.get(effectId as UniqueEffectId) : undefined;
}

export function isUniqueEffectId(value: string): value is UniqueEffectId {
  return uniqueById.has(value as UniqueEffectId);
}
