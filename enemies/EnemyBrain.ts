import type { PlayerCharacter, WorldEnemy } from '../types';
import { hasLineOfSight, moveWithWallSlide, nextGridStep } from '../world/CollisionWorld';

export interface EnemyAIUpdate {
  enemies: WorldEnemy[];
  attacks: string[];
}

const floorCell = (value: number) => Math.floor(value);

export function updateEnemyBrains(enemies: WorldEnemy[], map: number[][], player: PlayerCharacter, deltaSeconds: number): EnemyAIUpdate {
  const dt = Math.max(0, Math.min(0.05, deltaSeconds));
  const attacks: string[] = [];
  const updated = enemies.map((enemy, index) => {
    const next: WorldEnemy = { ...enemy, position: { ...enemy.position }, stateTimer: Math.max(0, enemy.stateTimer - dt), attackCooldown: Math.max(0, enemy.attackCooldown - dt) };
    if (next.health <= 0 || next.state === 'DEAD') { next.state = 'DEAD'; return next; }
    const dx = player.position.x - next.position.x, dz = player.position.z - next.position.z;
    const distance = Math.hypot(dx, dz);
    const seesPlayer = distance <= 9 && hasLineOfSight(map, next.position.x, next.position.z, player.position.x, player.position.z, 0.2);

    if (next.state === 'IDLE') {
      if (seesPlayer) { next.state = 'AGGRO'; next.stateTimer = 0.2; }
      return next;
    }
    if (next.state === 'AGGRO') {
      if (!seesPlayer && distance > 10) { next.state = 'IDLE'; return next; }
      if (next.stateTimer <= 0) next.state = 'APPROACH';
      return next;
    }
    if (next.state === 'HURT') {
      if (next.stateTimer <= 0) next.state = 'APPROACH';
      return next;
    }
    if (next.state === 'ATTACK_WINDUP') {
      if (distance > next.attackRange + 0.4 || !hasLineOfSight(map, next.position.x, next.position.z, player.position.x, player.position.z, 0.2)) {
        next.state = 'APPROACH';
        next.stateTimer = 0;
      } else if (next.stateTimer <= 0) {
        next.state = 'ATTACK';
        next.stateTimer = 0.12;
        attacks.push(next.id);
      }
      return next;
    }
    if (next.state === 'ATTACK') {
      if (next.stateTimer <= 0) { next.state = 'RECOVER'; next.stateTimer = 0.62; next.attackCooldown = next.name === 'Bone Sentinel' ? 1.55 : 1.25; }
      return next;
    }
    if (next.state === 'RECOVER') {
      if (next.stateTimer <= 0) next.state = seesPlayer ? 'APPROACH' : 'IDLE';
      return next;
    }

    if (seesPlayer && distance <= next.attackRange && next.attackCooldown <= 0) {
      next.state = 'ATTACK_WINDUP';
      next.stateTimer = next.attackTelegraphSeconds;
      return next;
    }
    if (!seesPlayer) {
      if (distance > 10) next.state = 'IDLE';
      return next;
    }

    const from = { x: floorCell(next.position.x), y: floorCell(next.position.z) };
    const target = { x: floorCell(player.position.x), y: floorCell(player.position.z) };
    const step = nextGridStep(map, from, target);
    if (!step || (step.x === from.x && step.y === from.y)) return next;
    const targetX = step.x + 0.5, targetZ = step.y + 0.5;
    const moveX = targetX - next.position.x, moveZ = targetZ - next.position.z;
    const moveLength = Math.hypot(moveX, moveZ);
    if (moveLength < 0.001) return next;
    const speed = next.definitionId === 'giant_rat' ? 1.65 : next.isBoss ? 0.78 : 1.05;
    const amount = Math.min(moveLength, speed * dt);
    const moved = moveWithWallSlide(map, next.position.x, next.position.z, moveX / moveLength * amount, moveZ / moveLength * amount, 0.2);
    const blockedByEnemy = enemies.some((other, otherIndex) => otherIndex !== index && other.health > 0 && Math.hypot(moved.x - other.position.x, moved.y - other.position.z) < 0.43);
    if (!blockedByEnemy) { next.position.x = moved.x; next.position.z = moved.y; }
    return next;
  });
  return { enemies: updated, attacks };
}
