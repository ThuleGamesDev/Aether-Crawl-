import type { PlayerCharacter, WorldEnemy } from '../types';
import type { AbilityDefinition } from './AbilityRegistry';
import { hasLineOfSight } from '../world/CollisionWorld';

export function calculatePlayerDamage(player: PlayerCharacter, ability: AbilityDefinition, multiplier = 1): number {
  const weaponPower = player.equipment.weapon?.value ?? 0;
  const statusBonus = player.statusEffects
    .filter(status => status.statusId === 'prepared_damage')
    .reduce((total, status) => total + status.magnitude, 0);
  const statKey = ability.kind === 'MELEE'
    ? player.classId === 'ROGUE' || player.classId === 'RANGER' || player.classId === 'MONK' ? 'dex' : 'str'
    : player.classId === 'RANGER' || player.classId === 'ROGUE' ? 'dex' : 'int';
  const accessory = player.equipment.accessory;
  const accessoryStat = statKey.toUpperCase();
  const primaryStat = player.stats[statKey] + (accessory?.statBonus === accessoryStat ? accessory.value : 0);
  return Math.max(1, Math.round((ability.damage + primaryStat * 0.62 + weaponPower + player.stats.damageBonus + statusBonus) * Math.max(0.25, multiplier)));
}

export function applyEnemyDamage(enemy: WorldEnemy, amount: number): { enemy: WorldEnemy; defeated: boolean } {
  if (enemy.health <= 0 || enemy.state === 'DEAD') return { enemy, defeated: false };
  const health = Math.max(0, enemy.health - Math.max(0, Math.floor(amount)));
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
    if (distance > ability.range || Math.abs(difference) > arc / 2 || !hasLineOfSight(map, player.position.x, player.position.z, enemy.position.x, enemy.position.z, 0.18)) return enemy;
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

export function calculateIncomingDamage(enemy: WorldEnemy, player: PlayerCharacter): number {
  return Math.max(1, Math.ceil(enemy.damage - player.stats.armor * 0.45));
}

export function projectileDirection(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const flat = Math.cos(pitch);
  return { x: Math.cos(yaw) * flat, y: Math.sin(pitch), z: Math.sin(yaw) * flat };
}
