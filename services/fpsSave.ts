import type { ClassPassiveState, FloorState, ItemInstance, LegacyPlayerCharacter, PlayerCharacter, WorldEnemy, WorldLootDrop } from '../types';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { isWorldSolid } from '../world/CollisionWorld';
import type { PlayerCombatSaveState } from '../player/PlayerCombat';
import { isValidFloorState } from './dungeonSave';
import { CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { getClassSkillKit } from '../data/classSkillKits';
import { calculateDerivedStats } from '../player/DerivedStats';
import { getItemBase } from '../data/itemBases';
import { getClassSkill } from '../data/classSkillKits';
import { isValidEffectiveActionSpeedMultiplier } from '../combat/actionSpeed';
import { isDualWieldLoadout, isTwoHandedItem, validateEquipmentLoadout } from './equipmentRules';
import { getEnemyAttackSet, LEGACY_ENEMY_ATTACK_ALIASES } from '../data/enemyAttacks';
import { isMazeLawId } from '../data/mazeLaws';

export const FPS_SAVE_KEY = 'aether_crawl_fps_r1_save_v1';
export const FPS_SAVE_VERSION = 1;

export interface FPSRunSave {
  version: 1;
  savedAt: number;
  /** The standalone R1 envelope and legacy R1–R4 maze saves retain the four-slot schema. */
  player: LegacyPlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  loot: WorldLootDrop[];
  combat?: PlayerCombatSaveState;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function saveFPSGame(save: Omit<FPSRunSave, 'version' | 'savedAt'>, storage?: KeyValueStorage): boolean {
  try {
    const target = storage ?? defaultStorage();
    if (!target) return false;
    const envelope: FPSRunSave = { ...save, version: FPS_SAVE_VERSION, savedAt: Date.now() };
    target.setItem(FPS_SAVE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadFPSGame(storage?: KeyValueStorage): { save: FPSRunSave | null; invalid: boolean } {
  const target = storage ?? defaultStorage();
  if (!target) return { save: null, invalid: true };
  let raw: string | null;
  try { raw = target.getItem(FPS_SAVE_KEY); }
  catch { return { save: null, invalid: true }; }
  if (!raw) return { save: null, invalid: false };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isFPSRunSave(value)) return { save: null, invalid: true };
    return { save: value, invalid: false };
  } catch {
    return { save: null, invalid: true };
  }
}

export function hasFPSGame(storage?: KeyValueStorage): boolean {
  return loadFPSGame(storage).save !== null;
}

function defaultStorage(): KeyValueStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export function isFPSRunSave(value: unknown, allowDerivedCaps = false, requireBaseId = false, equipmentSchema: 'legacy' | 'canonical' = 'legacy'): value is FPSRunSave {
  if (!isRecord(value) || value.version !== FPS_SAVE_VERSION || !Number.isFinite(value.savedAt)) return false;
  if (!isPlayerCharacter(value.player, allowDerivedCaps, requireBaseId, equipmentSchema) || !isDungeonWorld(value.world)) return false;
  if (!Array.isArray(value.enemies) || !value.enemies.every(isWorldEnemy)) return false;
  if (!Array.isArray(value.loot) || !value.loot.every((drop: unknown) => isWorldLoot(drop, requireBaseId))) return false;
  if (value.combat !== undefined && !isPlayerCombatSaveState(value.combat)) return false;
  if (equipmentSchema === 'canonical' && value.combat?.action?.weaponSlot === 'offHand' && !isDualWieldLoadout(value.player.equipment as PlayerCharacter['equipment'])) return false;
  if (!isPositionInDungeon(value.world, value.player.position) || !value.enemies.every(enemy => isPositionInDungeon(value.world, enemy.position)) || !value.loot.every(drop => isPositionInDungeon(value.world, drop.position))) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPlayerCharacter(value: unknown, allowDerivedCaps = false, requireBaseId = false, equipmentSchema: 'legacy' | 'canonical' = 'legacy'): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (!['BARBARIAN', 'PALADIN', 'SORCERER', 'ROGUE', 'RANGER', 'CLERIC', 'MONK', 'NECROMANCER'].includes(value.classId)) return false;
  if (!isRecord(value.position) || !Number.isFinite(value.position.x) || !Number.isFinite(value.position.y) || !Number.isFinite(value.position.z)) return false;
  if (!isRecord(value.rotation) || !Number.isFinite(value.rotation.yaw) || !Number.isFinite(value.rotation.pitch) || Math.abs(value.rotation.pitch) > 1.4) return false;
  if (!isRecord(value.stats)) return false;
  const statValues = ['hp', 'maxHp', 'mp', 'maxMp', 'str', 'dex', 'int', 'xp', 'level', 'damageBonus', 'armor'];
  if (!statValues.every(key => Number.isFinite(value.stats[key]))) return false;
  if (value.stats.baseMaxStamina !== undefined && (!Number.isFinite(value.stats.baseMaxStamina) || value.stats.baseMaxStamina < 1 || value.stats.baseMaxStamina > 100_000)) return false;
  if (value.stats.stamina !== undefined && (!Number.isFinite(value.stats.stamina) || value.stats.stamina < 0 || value.stats.stamina > 100_000)) return false;
  if (value.stats.staminaRegenDelaySeconds !== undefined && (!Number.isFinite(value.stats.staminaRegenDelaySeconds) || value.stats.staminaRegenDelaySeconds < 0 || value.stats.staminaRegenDelaySeconds > 10)) return false;
  if (value.stats.maxHp <= 0 || value.stats.hp < 0 || value.stats.hp > value.stats.maxHp || value.stats.maxMp < 0 || value.stats.mp < 0 || value.stats.mp > value.stats.maxMp || value.stats.level < 1 || !Number.isInteger(value.stats.level) || value.stats.xp < 0) return false;
  if (!Array.isArray(value.inventory) || !value.inventory.every((item: unknown) => isItemInstance(item, requireBaseId))) return false;
  if (!isRecord(value.equipment)) return false;
  if (equipmentSchema === 'canonical') {
    if (!validateEquipmentLoadout(value.equipment)) return false;
    if (!Object.values(value.equipment).every(item => item === null || isItemInstance(item, requireBaseId))) return false;
  } else {
    const slotTypes: Record<string, string> = { weapon: 'WEAPON', armor: 'ARMOR', offhand: 'SHIELD', accessory: 'ACCESSORY' };
    if (Object.keys(value.equipment).length !== 4 || !Object.entries(slotTypes).every(([slot, type]) => slot in value.equipment
      && (value.equipment[slot] === null || isItemInstance(value.equipment[slot], requireBaseId) && value.equipment[slot].type === type))) return false;
  }
  const classId = value.classId as PlayerCharacter['classId'];
  const allowedSkills = new Set(getClassSkillKit(classId)?.skills.map(skill => skill.abilityId) ?? CLASS_ABILITY_LOADOUT[classId].skillSlots.filter((id): id is string => Boolean(id)));
  if (!Array.isArray(value.skills) || value.skills.length > 4
    || !value.skills.every(skill => isRecord(skill) && typeof skill.abilityId === 'string' && allowedSkills.has(skill.abilityId)
      && Number.isInteger(skill.rank) && skill.rank >= 1 && skill.rank <= 5 && Boolean(getAbility(skill.abilityId))
      && (getClassSkill(classId, skill.abilityId)?.unlockLevel ?? 1) <= value.stats.level)
    || new Set(value.skills.map((skill: { abilityId: string }) => skill.abilityId)).size !== value.skills.length) return false;
  if (value.skillPoints !== undefined && (!Number.isInteger(value.skillPoints) || value.skillPoints < 0 || value.skillPoints > 1000)) return false;
  if (value.skillProgressionVersion !== undefined && value.skillProgressionVersion !== 1) return false;
  if (value.classPassiveState !== undefined && !isClassPassiveState(value.classPassiveState, classId)) return false;
  if (!Array.isArray(value.statusEffects) || value.statusEffects.length > 8 || !value.statusEffects.every(status => isRecord(status) && typeof status.id === 'string' && typeof status.statusId === 'string' && Number.isFinite(status.durationSeconds) && status.durationSeconds >= 0 && Number.isFinite(status.magnitude) && (status.tickRemainingSeconds === undefined || Number.isFinite(status.tickRemainingSeconds) && status.tickRemainingSeconds >= 0))) return false;
  if (allowDerivedCaps) {
    if (![value.stats.baseMaxHp, value.stats.baseMaxMp, value.stats.baseArmor].every(Number.isFinite) || value.stats.baseMaxHp <= 0 || value.stats.baseMaxMp < 0 || value.stats.baseArmor < 0) return false;
    const derived = calculateDerivedStats(value as PlayerCharacter);
    if (Math.abs(value.stats.maxHp - derived.maxHealth) > 0.000001 || Math.abs(value.stats.maxMp - derived.maxMana) > 0.000001 || Math.abs(value.stats.armor - derived.armor) > 0.000001) return false;
    if (value.stats.hp > derived.maxHealth || value.stats.mp > derived.maxMana) return false;
    if (value.stats.stamina !== undefined && value.stats.stamina > derived.maxStamina) return false;
    const equipped = Object.values(value.equipment) as Array<ItemInstance | null>;
    if (equipped.some(item => item && item.quantity !== 1)) return false;
    if (equipmentSchema === 'legacy') {
      const legacyEquipment = value.equipment as Record<string, ItemInstance | null>;
      if (isTwoHandedItem(legacyEquipment.weapon) && legacyEquipment.offhand) return false;
    }
  }
  return true;
}

function isDungeonWorld(value: unknown): value is DungeonWorldState {
  if (!isRecord(value) || !Number.isFinite(value.level) || !Number.isFinite(value.seed)) return false;
  if (!Number.isInteger(value.level) || value.level < 1 || !Number.isInteger(value.worldRevision) || value.worldRevision < 1) return false;
  const biomes = ['dungeon', 'moss', 'catacombs', 'obsidian', 'frost', 'gilded'];
  if (!biomes.includes(value.biome)) return false;
  if (!Array.isArray(value.map) || value.map.length < 3 || value.map.length > 64) return false;
  const width = Array.isArray(value.map[0]) ? value.map[0].length : 0;
  if (width < 3 || width > 64 || !value.map.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((tile: unknown) => typeof tile === 'number' && Number.isInteger(tile) && tile >= 0 && tile <= 5))) return false;
  if (!Array.isArray(value.decorations) || value.decorations.length !== value.map.length || !value.decorations.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((tile: unknown) => Number.isInteger(tile)))) return false;
  if (!Array.isArray(value.explored) || value.explored.length !== value.map.length || !value.explored.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((cell: unknown) => typeof cell === 'boolean')) || !isRecord(value.floor)) return false;
  const floor = value.floor as FloorState;
  return floor.level === value.level && floor.biome === value.biome && isValidFloorState(floor, value.map);
}

