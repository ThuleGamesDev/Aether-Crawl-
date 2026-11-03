import { CLASS_ABILITY_LOADOUT, getAbility, type AbilityDefinition } from '../combat/AbilityRegistry';
import { getClassSkill, getClassSkillKit, type ClassSkillDefinition } from '../data/classSkillKits';
import type { ClassType, PlayerCharacter, StatusApplication } from '../types';

export const MAX_ACTIVE_SKILL_RANK = 5;
export const SKILL_POINTS_PER_LEVEL = 1;

export interface SkillUpgradeOption {
  abilityId: string;
  name: string;
  action: 'UNLOCK' | 'RANK_UP';
  currentRank: number;
  nextRank: number;
  unlockLevel: number;
  role: string;
  description: string;
}

/** Adds R5A progression without rewriting or discarding the R4B character record. */
export function normalizeSkillProgression(player: PlayerCharacter): PlayerCharacter {
  const kit = getClassSkillKit(player.classId);
  const legacy = player.skillProgressionVersion !== 1;
  const allowed = new Set(kit?.skills.map(skill => skill.abilityId) ?? [CLASS_ABILITY_LOADOUT[player.classId].skill]);
  const seen = new Set<string>();
  const skills = (Array.isArray(player.skills) ? player.skills : []).filter(skill => {
    const valid = allowed.has(skill.abilityId) && Boolean(getAbility(skill.abilityId))
      && Number.isInteger(skill.rank) && skill.rank >= 1 && skill.rank <= MAX_ACTIVE_SKILL_RANK
      && (getClassSkill(player.classId, skill.abilityId)?.unlockLevel ?? 1) <= player.stats.level
      && !seen.has(skill.abilityId);
    if (valid) seen.add(skill.abilityId);
    return valid;
  }).map(skill => ({ ...skill }));
  const starterId = kit?.skills[0].abilityId ?? CLASS_ABILITY_LOADOUT[player.classId].skill;
  if (!skills.some(skill => skill.abilityId === starterId)) skills.unshift({ abilityId: starterId, rank: 1 });
  const legacyPoints = kit ? Math.max(0, player.stats.level - 1) * SKILL_POINTS_PER_LEVEL : 0;
  const skillPoints = legacy
    ? Math.max(0, legacyPoints)
    : Number.isInteger(player.skillPoints) && (player.skillPoints ?? -1) >= 0 ? player.skillPoints! : 0;
  return { ...player, skills, skillPoints, skillProgressionVersion: 1 };
}

export function getSkillRank(player: PlayerCharacter, abilityId: string): number {
  return player.skills.find(skill => skill.abilityId === abilityId)?.rank ?? 0;
}

export function getRankedAbility(player: PlayerCharacter, abilityId: string): AbilityDefinition | undefined {
  const ability = getAbility(abilityId);
  if (!ability) return undefined;
  const rank = Math.max(1, Math.min(MAX_ACTIVE_SKILL_RANK, getSkillRank(player, abilityId) || 1));
  const steps = rank - 1;
  const power = 1 + 0.15 * steps;
  const geometry = 1 + 0.06 * steps;
  const statusPower = 1 + 0.12 * steps;
  const rankStatus = (status: StatusApplication): StatusApplication => ({
    ...status,
    magnitude: Math.min(100, status.magnitude * statusPower),
    durationSeconds: Math.min(12, status.durationSeconds * (1 + 0.05 * steps)),
  });
  return {
    ...ability,
    damage: Math.round(ability.damage * power),
    range: ability.range * geometry,
    ...(ability.radius === undefined ? {} : { radius: ability.radius * geometry }),
    ...(ability.selfEffect ? { selfEffect: {
      ...ability.selfEffect,
      ...(ability.selfEffect.amount === undefined ? {} : { amount: Math.min(1, ability.selfEffect.amount * power) }),
      ...(ability.selfEffect.magnitude === undefined ? {} : { magnitude: Math.min(0.8, ability.selfEffect.magnitude * statusPower) }),
      ...(ability.selfEffect.durationSeconds === undefined ? {} : { durationSeconds: Math.min(12, ability.selfEffect.durationSeconds * (1 + 0.05 * steps)) }),
    } } : {}),
    ...(ability.onHitStatus ? { onHitStatus: rankStatus(ability.onHitStatus) } : {}),
    ...(ability.selfStatuses ? { selfStatuses: ability.selfStatuses.map(rankStatus) } : {}),
    ...(ability.dashDistance === undefined ? {} : { dashDistance: ability.dashDistance * geometry }),
    ...(ability.finisher ? { finisher: { ...ability.finisher, damageMultiplier: Math.min(2.2, ability.finisher.damageMultiplier + 0.1 * steps) } } : {}),
    ...(ability.chain ? { chain: { ...ability.chain, damageMultiplier: Math.min(0.7, ability.chain.damageMultiplier + 0.04 * steps) } } : {}),
  };
}

