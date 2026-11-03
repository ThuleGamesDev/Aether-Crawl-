import type { PlayerCharacter, RealtimeStatusId, WorldEnemy } from '../types';
import { getAbilityDamageType, type AbilityDefinition } from './AbilityRegistry';
import { hasLineOfSight } from '../world/CollisionWorld';
import { enemyDamageTakenMultiplier, incomingDamageMultiplier, outgoingDamageMultiplier, statusMagnitude } from './StatusSystem';
import { calculateDerivedStats } from '../player/DerivedStats';
import { getWeaponPowerForSlot } from '../player/DerivedStats';
import type { EquipmentSlot } from '../types';

export function calculatePlayerDamage(player: PlayerCharacter, ability: AbilityDefinition, multiplier = 1, criticalRoll = 1, weaponSlot: Extract<EquipmentSlot, 'mainHand' | 'offHand'> = 'mainHand'): number {
  const derived = calculateDerivedStats(player);
  const statusBonus = player.statusEffects
    .filter(status => status.statusId === 'prepared_damage')
    .reduce((total, status) => total + status.magnitude, 0);
  const damageType = getAbilityDamageType(ability);
  const stat = ability.kind === 'MELEE'
    ? player.classId === 'ROGUE' || player.classId === 'RANGER' || player.classId === 'MONK' ? derived.dexterity : derived.strength
    : damageType === 'SPELL' ? derived.intelligence
      : player.classId === 'ROGUE' || player.classId === 'RANGER' ? derived.dexterity : derived.strength;
  const counterMultiplier = ability.kind === 'MELEE' ? clamp(1 + finite(statusMagnitude(player.statusEffects, 'COUNTER')), 1, 2) : 1;
  const flatDamage = damageType === 'SPELL' ? derived.spellDamageFlat : derived.physicalDamageFlat;
  const damageMultiplier = damageType === 'SPELL' ? derived.spellDamageMultiplier : derived.physicalDamageMultiplier;
  const projectileMultiplier = ability.kind === 'PROJECTILE' ? derived.projectileDamageMultiplier : 1;
  const precisionMultiplier = ability.kind === 'PROJECTILE' ? 1 + Math.min(0.35, statusMagnitude(player.statusEffects, 'PRECISION')) : 1;
  const bloodOathMultiplier = damageType === 'PHYSICAL' ? 1 + Math.min(0.5, Math.max(0, statusMagnitude(player.statusEffects, 'BLOOD_OATH'))) : 1;
  const weaponPower = ability.kind === 'MELEE' ? getWeaponPowerForSlot(player, weaponSlot) : derived.weaponPower;
  const baseDamage = finite(ability.damage) + stat * 0.62 + weaponPower + finite(player.stats.damageBonus) + finite(statusBonus) + flatDamage;
  const critical = Number.isFinite(criticalRoll) && criticalRoll >= 0 && criticalRoll < derived.criticalChance
    ? derived.criticalDamageMultiplier : 1;
  const safeMultiplier = Number.isFinite(multiplier) ? clamp(multiplier, 0.25, 2) : 1;
  const damage = Math.max(0, baseDamage) * safeMultiplier * damageMultiplier * projectileMultiplier * precisionMultiplier * bloodOathMultiplier
    * critical * outgoingDamageMultiplier(player.statusEffects) * counterMultiplier;
  return Math.max(1, Math.round(clamp(damage, 0, 1_000_000)));
}

export function applyEnemyDamage(enemy: WorldEnemy, amount: number): { enemy: WorldEnemy; defeated: boolean } {
  if (enemy.health <= 0 || enemy.state === 'DEAD') return { enemy, defeated: false };
  const guarded = Math.round(Math.max(0, amount) * incomingDamageMultiplier(enemy.statusEffects) * enemyDamageTakenMultiplier(enemy.statusEffects));
  const health = Math.max(0, enemy.health - Math.max(0, Math.floor(guarded)));
  const defeated = health <= 0;
  const phaseLocked = (enemy.phaseTransitionLockSeconds ?? 0) > 0 && enemy.state === 'RECOVER';
  const poiseBreakLocked = (enemy.poiseBreakRecoverySeconds ?? 0) > 0 && enemy.state === 'STAGGER';
  return {
    enemy: { ...enemy, health, state: defeated ? 'DEAD' : phaseLocked ? 'RECOVER' : poiseBreakLocked ? 'STAGGER' : 'HURT', stateTimer: defeated ? 1.1 : phaseLocked ? Math.max(enemy.stateTimer, enemy.phaseTransitionLockSeconds ?? 0) : poiseBreakLocked ? Math.max(enemy.stateTimer, enemy.poiseBreakRecoverySeconds ?? 0) : 0.2 },
    defeated,
  };
}

export function resolveMeleeAttack(
  map: number[][],
  player: PlayerCharacter,
  enemies: WorldEnemy[],
  ability: AbilityDefinition,
  damage: number,
): { enemies: WorldEnemy[]; hitEnemyIds: string[] } {
  const targetIds = new Set(getMeleeTargetIds(map, player, enemies, ability));
  const hitEnemyIds: string[] = [];
  const updated = enemies.map(enemy => {
    if (!targetIds.has(enemy.id)) return enemy;
    const finisher = ability.finisher && enemy.health / Math.max(1, enemy.maxHealth) <= ability.finisher.healthRatio
      ? ability.finisher.damageMultiplier : 1;
    const hit = applyEnemyDamage(enemy, Math.round(damage * finisher));
    hitEnemyIds.push(enemy.id);
    return hit.enemy;
  });
  return { enemies: updated, hitEnemyIds };
}

