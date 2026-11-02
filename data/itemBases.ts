import type { ItemBaseDefinition } from '../types';

/** Canonical R4A item bases. Instance names and values are never used as lookup keys. */
export const ITEM_BASES: readonly ItemBaseDefinition[] = [
  { baseId: 'labrys', id: 'labrys', name: 'Labrys', description: 'A double-headed Cretan bronze axe built for broad, forceful swings.', type: 'WEAPON', value: 5, icon: '⚒', visualType: 'axe', tags: ['WEAPON', 'PHYSICAL', 'MELEE', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['axe_start'] },
  { baseId: 'dory_spear', id: 'dory_spear', name: 'Dory Spear', description: 'A leaf-headed ash spear with a bronze point.', type: 'WEAPON', value: 4, icon: '↗', visualType: 'spear', tags: ['WEAPON', 'PHYSICAL', 'MELEE'], requiredLevel: 1, legacyIds: ['paladin_weapon_start'] },
  { baseId: 'xiphos', id: 'xiphos', name: 'Bronze Xiphos', description: 'A straight bronze sword balanced for a disciplined thrust.', type: 'WEAPON', value: 5, icon: '†', visualType: 'sword', tags: ['WEAPON', 'PHYSICAL', 'MELEE'], requiredLevel: 1, legacyIds: ['arming_sword', 'bronze_xiphos'] },
  { baseId: 'kopis', id: 'kopis', name: 'Kopis', description: 'A forward-curving bronze blade made for close work.', type: 'WEAPON', value: 4, icon: '⌁', visualType: 'dagger', tags: ['WEAPON', 'PHYSICAL', 'MELEE', 'DAGGER'], requiredLevel: 1, legacyIds: ['dagger_start', 'iron_sword', 'bronze_kopis'] },
  { baseId: 'labyrinth_bow', id: 'labyrinth_bow', name: 'Hunting Bow', description: 'A compact yew bow strung for narrow passages.', type: 'WEAPON', value: 4, icon: '⌒', visualType: 'bow', tags: ['WEAPON', 'PHYSICAL', 'PROJECTILE', 'BOW', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['bow_start', 'shortbow'] },
  { baseId: 'oracle_staff', id: 'oracle_staff', name: 'Oracle’s Ritual Staff', description: 'An olive-wood staff capped with a small bronze sun disc.', type: 'WEAPON', value: 2, icon: '☼', visualType: 'staff', tags: ['WEAPON', 'SPELL', 'MELEE', 'STAFF', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['staff_start', 'wooden_staff'] },
  { baseId: 'asclepiad_staff', id: 'asclepiad_staff', name: 'Bronze Ritual Staff', description: 'A bronze-capped staff carried by a temple healer.', type: 'WEAPON', value: 5, icon: '⚕', visualType: 'mace', tags: ['WEAPON', 'PHYSICAL', 'SPELL', 'MELEE', 'STAFF', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['hammer_start', 'war_hammer'] },
  { baseId: 'chthonic_staff', id: 'chthonic_staff', name: 'Chthonic Staff', description: 'A ritual staff marked with a seal for the world below.', type: 'WEAPON', value: 3, icon: '☾', visualType: 'staff', tags: ['WEAPON', 'SPELL', 'PROJECTILE', 'STAFF', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['wand_bone'] },
  { baseId: 'pankration_wraps', id: 'pankration_wraps', name: 'Pankration Handwraps', description: 'Worn linen wraps stiffened with bronze rings.', type: 'WEAPON', value: 3, icon: '◌', visualType: 'unarmed', tags: ['WEAPON', 'PHYSICAL', 'MELEE'], requiredLevel: 1, legacyIds: ['gloves_start'] },
  { baseId: 'aspis', id: 'aspis', name: 'Aspis', description: 'A round bronze-faced shield with a dark-red rim.', type: 'SHIELD', value: 2, icon: '◉', tags: ['SHIELD', 'ARMOR'], requiredLevel: 1, legacyIds: ['shield_start', 'round_shield'] },
  { baseId: 'guardian_aspis', id: 'guardian_aspis', name: 'Guardian’s Aspis', description: 'A bronze-faced shield whose rim still bears the Gatekeeper’s final blow.', type: 'SHIELD', value: 5, icon: '◉', tags: ['SHIELD', 'ARMOR'], requiredLevel: 1, legacyIds: ['guardian_aspis_guardian_bronze_gatekeeper'] },
  { baseId: 'linothorax', id: 'linothorax', name: 'Linen Cuirass', description: 'Layered linen and leather cut for a mobile fighter.', type: 'ARMOR', value: 3, armorWeight: 'LIGHT', icon: '▧', tags: ['ARMOR'], requiredLevel: 1, legacyIds: ['leather_armor'] },
  { baseId: 'bronze_cuirass', id: 'bronze_cuirass', name: 'Bronze Cuirass', description: 'A fitted bronze breastplate with a restrained shoulder guard.', type: 'ARMOR', value: 5, armorWeight: 'MEDIUM', icon: '▧', tags: ['ARMOR'], requiredLevel: 1, legacyIds: ['chainmail'] },
  { baseId: 'cretan_pelt', id: 'cretan_pelt', name: 'Cretan Rat Pelt', description: 'A tough pelt from a cave scavenger of the old palace.', type: 'ARMOR', value: 2, armorWeight: 'LIGHT', icon: '▧', tags: ['ARMOR'], requiredLevel: 1, legacyIds: ['tough_rat_hide'] },
  { baseId: 'greaves', id: 'greaves', name: 'Bronze Greaves', description: 'Light bronze guards shaped for a long descent.', type: 'ARMOR', value: 2, armorWeight: 'LIGHT', icon: '▤', tags: ['ARMOR'], requiredLevel: 1 },
  { baseId: 'lamia_veil', id: 'lamia_veil', name: 'Lamia’s Veil', description: 'Water-dark linen that turns aside a little of the Cistern’s chill.', type: 'ARMOR', value: 6, armorWeight: 'LIGHT', icon: '▧', tags: ['ARMOR'], requiredLevel: 1, legacyIds: ['lamia_veil_guardian_lamia_cistern'] },
  { baseId: 'laurel_circlet', id: 'laurel_circlet', name: 'Laurel Circlet', description: 'A narrow bronze circlet threaded with dry laurel leaves.', type: 'ACCESSORY', value: 2, statBonus: 'INT', icon: '⌘', tags: ['ACCESSORY'], requiredLevel: 1 },
  { baseId: 'ares_votive', id: 'ares_votive', name: 'Ares’ Bronze Votive', description: 'A rare bronze charm taken from the Altar of Ares.', type: 'ACCESSORY', value: 4, statBonus: 'STR', icon: '◇', tags: ['ACCESSORY'], requiredLevel: 1 },
  { baseId: 'chthonic_seal', id: 'chthonic_seal', name: 'Chthonic Seal', description: 'A cold seal that sharpens the bearer’s resolve.', type: 'ACCESSORY', value: 3, statBonus: 'STR', icon: '◇', tags: ['ACCESSORY'], requiredLevel: 1, legacyIds: ['bone_charm'] },
  { baseId: 'threadbound_seal', id: 'threadbound_seal', name: 'Threadbound Seal', description: 'A chthonic seal that steadies the mind against curses.', type: 'ACCESSORY', value: 7, statBonus: 'INT', icon: '⌘', tags: ['ACCESSORY'], requiredLevel: 1, legacyIds: ['threadbound_seal_guardian_threadbound_warden'] },
  { baseId: 'serpent_ring', id: 'serpent_ring', name: 'Serpent-Coil Ring', description: 'A bronze coil wrapped around a green glass bead.', type: 'ACCESSORY', value: 2, statBonus: 'DEX', icon: '◌', tags: ['ACCESSORY', 'RING'], requiredLevel: 1 },
  { baseId: 'bronze_signet', id: 'bronze_signet', name: 'Bronze Signet', description: 'A heavy signet stamped with the palace maze.', type: 'ACCESSORY', value: 2, statBonus: 'STR', icon: '◇', tags: ['ACCESSORY', 'RING'], requiredLevel: 1 },
  { baseId: 'threaded_amulet', id: 'threaded_amulet', name: 'Threaded Amulet', description: 'A small clay charm bound with a red labyrinth thread.', type: 'ACCESSORY', value: 3, statBonus: 'MP', icon: '⌘', tags: ['ACCESSORY', 'AMULET'], requiredLevel: 1 },
  { baseId: 'serpent_fang', id: 'serpent_fang', name: 'Serpent Fang', description: 'A curved ritual kopis that cuts cleanly through venom-soaked linen.', type: 'WEAPON', value: 8, icon: '⌁', visualType: 'dagger', tags: ['WEAPON', 'PHYSICAL', 'MELEE', 'DAGGER'], requiredLevel: 1, legacyIds: ['serpent_fang_guardian_serpent_priestess'] },
  { baseId: 'cyclopean_hammer', id: 'cyclopean_hammer', name: 'Cyclopean Hammer', description: 'A bronze-capped stoneworker’s hammer with a heavy, balanced head.', type: 'WEAPON', value: 10, icon: '⚒', visualType: 'mace', tags: ['WEAPON', 'PHYSICAL', 'MELEE', 'TWO_HANDED'], twoHanded: true, requiredLevel: 1, legacyIds: ['cyclopean_hammer_guardian_cyclopean_mason'] },
  { baseId: 'healing_draught', id: 'healing_draught', name: 'Healing Draught', description: 'A bitter herbal drink that restores health.', type: 'POTION', value: 30, consumableEffect: 'HEALTH', icon: '◉', tags: ['CONSUMABLE'], requiredLevel: 1, legacyIds: ['potion_hp', 'room_health'] },
  { baseId: 'nectar_flask', id: 'nectar_flask', name: 'Nectar Flask', description: 'A sacred draught that restores magical focus.', type: 'POTION', value: 30, consumableEffect: 'MANA', icon: '◈', tags: ['CONSUMABLE'], requiredLevel: 1, legacyIds: ['potion_mp', 'room_mana', 'mana_potion'] },
] satisfies readonly ItemBaseDefinition[];

const itemBaseIndex = Object.create(null) as Record<string, ItemBaseDefinition>;
for (const base of ITEM_BASES) itemBaseIndex[base.baseId] = base;
export const ITEM_BASE_BY_ID: Readonly<Record<string, ItemBaseDefinition>> = Object.freeze(itemBaseIndex);

const legacyBaseIndex = Object.create(null) as Record<string, string>;
for (const base of ITEM_BASES) for (const id of base.legacyIds ?? []) legacyBaseIndex[id] = base.baseId;
export const LEGACY_ITEM_BASE_IDS: Readonly<Record<string, string>> = Object.freeze(legacyBaseIndex);

export function getItemBase(baseId: string | undefined): ItemBaseDefinition | undefined {
  return baseId ? ITEM_BASE_BY_ID[baseId] : undefined;
}