function isWorldEnemy(value: unknown): value is WorldEnemy {
  const states = ['IDLE', 'ALERT', 'AGGRO', 'APPROACH', 'CHASE', 'REPOSITION', 'RETREAT', 'ATTACK_WINDUP', 'ATTACK_ACTIVE', 'ATTACK', 'RECOVER', 'HURT', 'STAGGER', 'DEAD'];
  return isRecord(value) && typeof value.id === 'string' && typeof value.definitionId === 'string' && typeof value.name === 'string' && typeof value.visualId === 'string'
    && isRecord(value.position) && Number.isFinite(value.position.x) && Number.isFinite(value.position.y) && Number.isFinite(value.position.z)
    && Number.isFinite(value.health) && Number.isFinite(value.maxHealth) && value.maxHealth > 0 && value.health >= 0 && value.health <= value.maxHealth
    && Number.isFinite(value.damage) && value.damage >= 0 && Number.isFinite(value.xpReward) && value.xpReward >= 0
    && (value.collisionRadius === undefined || Number.isFinite(value.collisionRadius) && value.collisionRadius > 0)
    && states.includes(value.state) && Number.isFinite(value.stateTimer) && value.stateTimer >= 0 && Number.isFinite(value.attackCooldown) && value.attackCooldown >= 0
    && Number.isFinite(value.attackRange) && value.attackRange > 0 && Number.isFinite(value.attackTelegraphSeconds) && value.attackTelegraphSeconds >= 0
    && (value.phase === undefined || Number.isInteger(value.phase) && value.phase >= 1 && value.phase <= 2)
    && (value.phaseTransitioned === undefined || typeof value.phaseTransitioned === 'boolean')
    && ((value.poise === undefined && value.maxPoise === undefined) || Number.isFinite(value.poise) && Number.isFinite(value.maxPoise) && value.maxPoise > 0 && value.maxPoise <= 1000 && value.poise >= 0 && value.poise <= value.maxPoise)
    && (value.poiseRecoveryDelaySeconds === undefined || Number.isFinite(value.poiseRecoveryDelaySeconds) && value.poiseRecoveryDelaySeconds >= 0 && value.poiseRecoveryDelaySeconds <= 10)
    && (value.poiseBreakRecoverySeconds === undefined || Number.isFinite(value.poiseBreakRecoverySeconds) && value.poiseBreakRecoverySeconds >= 0 && value.poiseBreakRecoverySeconds <= 10)
    && (value.staggerImmunitySeconds === undefined || Number.isFinite(value.staggerImmunitySeconds) && value.staggerImmunitySeconds >= 0 && value.staggerImmunitySeconds <= 10)
    && (value.phaseTransitionLockSeconds === undefined || Number.isFinite(value.phaseTransitionLockSeconds) && value.phaseTransitionLockSeconds >= 0 && value.phaseTransitionLockSeconds <= 5)
    && (value.attackSetId === undefined || typeof value.attackSetId === 'string')
    && (value.activeAttackId === undefined || typeof value.activeAttackId === 'string' && getEnemyAttackSet(value.attackSetId, value.phase ?? 1).some(attack => attack.id === (LEGACY_ENEMY_ATTACK_ALIASES[value.activeAttackId] ?? value.activeAttackId)))
    && (value.activeAttackId === undefined || value.state !== 'ATTACK_WINDUP' || Math.abs(value.attackTelegraphSeconds - getEnemyAttackSet(value.attackSetId, value.phase ?? 1).find(attack => attack.id === (LEGACY_ENEMY_ATTACK_ALIASES[value.activeAttackId] ?? value.activeAttackId))!.windupSeconds) <= 0.000001)
    && (value.behaviorRole === undefined || ['CHASER', 'TANK', 'SKIRMISHER', 'CONTROLLER', 'HEAVY', 'SUPPORT'].includes(value.behaviorRole))
    && (value.statusEffects === undefined || Array.isArray(value.statusEffects) && value.statusEffects.length <= 8 && value.statusEffects.every((status: unknown) => isRecord(status) && typeof status.id === 'string' && typeof status.statusId === 'string' && Number.isFinite(status.durationSeconds) && status.durationSeconds >= 0 && Number.isFinite(status.magnitude) && (status.tickRemainingSeconds === undefined || Number.isFinite(status.tickRemainingSeconds) && status.tickRemainingSeconds >= 0)))
    && (value.pathRefreshSeconds === undefined || Number.isFinite(value.pathRefreshSeconds) && value.pathRefreshSeconds >= 0)
    && (value.repositionCooldownSeconds === undefined || Number.isFinite(value.repositionCooldownSeconds) && value.repositionCooldownSeconds >= 0)
    && (value.pathTargetCell === undefined || isRecord(value.pathTargetCell) && Number.isInteger(value.pathTargetCell.x) && Number.isInteger(value.pathTargetCell.y))
    && (value.pathStep === undefined || isRecord(value.pathStep) && Number.isInteger(value.pathStep.x) && Number.isInteger(value.pathStep.y))
    && (value.telegraphPosition === undefined || isRecord(value.telegraphPosition) && Number.isFinite(value.telegraphPosition.x) && Number.isFinite(value.telegraphPosition.y) && Number.isFinite(value.telegraphPosition.z))
    && (value.lootTier === undefined || ['NORMAL', 'ELITE', 'GUARDIAN'].includes(value.lootTier))
    && (value.lawId === undefined || isMazeLawId(value.lawId))
    && (value.lawRewardBaseId === undefined || typeof value.lawRewardBaseId === 'string' && Boolean(getItemBase(value.lawRewardBaseId)))
    && (value.attackCooldownMultiplier === undefined || Number.isFinite(value.attackCooldownMultiplier) && value.attackCooldownMultiplier >= 0.7 && value.attackCooldownMultiplier <= 1)
    && typeof value.rewardGranted === 'boolean' && typeof value.isBoss === 'boolean';
}