export function getSkillUpgradeOptions(player: PlayerCharacter): SkillUpgradeOption[] {
  const kit = getClassSkillKit(player.classId);
  if (!kit) return [];
  const options: SkillUpgradeOption[] = [];
  for (const definition of kit.skills) {
    const ability = getAbility(definition.abilityId);
    if (!ability || player.stats.level < definition.unlockLevel) continue;
    const currentRank = getSkillRank(player, definition.abilityId);
    if (currentRank === 0) options.push(optionFor(ability, definition, 'UNLOCK', 0, 1));
    else if (currentRank < MAX_ACTIVE_SKILL_RANK) options.push(optionFor(ability, definition, 'RANK_UP', currentRank, currentRank + 1));
  }
  return options;
}

/** Deterministically rotates a small choice set so later slots are not hidden by early rank-ups. */
export function getSkillUpgradeChoices(player: PlayerCharacter, limit = 3): SkillUpgradeOption[] {
  if ((player.skillPoints ?? 0) <= 0) return [];
  const options = getSkillUpgradeOptions(player);
  if (options.length <= limit) return options;
  const start = Math.abs(player.stats.level * 7 + (player.skillPoints ?? 0) * 3) % options.length;
  return Array.from({ length: limit }, (_, index) => options[(start + index) % options.length]);
}

export function applySkillUpgrade(player: PlayerCharacter, abilityId: string): PlayerCharacter | null {
  if ((player.skillPoints ?? 0) <= 0) return null;
  const option = getSkillUpgradeOptions(player).find(candidate => candidate.abilityId === abilityId);
  if (!option) return null;
  const skills = [...player.skills];
  const index = skills.findIndex(skill => skill.abilityId === abilityId);
  if (index < 0) skills.push({ abilityId, rank: 1 });
  else skills[index] = { ...skills[index], rank: option.nextRank };
  return { ...player, skills, skillPoints: Math.max(0, (player.skillPoints ?? 0) - 1), skillProgressionVersion: 1 };
}

export function isClassSkillSlotUnlocked(player: PlayerCharacter, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) return false;
  const abilityId = getClassSkillKit(player.classId)?.skills.find(skill => skill.slot === slot)?.abilityId;
  return Boolean(abilityId && getSkillRank(player, abilityId) > 0);
}

export function getClassSkillUnlockLevel(classId: ClassType, slot: number): number | null {
  const kit = getClassSkillKit(classId);
  const definition = kit?.skills.find(skill => skill.slot === slot);
  return definition?.unlockLevel ?? null;
}

function optionFor(
  ability: AbilityDefinition,
  definition: ClassSkillDefinition,
  action: SkillUpgradeOption['action'],
  currentRank: number,
  nextRank: number,
): SkillUpgradeOption {
  return { abilityId: ability.id, name: ability.name, action, currentRank, nextRank, unlockLevel: definition.unlockLevel, role: definition.role, description: definition.description };
}
