import type { PlayerCharacter, WorldEnemy } from '../types';
import { getAbilityDamageType, type AbilityDefinition } from './AbilityRegistry';
import { hasLineOfSight } from '../world/CollisionWorld';
import { incomingDamageMultiplier, outgoingDamageMultiplier, statusMagnitude } from './StatusSystem';
import { calculateDerivedStats } from '../player/DerivedStats';

export function calculatePlayerDamage(player: PlayerCharacter, ability: AbilityDefinition, multiplier = 1, criticalRoll = 1): number {
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
  const baseDamage = finite(ability.damage) + stat * 0.62 + derived.weaponPower + finite(player.stats.damageBonus) + finite(statusBonus) + flatDamage;
  const critical = Number.isFinite(criticalRoll) && criticalRoll >= 0 && criticalRoll < derived.criticalChance
    ? derived.criticalDamageMultiplier : 1;
  const safeMultiplier = Number.isFinite(multiplier) ? clamp(multiplier, 0.25, 2) : 1;
  const damage = Math.max(0, baseDamage) * safeMultiplier * damageMultiplier * projectileMultiplier
    * critical * outgoingDamageMultiplier(player.statusEffects) * counterMultiplier;
  return Math.max(1, Math.round(clamp(damage, 0, 1_000_000)));
}

export function applyEnemyDamage(enemy: WorldEnemy, amount: number): { enemy: WorldEnemy; defeated: boolean } {
  if (enemy.health <= 0 || enemy.state === 'DEAD') return { enemy, defeated: false };
  const guarded = Math.round(Math.max(0, amount) * incomingDamageMultiplier(enemy.statusEffects));
  const health = Math.max(0, enemy.health - Math.max(0, Math.floor(guarded)));
  const defeated = health <= 0;
  return {
    enemy: { ...enemy, health, state: defeated ? 'DEAD' : 'HURT', stateTimer: defeated ? 1.1 : 0.2 },
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
  const arc = ability.arcRadians ?? 0.9;
  const hitEnemyIds: string[] = [];
  const updated = enemies.map(enemy => {
    if (enemy.health <= 0 || enemy.state === 'DEAD') return enemy;
    const dx = enemy.position.x - player.position.x, dz = enemy.position.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const difference = Math.atan2(Math.sin(angle - player.rotation.yaw), Math.cos(angle - player.rotation.yaw));
    const reach = ability.range + Math.min(0.35, (enemy.collisionRadius ?? 0.28) * 0.4);
    if (distance > reach || Math.abs(difference) > arc / 2 || !hasLineOfSight(map, player.position.x, player.position.z, enemy.position.x, enemy.position.z, 0.18)) return enemy;
    const hit = applyEnemyDamage(enemy, damage);
    hitEnemyIds.push(enemy.id);
    return hit.enemy;
  });
  return { enemies: updated, hitEnemyIds };
}

export function resolveAreaAttack(
  map: number[][],
  centerX: number,
  centerZ: number,
  radius: number,
  enemies: WorldEnemy[],
  damage: number,
): { enemies: WorldEnemy[]; hitEnemyIds: string[] } {
  const hitEnemyIds: string[] = [];
  const updated = enemies.map(enemy => {
    if (enemy.health <= 0 || enemy.state === 'DEAD') return enemy;
    if (Math.hypot(enemy.position.x - centerX, enemy.position.z - centerZ) > radius + 0.22) return enemy;
    if (!hasLineOfSight(map, centerX, centerZ, enemy.position.x, enemy.position.z, 0.15)) return enemy;
    hitEnemyIds.push(enemy.id);
    return applyEnemyDamage(enemy, damage).enemy;
  });
  return { enemies: updated, hitEnemyIds };
}

export function calculateIncomingDamage(enemy: WorldEnemy, player: PlayerCharacter, shieldBlock = false): number {
  const weakness = outgoingDamageMultiplier(enemy.statusEffects);
  const guard = incomingDamageMultiplier(player.statusEffects);
  const block = shieldBlock ? 0.28 : 1;
  const armor = calculateDerivedStats(player).armor;
  const baseDamage = Math.max(0, finite(enemy.damage) * weakness - armor * 0.45) * guard * block;
  return Math.max(1, Math.ceil(clamp(baseDamage, 0, 1_000_000)));
}

export function projectileDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch);
  return { x: Math.cos(yaw) * flat, y: Math.sin(pitch), z: Math.sin(yaw) * flat };
}

function finite(value: number, fallback = 0): number { return Number.isFinite(value) ? value : fallback; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, finite(value, min))); }