function isWorldLoot(value: unknown, requireBaseId = false): value is WorldLootDrop {
  return isRecord(value) && typeof value.id === 'string' && isRecord(value.position) && Number.isFinite(value.position.x)
    && Number.isFinite(value.position.y) && Number.isFinite(value.position.z) && isItemInstance(value.item, requireBaseId);
}

function isItemInstance(value: unknown, requireBaseId = false): value is ItemInstance {
  const rarities = ['COMMON', 'MAGIC', 'RARE', 'UNIQUE'];
  const types = ['WEAPON', 'ARMOR', 'POTION', 'SCROLL', 'SHIELD', 'ACCESSORY', 'MATERIAL'];
  return isRecord(value) && typeof value.instanceId === 'string' && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.description === 'string' && types.includes(value.type) && Number.isFinite(value.value) && value.value >= 0
    && Number.isInteger(value.quantity) && value.quantity >= 1 && Number.isInteger(value.itemLevel) && value.itemLevel >= 1
    && rarities.includes(value.rarity) && Array.isArray(value.affixes)
    && (!requireBaseId || typeof value.baseId === 'string' && value.baseId.length > 0)
    && (value.baseId === undefined || typeof value.baseId === 'string' && value.baseId.length > 0)
    && (!value.baseId || !getItemBase(value.baseId) || getItemBase(value.baseId)!.type === value.type)
    && (value.consumableEffect === undefined || value.consumableEffect === 'HEALTH' || value.consumableEffect === 'MANA' || value.consumableEffect === 'ANTIDOTE')
    && value.affixes.every(affix => isRecord(affix) && typeof affix.id === 'string' && Number.isFinite(affix.value) && (affix.tier === undefined || Number.isInteger(affix.tier) && affix.tier >= 1))
    && (value.uniqueEffectId === undefined || typeof value.uniqueEffectId === 'string');
}

