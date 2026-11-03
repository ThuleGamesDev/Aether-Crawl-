import { getAbility, type AbilityDefinition } from '../combat/AbilityRegistry';
import { getClassSkillKit } from '../data/classSkillKits';
import {
  FOCUS_SECONDARY_ACTION, SHIELD_SECONDARY_ACTION, WEAPON_ACTION_SETS,
  getWeaponActionPresentation, getWeaponFamilyForItem, isActionLoadoutDualWield,
  isFocusOffhand, isShieldOffhand, resolveItemWeaponAction,
  type HandSlot, type WeaponActionPresentationProfile, type WeaponAnimationProfile,
} from '../data/weaponActionRegistry';
import { getRankedAbility, getSkillRank, getClassSkillUnlockLevel, isClassSkillSlotUnlocked } from '../player/SkillProgression';
import type { PlayerCharacter, WeaponFamily } from '../types';

export type ResolvedWeaponFamily = WeaponFamily | 'SHIELD' | 'FOCUS';

export interface ResolvedWeaponAction extends WeaponActionPresentationProfile {
  source: 'WEAPON' | 'OFFHAND';
  actionSlot: 'PRIMARY' | 'SECONDARY' | 'TECHNIQUE';
  abilityId: string;
  ability: AbilityDefinition;
  family: ResolvedWeaponFamily;
  weaponSlot: HandSlot;
  sourceItemInstanceId: string | null;
  alternatesHand: boolean;
}

export interface ResolvedClassSkill {
  source: 'CLASS_SKILL';
  abilityId: string;
  ability: AbilityDefinition;
  slot: 1 | 2 | 3 | 4;
  rank: number;
  unlocked: boolean;
  unlockLevel: number;
  role: string;
  description: string;
}

export interface ResolvedActionLoadout {
  primary: ResolvedWeaponAction;
  secondary: ResolvedWeaponAction;
  weaponTechnique: ResolvedWeaponAction | null;
  classSkills: ResolvedClassSkill[];
}

function makeWeaponAction(
  abilityId: string,
  profile: WeaponActionPresentationProfile,
  family: ResolvedWeaponFamily,
  hand: HandSlot,
  itemId: string | null,
  source: ResolvedWeaponAction['source'] = 'WEAPON',
  actionSlot: ResolvedWeaponAction['actionSlot'] = 'PRIMARY',
  alternatesHand = false,
): ResolvedWeaponAction | null {
  const ability = getAbility(abilityId);
  if (!ability) return null;
  return { ...profile, source, actionSlot, abilityId, ability, family, weaponSlot: hand, sourceItemInstanceId: itemId, alternatesHand };
}

function resolveFamilyAction(
  player: PlayerCharacter,
  hand: HandSlot,
  actionSlot: 'PRIMARY' | 'SECONDARY',
  fallbackFamily: WeaponFamily,
  alternatesHand = false,
): ResolvedWeaponAction {
  const item = player.equipment[hand];
  const resolved = resolveItemWeaponAction(item, hand, actionSlot);
  const family = resolved?.family ?? fallbackFamily;
  const abilityId = resolved?.ability.id ?? WEAPON_ACTION_SETS[family][actionSlot.toLowerCase() as 'primary' | 'secondary'].abilityId;
  const profile = resolved?.profile ?? getWeaponActionPresentation(abilityId);
  const action = profile && makeWeaponAction(abilityId, profile, family, hand, item?.instanceId ?? null, 'WEAPON', actionSlot, alternatesHand);
  if (!action) {
    const fallback = WEAPON_ACTION_SETS.UNARMED;
    const fallbackDefinition = actionSlot === 'PRIMARY' ? fallback.primary : fallback.secondary;
    const fallbackProfile = getWeaponActionPresentation(fallbackDefinition.abilityId)!;
    return makeWeaponAction(fallbackDefinition.abilityId, fallbackProfile, 'UNARMED', 'mainHand', null, 'WEAPON', actionSlot, false)!;
  }
  return action;
}

/** The single authority for basic attacks, off-hand actions and all four class skill slots. */
export function resolveActionLoadout(player: PlayerCharacter, preferredPrimaryHand: HandSlot = 'mainHand'): ResolvedActionLoadout {
  const dualWield = isActionLoadoutDualWield(player);
  const primaryHand = dualWield ? preferredPrimaryHand : 'mainHand';
  const primary = resolveFamilyAction(player, primaryHand, 'PRIMARY', 'UNARMED', dualWield);

  let secondary: ResolvedWeaponAction;
  if (isShieldOffhand(player)) {
    const item = player.equipment.offHand;
    secondary = makeWeaponAction(SHIELD_SECONDARY_ACTION.abilityId, SHIELD_SECONDARY_ACTION, 'SHIELD', 'offHand', item?.instanceId ?? null, 'WEAPON', 'SECONDARY')!;
  } else if (isFocusOffhand(player)) {
    const item = player.equipment.offHand;
    secondary = makeWeaponAction(FOCUS_SECONDARY_ACTION.abilityId, FOCUS_SECONDARY_ACTION, 'FOCUS', 'offHand', item?.instanceId ?? null, 'OFFHAND', 'SECONDARY')!;
  } else if (player.equipment.offHand?.type === 'WEAPON' && dualWield) {
    secondary = resolveFamilyAction(player, 'offHand', 'SECONDARY', 'UNARMED');
  } else {
    secondary = resolveFamilyAction(player, 'mainHand', 'SECONDARY', 'UNARMED');
  }

  const kit = getClassSkillKit(player.classId);
  const classSkills: ResolvedClassSkill[] = (kit?.skills ?? []).map(definition => {
    const ability = getAbility(definition.abilityId)!;
    const rank = getSkillRank(player, definition.abilityId);
    return {
      source: 'CLASS_SKILL',
      abilityId: definition.abilityId,
      ability: rank > 0 ? getRankedAbility(player, definition.abilityId) ?? ability : ability,
      slot: definition.slot,
      rank,
      unlocked: isClassSkillSlotUnlocked(player, definition.slot),
      unlockLevel: getClassSkillUnlockLevel(player.classId, definition.slot) ?? definition.unlockLevel,
      role: definition.role,
      description: definition.description,
    };
  });

  const techniqueDefinition = getWeaponFamilyForItem(player.equipment.mainHand)
    ? WEAPON_ACTION_SETS[getWeaponFamilyForItem(player.equipment.mainHand)!].weaponTechnique
    : undefined;
  const weaponTechnique = techniqueDefinition
    ? makeWeaponAction(techniqueDefinition.abilityId, techniqueDefinition, getWeaponFamilyForItem(player.equipment.mainHand)!, 'mainHand', player.equipment.mainHand?.instanceId ?? null, 'WEAPON', 'TECHNIQUE')
    : null;

  return { primary, secondary, weaponTechnique, classSkills };
}

/** The animation profile stays attached to the resolved ability, even while an attack is in flight. */
export function getResolvedAnimationProfile(action: ResolvedWeaponAction | ResolvedClassSkill | null): WeaponAnimationProfile | 'CLASS_SKILL' | undefined {
  if (!action) return undefined;
  return action.source === 'CLASS_SKILL' ? 'CLASS_SKILL' : action.animationProfile;
}