export function getMeleeTargetIds(map: number[][], player: PlayerCharacter, enemies: WorldEnemy[], ability: AbilityDefinition): string[] {
  const arc = ability.arcRadians ?? 0.9;
  return enemies.filter(enemy => {
    if (enemy.health <= 0 || enemy.state === 'DEAD') return false;
    const dx = enemy.position.x - player.position.x, dz = enemy.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const difference = Math.atan2(Math.sin(angle - player.rotation.yaw), Math.cos(angle - player.rotation.yaw));
    const reach = ability.range + Math.min(0.35, (enemy.collisionRadius ?? 0.28) * 0.4);
    return distance <= reach && Math.abs(difference) <= arc / 2
      && hasLineOfSight(map, player.position.x, player.position.z, enemy.position.x, enemy.position.z, 0.18);
  }).map(enemy => enemy.id);
}

export interface ChainAttackResult {
  enemies: WorldEnemy[];
  hitEnemyIds: string[];
  links: Array<{ fromId: string; toId: string }>;
}

/** Bounded, deterministic follow-up hits through the shared damage and line-of-sight rules. */
export function resolveChainAttack(
  map: number[][],
  enemies: WorldEnemy[],
  initialHitIds: readonly string[],
  maxJumps: number,
  jumpRange: number,
  damage: number,
): ChainAttackResult {
  const initial = initialHitIds.map(id => enemies.find(enemy => enemy.id === id)).filter((enemy): enemy is WorldEnemy => Boolean(enemy));
  if (!initial.length || maxJumps <= 0) return { enemies, hitEnemyIds: [], links: [] };
  const hit = new Set(initialHitIds);
  const hitEnemyIds: string[] = [];
  const links: ChainAttackResult['links'] = [];
  let nextEnemies = enemies;
  let anchor = initial[0];
  for (let jump = 0; jump < Math.min(4, Math.floor(maxJumps)); jump += 1) {
    const candidate = nextEnemies
      .filter(enemy => enemy.health > 0 && enemy.state !== 'DEAD' && !hit.has(enemy.id)
        && Math.hypot(enemy.position.x - anchor.position.x, enemy.position.z - anchor.position.z) <= jumpRange
        && hasLineOfSight(map, anchor.position.x, anchor.position.z, enemy.position.x, enemy.position.z, 0.15))
      .sort((a, b) => Math.hypot(a.position.x - anchor.position.x, a.position.z - anchor.position.z)
        - Math.hypot(b.position.x - anchor.position.x, b.position.z - anchor.position.z) || a.id.localeCompare(b.id))[0];
    if (!candidate) break;
    hit.add(candidate.id);
    const result = applyEnemyDamage(candidate, damage);
    nextEnemies = nextEnemies.map(enemy => enemy.id === candidate.id ? result.enemy : enemy);
    hitEnemyIds.push(candidate.id);
    links.push({ fromId: anchor.id, toId: candidate.id });
    anchor = candidate;
  }
  return { enemies: nextEnemies, hitEnemyIds, links };
}

export function getAreaTargetIds(
  map: number[][],
  centerX: number,
  centerZ: number,
  radius: number,
  enemies: readonly WorldEnemy[],
): string[] {
  return enemies.filter(enemy => enemy.health > 0 && enemy.state !== 'DEAD'
    && Math.hypot(enemy.position.x - centerX, enemy.position.z - centerZ) <= radius + 0.22
    && hasLineOfSight(map, centerX, centerZ, enemy.position.x, enemy.position.z, 0.15))
    .map(enemy => enemy.id);
}

export function resolveAreaAttack(
  map: number[][],
  centerX: number,
  centerZ: number,
  radius: number,
  enemies: WorldEnemy[],
  damage: number,
  statusDamageBonus?: { statusId: RealtimeStatusId; multiplier: number },
): { enemies: WorldEnemy[]; hitEnemyIds: string[] } {
  const hitEnemyIds = getAreaTargetIds(map, centerX, centerZ, radius, enemies);
  const targetIds = new Set(hitEnemyIds);
  const updated = enemies.map(enemy => {
    if (!targetIds.has(enemy.id)) return enemy;
    const hasStatus = statusDamageBonus && (enemy.statusEffects ?? []).some(status => status.statusId === statusDamageBonus.statusId && status.durationSeconds > 0);
    const multiplier = hasStatus ? clamp(statusDamageBonus.multiplier, 1, 2) : 1;
    return applyEnemyDamage(enemy, Math.round(damage * multiplier)).enemy;
  });
  return { enemies: updated, hitEnemyIds };
}

export function calculateIncomingDamage(enemy: WorldEnemy, player: PlayerCharacter, shieldBlock = false): number {
  const weakness = outgoingDamageMultiplier(enemy.statusEffects);
  const guard = incomingDamageMultiplier(player.statusEffects);
  const bloodOathPenalty = 1 + Math.min(0.5, Math.max(0, statusMagnitude(player.statusEffects, 'BLOOD_OATH')));
  const block = shieldBlock ? 0.28 : 1;
  const armor = calculateDerivedStats(player).armor;
  const baseDamage = Math.max(0, finite(enemy.damage) * weakness - armor * 0.45) * guard * block * bloodOathPenalty;
  return Math.max(1, Math.ceil(clamp(baseDamage, 0, 1_000_000)));
}

export function projectileDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch);
  return { x: Math.cos(yaw) * flat, y: Math.sin(pitch), z: Math.sin(yaw) * flat };
}

function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, finite(value, min))); }
