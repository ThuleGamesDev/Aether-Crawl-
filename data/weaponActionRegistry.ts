import { getAbility, type AbilityDefinition } from '../combat/AbilityRegistry';
import { ITEM_BASES, ITEM_BASE_BY_ID, LEGACY_ITEM_BASE_IDS, getItemBase } from './itemBases';
import { isDualWieldLoadout, isFocusItem, isShieldItem } from '../services/equipmentRules';
import type { EquipmentSlot, ItemInstance, PlayerCharacter, WeaponFamily, WeaponVisualType } from '../types';
import type { PixelEffectId } from '../presentation/VFXSystem';

export type HandSlot = Extract<EquipmentSlot, 'mainHand' | 'offHand'>;
export type WeaponAnimationProfile = WeaponFamily | 'SHIELD' | 'FOCUS';
export type WeaponAudioProfile = 'blade' | 'spear' | 'projectile' | 'cast' | 'shield' | 'stoneImpact';

export interface WeaponActionPresentationProfile {
  animationProfile: WeaponAnimationProfile;
  vfxProfile: PixelEffectId;
  audioProfile: WeaponAudioProfile;
}

export interface WeaponActionDefinition extends WeaponActionPresentationProfile {
  abilityId: string;
}

export interface WeaponActionSetDefinition {
  family: WeaponFamily;
  requiredConfiguration: 'MAIN_HAND' | 'EITHER_HAND' | 'UNARMED';
  primary: WeaponActionDefinition;
  secondary: WeaponActionDefinition;
  /** No current canonical item or affix grants a technique, so the live slot remains absent. */
  weaponTechnique?: WeaponActionDefinition;
}

const action = (abilityId: string, animationProfile: WeaponAnimationProfile, vfxProfile: PixelEffectId, audioProfile: WeaponAudioProfile): WeaponActionDefinition =>
  ({ abilityId, animationProfile, vfxProfile, audioProfile });

export const WEAPON_ACTION_SETS: Record<WeaponFamily, WeaponActionSetDefinition> = {
  XIPHOS: {
    family: 'XIPHOS', requiredConfiguration: 'EITHER_HAND',
    primary: action('weapon_xiphos_slash', 'XIPHOS', 'bronze_slash', 'blade'),
    secondary: action('weapon_xiphos_thrust', 'XIPHOS', 'spear_thrust', 'spear'),
  },
  KOPIS: {
    family: 'KOPIS', requiredConfiguration: 'EITHER_HAND',
    primary: action('weapon_kopis_hooking_cut', 'KOPIS', 'bronze_slash', 'blade'),
    secondary: action('weapon_kopis_chop', 'KOPIS', 'bronze_slash', 'blade'),
  },
  DORY: {
    family: 'DORY', requiredConfiguration: 'EITHER_HAND',
    primary: action('weapon_dory_thrust', 'DORY', 'spear_thrust', 'spear'),
    secondary: action('weapon_dory_driving_thrust', 'DORY', 'dory_thrust', 'spear'),
  },
  LABRYS: {
    family: 'LABRYS', requiredConfiguration: 'MAIN_HAND',
    primary: action('weapon_labrys_cleave', 'LABRYS', 'bronze_slash', 'blade'),
    secondary: action('weapon_labrys_smash', 'LABRYS', 'stone_shockwave', 'stoneImpact'),
  },
  BOW: {
    family: 'BOW', requiredConfiguration: 'MAIN_HAND',
    primary: action('weapon_bow_arrow_shot', 'BOW', 'arrow_trail', 'projectile'),
    secondary: action('weapon_bow_charged_arrow', 'BOW', 'arrow_trail', 'projectile'),
  },
  STAFF: {
    family: 'STAFF', requiredConfiguration: 'MAIN_HAND',
    primary: action('weapon_staff_focus_bolt', 'STAFF', 'oracle_spark', 'cast'),
    secondary: action('weapon_staff_invocation', 'STAFF', 'oracle_spark', 'cast'),
  },
  DAGGERS: {
    family: 'DAGGERS', requiredConfiguration: 'EITHER_HAND',
    primary: action('weapon_daggers_quick_stab', 'DAGGERS', 'bronze_slash', 'blade'),
    secondary: action('weapon_daggers_double_cut', 'DAGGERS', 'bronze_slash', 'blade'),
  },
  UNARMED: {
    family: 'UNARMED', requiredConfiguration: 'UNARMED',
    primary: action('weapon_unarmed_fist_strike', 'UNARMED', 'blood_hit', 'blade'),
    secondary: action('weapon_unarmed_heavy_palm', 'UNARMED', 'blood_hit', 'blade'),
  },
  MAUL: {
    family: 'MAUL', requiredConfiguration: 'MAIN_HAND',
    primary: action('weapon_maul_stone_fall', 'MAUL', 'stone_shockwave', 'stoneImpact'),
    secondary: action('weapon_maul_mason_breaker', 'MAUL', 'stone_shockwave', 'stoneImpact'),
  },
};

export const SHIELD_SECONDARY_ACTION = action('offhand_shield_bash', 'SHIELD', 'shield_impact', 'shield');
export const FOCUS_SECONDARY_ACTION = action('offhand_focus_attune', 'FOCUS', 'laurel_light', 'cast');