function isPlayerCombatSaveState(value: unknown): value is PlayerCombatSaveState {
  const phases = ['WINDUP', 'ACTIVE', 'RECOVERY'];
  return isRecord(value) && isRecord(value.cooldowns)
    && Object.entries(value.cooldowns).every(([id, cooldown]) => Boolean(getAbility(id)) && Number.isFinite(cooldown) && cooldown >= 0)
    && (value.action === null || isRecord(value.action) && typeof value.action.abilityId === 'string' && Boolean(getAbility(value.action.abilityId))
      && phases.includes(value.action.phase) && Number.isFinite(value.action.remainingSeconds) && value.action.remainingSeconds >= 0
      && Number.isFinite(value.action.damageMultiplier) && value.action.damageMultiplier > 0
      && (value.action.speedMultiplier === undefined || isValidEffectiveActionSpeedMultiplier(value.action.speedMultiplier))
      && (value.action.hitIndex === undefined || Number.isInteger(value.action.hitIndex) && value.action.hitIndex >= 0 && value.action.hitIndex <= 8)
      && (value.action.hitCount === undefined || Number.isInteger(value.action.hitCount) && value.action.hitCount >= 1 && value.action.hitCount <= 8)
      && (value.action.hitIndex === undefined || value.action.hitCount === undefined || value.action.hitIndex <= value.action.hitCount)
      && (value.action.nextHitSeconds === undefined || Number.isFinite(value.action.nextHitSeconds) && value.action.nextHitSeconds >= 0 && value.action.nextHitSeconds <= 2)
      && (value.action.classPassiveResolved === undefined || typeof value.action.classPassiveResolved === 'boolean')
      && (value.action.classPassiveMultiplier === undefined || Number.isFinite(value.action.classPassiveMultiplier) && value.action.classPassiveMultiplier >= 0.25 && value.action.classPassiveMultiplier <= 2.5)
      && (value.action.classMeleeRecorded === undefined || typeof value.action.classMeleeRecorded === 'boolean')
      && (value.action.weaponSlot === undefined || value.action.weaponSlot === 'mainHand' || value.action.weaponSlot === 'offHand'))
    && (value.nextMeleeWeaponSlot === undefined || value.nextMeleeWeaponSlot === 'mainHand' || value.nextMeleeWeaponSlot === 'offHand');
}

