import type { PlayerCharacter, WorldEnemy } from '../types';
import type { InputFrame } from '../engine/InputSystem';
import { moveWithEntitySlide } from '../world/CollisionWorld';
import { movementSpeedMultiplier } from '../combat/StatusSystem';

export const MOUSE_LOOK_SENSITIVITY = 0.0025;
export const MAX_CAMERA_PITCH = 1.18;
export const PLAYER_WALK_SPEED = 3.35;
export const PLAYER_SPRINT_SPEED = 5.1;
export const PLAYER_DODGE_SPEED = 9.2;
export const PLAYER_DODGE_DURATION = 0.18;
export const PLAYER_DODGE_COOLDOWN = 1.1;

export interface PlayerControllerState {
  velocityX: number;
  velocityZ: number;
  dodgeSeconds: number;
  dodgeCooldown: number;
  invulnerabilitySeconds: number;
  bobSeconds: number;
  guarding: boolean;
}

export const createPlayerControllerState = (): PlayerControllerState => ({
  velocityX: 0,
  velocityZ: 0,
  dodgeSeconds: 0,
  dodgeCooldown: 0,
  invulnerabilitySeconds: 0,
  bobSeconds: 0,
  guarding: false,
});

export interface PlayerControllerUpdate {
  player: PlayerCharacter;
  state: PlayerControllerState;
  isMoving: boolean;
  cameraBob: number;
  dodgeStarted: boolean;
}

export function updatePlayerController(
  player: PlayerCharacter,
  state: PlayerControllerState,
  input: InputFrame,
  map: number[][],
  deltaSeconds: number,
  enemies: readonly WorldEnemy[] = [],
): PlayerControllerUpdate {
  const dt = Math.max(0, Math.min(0.05, deltaSeconds));
  const nextState = { ...state, dodgeSeconds: Math.max(0, state.dodgeSeconds - dt), dodgeCooldown: Math.max(0, state.dodgeCooldown - dt), invulnerabilitySeconds: Math.max(0, state.invulnerabilitySeconds - dt) };
  let yaw = player.rotation.yaw + input.lookX + input.movement.turn * 2.25 * dt;
  yaw = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const pitch = Math.max(-MAX_CAMERA_PITCH, Math.min(MAX_CAMERA_PITCH, player.rotation.pitch - input.lookY));
  const forwardX = Math.cos(yaw), forwardZ = Math.sin(yaw);
  const rightX = -forwardZ, rightZ = forwardX;
  const intentX = forwardX * input.movement.forward + rightX * input.movement.strafe;
  const intentZ = forwardZ * input.movement.forward + rightZ * input.movement.strafe;
  const intentLength = Math.hypot(intentX, intentZ);
  const normalizedX = intentLength > 1 ? intentX / intentLength : intentX;
  const normalizedZ = intentLength > 1 ? intentZ / intentLength : intentZ;
  let dodgeStarted = false;

  if (input.dodgePressed && nextState.dodgeCooldown <= 0) {
    const dodgeX = intentLength > 0.05 ? normalizedX : forwardX;
    const dodgeZ = intentLength > 0.05 ? normalizedZ : forwardZ;
    nextState.velocityX = dodgeX * PLAYER_DODGE_SPEED;
    nextState.velocityZ = dodgeZ * PLAYER_DODGE_SPEED;
    nextState.dodgeSeconds = PLAYER_DODGE_DURATION;
    nextState.dodgeCooldown = PLAYER_DODGE_COOLDOWN;
    nextState.invulnerabilitySeconds = PLAYER_DODGE_DURATION;
    dodgeStarted = true;
  }

  const hasShield = player.equipment.offhand?.type === 'SHIELD';
  nextState.guarding = hasShield && input.secondaryDown && nextState.dodgeSeconds <= 0;

  if (nextState.dodgeSeconds <= 0) {
    const speed = (input.sprint && !nextState.guarding ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED)
      * movementSpeedMultiplier(player.statusEffects) * (nextState.guarding ? 0.55 : 1);
    const targetX = normalizedX * speed, targetZ = normalizedZ * speed;
    const acceleration = intentLength > 0.01 ? 26 : 34;
    nextState.velocityX = approach(nextState.velocityX, targetX, acceleration * dt);
    nextState.velocityZ = approach(nextState.velocityZ, targetZ, acceleration * dt);
  }

  const deltaX = nextState.velocityX * dt, deltaZ = nextState.velocityZ * dt;
  const colliders = enemies.filter(enemy => enemy.health > 0 && enemy.state !== 'DEAD').map(enemy => ({ position: enemy.position, radius: enemy.collisionRadius ?? (enemy.isBoss ? 0.38 : 0.28) }));
  const moved = moveWithEntitySlide(map, player.position.x, player.position.z, deltaX, deltaZ, colliders);
  const position = { x: moved.x, y: player.position.y, z: moved.y };
  const traveled = Math.hypot(position.x - player.position.x, position.z - player.position.z);
  const moving = traveled > 0.001;
  if (nextState.dodgeSeconds <= 0 && !moving) { nextState.velocityX = 0; nextState.velocityZ = 0; }
  if (nextState.dodgeSeconds <= 0 && traveled < Math.hypot(deltaX, deltaZ) * 0.25) {
    nextState.velocityX *= 0.25;
    nextState.velocityZ *= 0.25;
  }
  nextState.bobSeconds += moving ? dt * (input.sprint ? 13 : 9) : dt * 2;
  const cameraBob = moving && nextState.dodgeSeconds <= 0 ? Math.sin(nextState.bobSeconds) * (input.sprint ? 0.045 : 0.028) : 0;
  return { player: { ...player, position, rotation: { yaw, pitch } }, state: nextState, isMoving: moving, cameraBob, dodgeStarted };
}

function approach(current: number, target: number, delta: number): number {
  if (current < target) return Math.min(target, current + delta);
  return Math.max(target, current - delta);
}