const profileByAbilityId: Readonly<Record<string, WeaponActionPresentationProfile>> = Object.freeze(
  Object.fromEntries([
    ...Object.values(WEAPON_ACTION_SETS).flatMap(set => [set.primary, set.secondary, ...(set.weaponTechnique ? [set.weaponTechnique] : [])]),
    SHIELD_SECONDARY_ACTION,
    FOCUS_SECONDARY_ACTION,
  ].map(({ abilityId, animationProfile, vfxProfile, audioProfile }) => [abilityId, { animationProfile, vfxProfile, audioProfile }])) as Record<string, WeaponActionPresentationProfile>,
);

export function getWeaponActionPresentation(abilityId: string): WeaponActionPresentationProfile | undefined {
  return profileByAbilityId[abilityId];
}

/** Resolve authored canonical base metadata first. visualType is a documented legacy-only fallback. */
export function getWeaponFamilyForItem(item: ItemInstance | null | undefined): WeaponFamily | null {
  if (!item || item.type !== 'WEAPON') return null;
  const canonicalBaseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  const base = getItemBase(canonicalBaseId);
  const authored = base?.weaponFamily;
  if (authored) return authored;
  // A stale explicit baseId is malformed save data. Do not silently reinterpret it from art metadata.
  if (item.baseId && !base) return null;
  // Legacy saves may have no baseId; their visualType is the only safe authored family hint.
  switch (item.visualType) {
    case 'sword': return 'XIPHOS';
    case 'dagger': return 'DAGGERS';
    case 'spear': return 'DORY';
    case 'axe': return 'LABRYS';
    case 'bow': return 'BOW';
    case 'staff': return 'STAFF';
    case 'mace': return 'MAUL';
    case 'unarmed': return 'UNARMED';
    default: return null;
  }
}

/** Canonical item art follows its authored base; only baseId-less legacy saves trust visualType. */
export function getWeaponVisualForItem(item: ItemInstance | null | undefined): WeaponVisualType {
  if (!item || item.type !== 'WEAPON') return 'unarmed';
  const canonicalBaseId = item.baseId ?? (ITEM_BASE_BY_ID[item.id] ? item.id : LEGACY_ITEM_BASE_IDS[item.id]);
  const base = getItemBase(canonicalBaseId);
  if (base?.type === 'WEAPON' && base.visualType) return base.visualType;
  if (item.baseId) return 'unarmed';
  return item.visualType ?? 'unarmed';
}

export function validateWeaponActionRegistry(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [family, set] of Object.entries(WEAPON_ACTION_SETS) as Array<[WeaponFamily, WeaponActionSetDefinition]>) {
    if (set.family !== family) errors.push(family + ': registry key does not match family.');
    for (const definition of [set.primary, set.secondary, ...(set.weaponTechnique ? [set.weaponTechnique] : [])]) {
      if (!getAbility(definition.abilityId)) errors.push(family + ': missing ability ' + definition.abilityId + '.');
      if (seen.has(definition.abilityId)) errors.push(family + ': duplicate action ' + definition.abilityId + '.');
      seen.add(definition.abilityId);
      if (!profileByAbilityId[definition.abilityId]) errors.push(family + ': missing presentation profile for ' + definition.abilityId + '.');
    }
  }
  for (const base of ITEM_BASES.filter(candidate => candidate.type === 'WEAPON')) {
    if (!base.weaponFamily) errors.push(base.baseId + ': weapon base has no authored weaponFamily.');
    else if (!WEAPON_ACTION_SETS[base.weaponFamily]) errors.push(base.baseId + ': unknown weaponFamily ' + base.weaponFamily + '.');
  }
  if (!getAbility(SHIELD_SECONDARY_ACTION.abilityId)) errors.push('Shield action missing ' + SHIELD_SECONDARY_ACTION.abilityId + '.');
  if (!getAbility(FOCUS_SECONDARY_ACTION.abilityId)) errors.push('Focus action missing ' + FOCUS_SECONDARY_ACTION.abilityId + '.');
  return errors;
}

export function resolveItemWeaponAction(item: ItemInstance | null | undefined, hand: HandSlot, actionSlot: 'PRIMARY' | 'SECONDARY'): {
  ability: AbilityDefinition;
  profile: WeaponActionPresentationProfile;
  family: WeaponFamily;
} | null {
  const family = getWeaponFamilyForItem(item);
  if (!family) return null;
  const set = WEAPON_ACTION_SETS[family];
  if (set.requiredConfiguration === 'MAIN_HAND' && hand !== 'mainHand') return null;
  const definition = actionSlot === 'PRIMARY' ? set.primary : set.secondary;
  const ability = getAbility(definition.abilityId);
  const profile = profileByAbilityId[definition.abilityId];
  if (!ability || !profile) return null;
  return { ability, profile, family };
}

export function isActionLoadoutDualWield(player: PlayerCharacter): boolean {
  return isDualWieldLoadout(player.equipment);
}

export function isShieldOffhand(player: PlayerCharacter): boolean {
  return isShieldItem(player.equipment.offHand);
}

export function isFocusOffhand(player: PlayerCharacter): boolean {
  return isFocusItem(player.equipment.offHand);
}

