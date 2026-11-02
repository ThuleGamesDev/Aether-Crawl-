import type { StatusApplication, Vector3Like, WorldEnemy, WorldProjectile } from '../types';
import { applyEnemyDamage } from './DamageSystem';
import { isWorldSolid } from '../world/CollisionWorld';
import { applyRealtimeStatus } from './StatusSystem';
import { getEnemyVfxSurface, getTileVfxSurface, type VFXSurface } from '../presentation/vfxDefinitions';

export interface ProjectileImpact {
  kind: 'enemy' | 'player' | 'world' | 'range';
  position: { x: number; y: number; z: number };
  color: string;
  surface?: VFXSurface;
  enemyId?: string;
  playerHit?: boolean;
  ownerEnemyId?: string;
  abilityId: string;
  damage?: number;
  statusEffect?: StatusApplication;
  healOwnerRatio?: number;
}

export interface ProjectileUpdateResult {
  projectiles: WorldProjectile[];
  enemies: WorldEnemy[];
  impacts: ProjectileImpact[];
}

export const MAX_PROJECTILE_PIERCE = 3;

export function isVisibleProjectileImpact(impact: Pick<ProjectileImpact, 'kind'>): boolean {
  return impact.kind !== 'range';
}

export function updateProjectiles(projectiles: WorldProjectile[], enemies: WorldEnemy[], map: number[][], deltaSeconds: number, playerPosition?: Vector3Like): ProjectileUpdateResult {
  const dt = Math.max(0, Math.min(0.05, deltaSeconds));
  let nextEnemies = enemies;
  const remaining: WorldProjectile[] = [];
  const impacts: ProjectileImpact[] = [];
  for (const projectile of projectiles) {
    let current = { ...projectile, position: { ...projectile.position }, hitEnemyIds: [...(projectile.hitEnemyIds ?? [])].slice(0, MAX_PROJECTILE_PIERCE + 1) };
    let consumed = false;
    const stepLength = Math.hypot(current.velocity.x, current.velocity.y, current.velocity.z) * dt;
    const steps = Math.max(1, Math.ceil(stepLength / 0.06));
    for (let step = 0; step < steps; step += 1) {
      const divisor = steps;
      current.position = {
        x: current.position.x + current.velocity.x * dt / divisor,
        y: current.position.y + current.velocity.y * dt / divisor,
        z: current.position.z + current.velocity.z * dt / divisor,
      };
      const cellX = Math.floor(current.position.x), cellZ = Math.floor(current.position.z);
      if (isWorldSolid(map[cellZ]?.[cellX])) {
        impacts.push({ kind: 'world', position: current.position, color: current.color, surface: getTileVfxSurface(map[cellZ]?.[cellX]), abilityId: current.sourceAbilityId, ownerEnemyId: current.ownerEnemyId });
        consumed = true;
        break;
      }
      if (current.faction === 'ENEMY' && playerPosition && Math.hypot(playerPosition.x - current.position.x, playerPosition.z - current.position.z) < 0.34 + current.radius && Math.abs(1.15 - current.position.y) < 0.78) {
        impacts.push({ kind: 'player', position: current.position, color: current.color, surface: 'organic', abilityId: current.sourceAbilityId, playerHit: true, ownerEnemyId: current.ownerEnemyId, statusEffect: current.statusEffect, healOwnerRatio: current.healOwnerRatio });
        consumed = true;
        break;
      }
      const target = current.faction !== 'ENEMY' ? nextEnemies.find(enemy => enemy.health > 0 && enemy.state !== 'DEAD'
        && !current.hitEnemyIds?.includes(enemy.id)
        && Math.hypot(enemy.position.x - current.position.x, enemy.position.z - current.position.z) < (enemy.collisionRadius ?? 0.28) + current.radius
        && Math.abs(0.72 - current.position.y) < 1.0) : undefined;
      if (target) {
        nextEnemies = nextEnemies.map(enemy => {
          if (enemy.id !== target.id) return enemy;
          let hit = applyEnemyDamage(enemy, current.damage).enemy;
          if (current.statusEffect) {
            const bossAdjusted = target.isBoss && (current.statusEffect.statusId === 'STAGGER' || current.statusEffect.statusId === 'CURSE')
              ? { ...current.statusEffect, durationSeconds: current.statusEffect.durationSeconds * 0.5, magnitude: current.statusEffect.magnitude * 0.5 }
              : current.statusEffect;
            hit = { ...hit, statusEffects: applyRealtimeStatus(hit.statusEffects, bossAdjusted, current.sourceAbilityId) };
          }
          return hit;
        });
        impacts.push({ kind: 'enemy', position: current.position, color: current.color, surface: getEnemyVfxSurface(target.visualId), enemyId: target.id, abilityId: current.sourceAbilityId, damage: current.damage, ownerEnemyId: current.ownerEnemyId, statusEffect: current.statusEffect, healOwnerRatio: current.healOwnerRatio });
        const pierceRemaining = Math.max(0, Math.min(MAX_PROJECTILE_PIERCE, Math.floor(current.pierceRemaining ?? 0)));
        if (pierceRemaining > 0) {
          current = { ...current, pierceRemaining: pierceRemaining - 1, hitEnemyIds: [...(current.hitEnemyIds ?? []), target.id] };
        } else {
          consumed = true;
          break;
        }
      }
    }
    current.remainingSeconds -= dt;
    if (!consumed && current.remainingSeconds > 0) remaining.push(current);
    else if (!consumed) impacts.push({ kind: 'range', position: current.position, color: current.color, abilityId: current.sourceAbilityId, ownerEnemyId: current.ownerEnemyId });
  }
  return { projectiles: remaining, enemies: nextEnemies, impacts };
}
