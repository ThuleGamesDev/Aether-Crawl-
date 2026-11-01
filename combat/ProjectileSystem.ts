import type { WorldEnemy, WorldProjectile } from '../types';
import { applyEnemyDamage } from './DamageSystem';
import { isWorldSolid } from '../world/CollisionWorld';

export interface ProjectileImpact {
  position: { x: number; y: number; z: number };
  color: string;
  enemyId?: string;
  abilityId: string;
}

export interface ProjectileUpdateResult {
  projectiles: WorldProjectile[];
  enemies: WorldEnemy[];
  impacts: ProjectileImpact[];
}

export function updateProjectiles(projectiles: WorldProjectile[], enemies: WorldEnemy[], map: number[][], deltaSeconds: number): ProjectileUpdateResult {
  const dt = Math.max(0, Math.min(0.05, deltaSeconds));
  let nextEnemies = enemies;
  const remaining: WorldProjectile[] = [];
  const impacts: ProjectileImpact[] = [];
  for (const projectile of projectiles) {
    let current = { ...projectile, position: { ...projectile.position } };
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
        impacts.push({ position: current.position, color: current.color, abilityId: current.sourceAbilityId });
        consumed = true;
        break;
      }
      const target = nextEnemies.find(enemy => enemy.health > 0 && enemy.state !== 'DEAD' && Math.hypot(enemy.position.x - current.position.x, enemy.position.z - current.position.z) < (enemy.collisionRadius ?? 0.28) + current.radius && Math.abs(0.72 - current.position.y) < 1.0);
      if (target) {
        nextEnemies = nextEnemies.map(enemy => enemy.id === target.id ? applyEnemyDamage(enemy, current.damage).enemy : enemy);
        impacts.push({ position: current.position, color: current.color, enemyId: target.id, abilityId: current.sourceAbilityId });
        consumed = true;
        break;
      }
    }
    current.remainingSeconds -= dt;
    if (!consumed && current.remainingSeconds > 0) remaining.push(current);
    else if (!consumed) impacts.push({ position: current.position, color: current.color, abilityId: current.sourceAbilityId });
  }
  return { projectiles: remaining, enemies: nextEnemies, impacts };
}
