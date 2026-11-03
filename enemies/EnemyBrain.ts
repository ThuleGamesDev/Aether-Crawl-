import type { PlayerCharacter, WorldEnemy } from '../types';
import { hasLineOfSight, moveWithEntitySlide, moveWithWallSlide, nextGridStep } from '../world/CollisionWorld';
import { getEnemyAttackDefinition, getEnemyAttackSet } from '../data/enemyAttacks';
import { hasRealtimeStatus, movementSpeedMultiplier } from '../combat/StatusSystem';

export interface EnemyAIUpdate {
  enemies: WorldEnemy[];
  attacks: string[];
  telegraphs: string[];
}

const floorCell = (value: number) => Math.floor(value);
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function updateEnemyBrains(enemies: WorldEnemy[], map: number[][], player: PlayerCharacter, deltaSeconds: number): EnemyAIUpdate {
  const dt = Math.max(0, Math.min(0.05, deltaSeconds));
  const attacks: string[] = [];
  const telegraphs: string[] = [];
  const updated = enemies.map((enemy, index) => {
    const next: WorldEnemy = {
      ...enemy,
      position: { ...enemy.position },
      stateTimer: Math.max(0, enemy.stateTimer - dt),
      attackCooldown: Math.max(0, enemy.attackCooldown - dt),
      repositionCooldownSeconds: Math.max(0, (enemy.repositionCooldownSeconds ?? 0) - dt),
      pathRefreshSeconds: Math.max(0, (enemy.pathRefreshSeconds ?? 0) - dt),
      statusEffects: enemy.statusEffects?.map(status => ({ ...status })),
    };
    if (next.health <= 0 || next.state === 'DEAD') { next.state = 'DEAD'; return next; }
    if ((next.phaseTransitionLockSeconds ?? 0) > 0) {
      next.state = 'RECOVER';
      next.stateTimer = Math.max(next.stateTimer, next.phaseTransitionLockSeconds ?? 0);
      next.activeAttackId = undefined;
      next.telegraphPosition = undefined;
      return next;
    }
    if (hasRealtimeStatus(next.statusEffects, 'STAGGER') && next.state !== 'STAGGER') {
      next.state = 'STAGGER';
      next.stateTimer = Math.max(0.24, next.statusEffects?.find(status => status.statusId === 'STAGGER')?.durationSeconds ?? 0.4);
      return next;
    }

    const dx = player.position.x - next.position.x, dz = player.position.z - next.position.z;
    const distance = Math.hypot(dx, dz);
    const seesPlayer = distance <= (next.isBoss ? 12 : 9) && hasLineOfSight(map, next.position.x, next.position.z, player.position.x, player.position.z, 0.2);
    const targetYaw = Math.atan2(dz, dx);
    if (seesPlayer) next.facingYaw = rotateToward(next.facingYaw ?? targetYaw, targetYaw, 3.6 * dt);

    if (next.state === 'IDLE') {
      if (seesPlayer) { next.state = 'ALERT'; next.stateTimer = next.isBoss ? 0.32 : 0.2; next.facingYaw = targetYaw; }
      return next;
    }
    if (next.state === 'ALERT' || next.state === 'AGGRO') {
      if (!seesPlayer && distance > 10) { next.state = 'IDLE'; return next; }
      if (next.stateTimer <= 0) next.state = 'CHASE';
      return next;
    }
    if (next.state === 'APPROACH') next.state = 'CHASE';
    if (next.state === 'HURT') {
      if (next.stateTimer <= 0) next.state = seesPlayer ? 'CHASE' : 'IDLE';
      return next;
    }
    if (next.state === 'STAGGER') {
      if (next.stateTimer <= 0 && hasRealtimeStatus(next.statusEffects, 'STAGGER')) {
        next.stateTimer = next.statusEffects?.find(status => status.statusId === 'STAGGER')?.durationSeconds ?? 0.25;
      }
      if (next.stateTimer <= 0) next.state = seesPlayer ? 'CHASE' : 'IDLE';
      return next;
    }

    if (next.state === 'ATTACK_WINDUP') {
      const attack = getEnemyAttackDefinition(next.attackSetId, next.activeAttackId, next.phase ?? 1);
      if (!attack || !seesPlayer || distance > attack.range + (attack.motion === 'CHARGE' || attack.motion === 'LEAP' ? 1.2 : 0.48)
        || (attack.minRange !== undefined && distance < attack.minRange * 0.62)) {
        next.state = 'CHASE';
        next.stateTimer = 0;
        next.activeAttackId = undefined;
        next.telegraphPosition = undefined;
      } else if (next.stateTimer <= 0) {
        next.state = 'ATTACK_ACTIVE';
        next.stateTimer = attack.activeSeconds;
        next.facingYaw = targetYaw;
        attacks.push(next.id);
      }
      return next;
    }
    if (next.state === 'ATTACK_ACTIVE' || next.state === 'ATTACK') {
      if (next.stateTimer <= 0) {
        const attack = getEnemyAttackDefinition(next.attackSetId, next.activeAttackId, next.phase ?? 1);
        next.state = 'RECOVER';
        next.stateTimer = attack?.recoverySeconds ?? 0.62;
        next.attackCooldown = (attack?.cooldownSeconds ?? 1.25) * Math.max(0.7, Math.min(1, next.attackCooldownMultiplier ?? 1));
        next.lastAttackId = next.activeAttackId;
        const set = getEnemyAttackSet(next.attackSetId, next.phase ?? 1);
        next.attackIndex = set.length > 1 ? ((next.attackIndex ?? 0) + 1) % set.length : 0;
        next.activeAttackId = undefined;
        next.telegraphPosition = undefined;
      }
      return next;
    }
    if (next.state === 'RECOVER') {
      if (next.stateTimer <= 0) next.state = seesPlayer ? 'CHASE' : 'IDLE';
      return next;
    }
    if (next.state === 'RETREAT' || next.state === 'REPOSITION') {
      if (next.stateTimer <= 0) { next.state = seesPlayer ? 'CHASE' : 'IDLE'; return next; }
      if (seesPlayer) moveEnemy(next, enemies, index, map, player, dt, next.state);
      return next;
    }

    if (!seesPlayer) {
      if (distance > 10) next.state = 'IDLE';
      return next;
    }

    const set = getEnemyAttackSet(next.attackSetId, next.phase ?? 1);
    if (next.attackCooldown <= 0) {
      const startIndex = (next.attackIndex ?? 0) % set.length;
      const options = Array.from({ length: set.length }, (_, offset) => set[(startIndex + offset) % set.length]);
      const inRange = options.filter(attack => {
        if (attack.shape === 'BUFF') {
          const preferredRange = attack.motion === 'RETREAT' ? Math.min(attack.range, 2.6) : attack.range;
          if (distance > preferredRange + 0.06) return false;
          return attack.motion === 'RETREAT' || !attack.statusEffect || !hasRealtimeStatus(next.statusEffects, attack.statusEffect.statusId);
        }
        return distance <= attack.range + 0.06 && distance >= (attack.minRange ?? 0);
      });
      const alternative = inRange.find(attack => attack.id !== next.lastAttackId);
      const selected = alternative ?? inRange[0];
      if (selected) {
        next.activeAttackId = selected.id;
        next.attackRange = selected.range;
        next.attackTelegraphSeconds = selected.windupSeconds;
        next.facingYaw = targetYaw;
        next.state = 'ATTACK_WINDUP';
        next.stateTimer = selected.windupSeconds;
        if (selected.shape === 'SIGIL') next.telegraphPosition = { x: player.position.x, y: 0, z: player.position.z };
        telegraphs.push(next.id);
        return next;
      }
    }

    const role = next.behaviorRole ?? 'CHASER';
    if ((role === 'SKIRMISHER' || role === 'CONTROLLER' || role === 'SUPPORT') && distance < 2.05 && (next.repositionCooldownSeconds ?? 0) <= 0) {
      next.state = 'RETREAT';
      next.stateTimer = role === 'SKIRMISHER' ? 0.5 : 0.38;
      next.repositionCooldownSeconds = role === 'SKIRMISHER' ? 2.7 : 3.4;
      moveEnemy(next, enemies, index, map, player, dt, 'RETREAT');
      return next;
    }
    if (role === 'CONTROLLER' || role === 'SUPPORT') {
      const preferred = role === 'SUPPORT' ? 4.3 : 3.8;
      if (distance < preferred - 0.4) { next.state = 'RETREAT'; next.stateTimer = 0.24; moveEnemy(next, enemies, index, map, player, dt, 'RETREAT'); return next; }
    }
    next.state = 'CHASE';
    moveEnemy(next, enemies, index, map, player, dt, 'CHASE');
    return next;
  });
  return { enemies: updated, attacks, telegraphs };
}