function isClassPassiveState(value: unknown, classId: PlayerCharacter['classId']): value is ClassPassiveState {
  if (!isRecord(value) || !Number.isInteger(value.stacks) || !Number.isFinite(value.remainingSeconds)
    || !Number.isFinite(value.cooldownRemaining) || !Number.isInteger(value.charges)) return false;
  if (classId === 'BARBARIAN') return value.passiveId === 'war_momentum' && value.stacks >= 0 && value.stacks <= 5
    && value.remainingSeconds >= 0 && value.remainingSeconds <= 3 && value.cooldownRemaining === 0 && value.charges === 0;
  if (classId === 'PALADIN') return value.passiveId === 'unbroken_line' && value.stacks === 0
    && value.remainingSeconds >= 0 && value.remainingSeconds <= 3 && value.cooldownRemaining >= 0 && value.cooldownRemaining <= 4
    && (value.charges === 0 || value.charges === 1) && (value.charges === 0 || value.remainingSeconds > 0);
  if (classId === 'SORCERER') return value.passiveId === 'omen_weaving' && value.stacks === 0 && value.remainingSeconds === 0
    && value.cooldownRemaining === 0 && value.charges === 0
    && (value.lastSchool === null || value.lastSchool === 'FIRE' || value.lastSchool === 'LIGHTNING' || value.lastSchool === 'ARCANE');
  if (classId === 'ROGUE') return value.passiveId === 'opportunist' && value.stacks === 0
    && value.remainingSeconds >= 0 && value.remainingSeconds <= 2.5 && value.cooldownRemaining >= 0 && value.cooldownRemaining <= 2
    && (value.charges === 0 || value.charges === 1) && (value.charges === 0 || value.remainingSeconds > 0);
  if (classId === 'RANGER') return value.passiveId === 'marked_prey' && (value.targetId === null || typeof value.targetId === 'string' && value.targetId.length <= 120)
    && value.stacks >= 0 && value.stacks <= 3 && value.remainingSeconds >= 0 && value.remainingSeconds <= 4
    && value.cooldownRemaining === 0 && value.charges === 0 && (value.stacks === 0 || value.targetId !== null && value.remainingSeconds > 0);
  if (classId === 'CLERIC') return value.passiveId === 'measured_remedy' && value.stacks === 0 && value.remainingSeconds === 0
    && value.cooldownRemaining >= 0 && value.cooldownRemaining <= 10 && value.charges === 0;
  if (classId === 'MONK') return value.passiveId === 'flow_state' && value.stacks >= 0 && value.stacks <= 5
    && value.remainingSeconds >= 0 && value.remainingSeconds <= 1.6 && value.cooldownRemaining === 0 && value.charges === 0
    && (value.stacks === 0 || value.remainingSeconds > 0);
  if (classId === 'NECROMANCER') return value.passiveId === 'soul_tribute' && value.stacks >= 0 && value.stacks <= 3
    && value.remainingSeconds >= 0 && value.remainingSeconds <= 4 && value.cooldownRemaining >= 0 && value.cooldownRemaining <= 10
    && (value.charges === 0 || value.charges === 1) && (value.charges === 0 || value.remainingSeconds > 0 && value.stacks === 0);
  return false;
}

function isPositionInDungeon(world: DungeonWorldState, position: { x: number; y: number; z: number }): boolean {
  if (position.x < 0 || position.z < 0 || position.z >= world.map.length || position.x >= (world.map[0]?.length ?? 0)) return false;
  return !isWorldSolid(world.map[Math.floor(position.z)]?.[Math.floor(position.x)]);
}