function moveEnemy(enemy: WorldEnemy, enemies: readonly WorldEnemy[], ownIndex: number, map: number[][], player: PlayerCharacter, dt: number, mode: 'CHASE' | 'RETREAT' | 'REPOSITION'): void {
  const dx = player.position.x - enemy.position.x, dz = player.position.z - enemy.position.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  let directionX = dx / distance, directionZ = dz / distance;
  let destinationX = player.position.x, destinationZ = player.position.z;
  if (mode === 'RETREAT') {
    directionX *= -1; directionZ *= -1;
    destinationX = enemy.position.x + directionX * 2.2;
    destinationZ = enemy.position.z + directionZ * 2.2;
  } else if (mode === 'REPOSITION') {
    const sign = enemy.id.charCodeAt(enemy.id.length - 1) % 2 ? 1 : -1;
    const sideX = -directionZ * sign, sideZ = directionX * sign;
    destinationX = player.position.x + sideX * 1.8;
    destinationZ = player.position.z + sideZ * 1.8;
  }

  const targetCell = { x: floorCell(destinationX), y: floorCell(destinationZ) };
  const currentCell = { x: floorCell(enemy.position.x), y: floorCell(enemy.position.z) };
  let stepCell = enemy.pathStep;
  let pathFound = Boolean(stepCell && (stepCell.x !== currentCell.x || stepCell.y !== currentCell.y || (targetCell.x === currentCell.x && targetCell.y === currentCell.y)));
  const targetChanged = !enemy.pathTargetCell || enemy.pathTargetCell.x !== targetCell.x || enemy.pathTargetCell.y !== targetCell.y;
  if (targetChanged || (enemy.pathRefreshSeconds ?? 0) <= 0 || !stepCell) {
    const nextStep = nextGridStep(map, currentCell, targetCell);
    pathFound = Boolean(nextStep);
    stepCell = nextStep ?? currentCell;
    enemy.pathStep = { ...stepCell };
    enemy.pathTargetCell = targetCell;
    enemy.pathRefreshSeconds = 0.22;
  }

  let moveX: number, moveZ: number;
  if (mode !== 'CHASE' && !pathFound) {
    const goalX = destinationX - enemy.position.x, goalZ = destinationZ - enemy.position.z;
    const goalDistance = Math.hypot(goalX, goalZ);
    moveX = goalDistance > 0.001 ? goalX / goalDistance : 0;
    moveZ = goalDistance > 0.001 ? goalZ / goalDistance : 0;
  } else if (mode === 'CHASE' && distance < 3.2 && hasLineOfSight(map, enemy.position.x, enemy.position.z, player.position.x, player.position.z, 0.3)) {
    moveX = dx / distance; moveZ = dz / distance;
  } else {
    const goalX = stepCell.x + 0.5, goalZ = stepCell.y + 0.5;
    const toGoalX = goalX - enemy.position.x, toGoalZ = goalZ - enemy.position.z;
    const goalDistance = Math.hypot(toGoalX, toGoalZ);
    if (goalDistance < 0.12) { enemy.pathRefreshSeconds = 0; return; }
    moveX = toGoalX / goalDistance; moveZ = toGoalZ / goalDistance;
  }

  const speedBase = mode === 'RETREAT' ? 2.2 : enemy.definitionId === 'giant_rat' ? 1.85 : enemy.isBoss ? 0.92 : enemy.behaviorRole === 'HEAVY' ? 0.88 : enemy.behaviorRole === 'SUPPORT' ? 0.82 : 1.15;
  const speed = speedBase * movementSpeedMultiplier(enemy.statusEffects);
  const amount = speed * dt;
  const radius = enemy.collisionRadius ?? (enemy.isBoss ? 0.42 : 0.2);
  let moved = moveWithEntitySlide(map, enemy.position.x, enemy.position.z, moveX * amount, moveZ * amount, [{ position: player.position, radius: 0.24 }], radius);

  // Small separation steering prevents doorways from becoming an enemy-to-enemy traffic jam.
  let repelX = 0, repelZ = 0;
  for (let i = 0; i < enemies.length; i += 1) {
    const other = enemies[i];
    if (i === ownIndex || other.health <= 0) continue;
    const awayX = moved.x - other.position.x, awayZ = moved.y - other.position.z;
    const separation = Math.hypot(awayX, awayZ);
    if (separation > 0.001 && separation < radius + (other.collisionRadius ?? 0.2) + 0.16) {
      const force = (radius + (other.collisionRadius ?? 0.2) + 0.16 - separation) / separation;
      repelX += awayX * force * 0.35; repelZ += awayZ * force * 0.35;
    }
  }
  if (repelX || repelZ) moved = moveWithWallSlide(map, moved.x, moved.y, repelX, repelZ, radius);
  enemy.position.x = moved.x;
  enemy.position.z = moved.y;
}

function rotateToward(from: number, to: number, maxDelta: number): number {
  return from + clamp(angleDelta(from, to), -maxDelta, maxDelta);
}
