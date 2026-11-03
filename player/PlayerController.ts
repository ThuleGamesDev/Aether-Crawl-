import type { PlayerCharacter, WorldEnemy } from '../types';
import type { InputFrame } from '../engine/InputSystem';
import { moveWithEntitySlide } from '../world/CollisionWorld';
import { movementSpeedMultiplier } from '../combat/StatusSystem';
import { calculateDerivedStats } from './DerivedStats';
import { isShieldItem } from '../services/equipmentRules';
import { STAMINA_RULES } from '../combat/CombatMastery';

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
  parryWindowSeconds: number;
  parryRecoverySeconds: number;
  perfectDodgeWindowSeconds: number;
  guardExhausted: boolean;
}

export const createPlayerControllerState = (): PlayerControllerState => ({
  velocityX: 0,
  velocityZ: 0,
  dodgeSeconds: 0,
  dodgeCooldown: 0,
  invulnerabilitySeconds: 0,
  bobSeconds: 0,
  guarding: false,
  parryWindowSeconds: 0,
  parryRecoverySeconds: 0,
  perfectDodgeWindowSeconds: 0,
  guardExhausted: false,
});

export interface PlayerControllerUpdate {
  player: PlayerCharacter;
  state: PlayerControllerState;
  isMoving: boolean;
  cameraBob: number;
  dodgeStarted: boolean;
  dodgeFailed: boolean;
  parryStarted: boolean;
  parryFailure: 'NO_SHIELD' | 'NO_STAMINA' | 'RECOVERY' | null;
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
  const derived = calculateDerivedStats(player);
  const nextState = {
    ...state,
    dodgeSeconds: Math.max(0, state.dodgeSeconds - dt),
    dodgeCooldown: Math.max(0, state.dodgeCooldown - dt),
    invulnerabilitySeconds: Math.max(0, state.invulnerabilitySeconds - dt),
    parryWindowSeconds: Math.max(0, state.parryWindowSeconds - dt),
    parryRecoverySeconds: Math.max(0, state.parryRecoverySeconds - dt),
    perfectDodgeWindowSeconds: Math.max(0, state.perfectDodgeWindowSeconds - dt),
  };
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
  const staminaMaximum = derived.maxStamina;
  let stamina = Math.max(0, Math.min(staminaMaximum, Number.isFinite(player.stats.stamina) ? player.stats.stamina! : staminaMaximum));
  let staminaDelay = Math.max(0, Math.min(10, Number.isFinite(player.stats.staminaRegenDelaySeconds) ? player.stats.staminaRegenDelaySeconds! : 0));
  const staminaBeforeActions = stamina;
  let staminaSpent = false;
  let dodgeStarted = false;
  let dodgeFailed = false;
  let parryStarted = false;
  let parryFailure: PlayerControllerUpdate['parryFailure'] = null;
  let dodgeCandidate = false;

  if (input.dodgePressed && nextState.dodgeCooldown <= 0) {
    if (stamina < STAMINA_RULES.dodgeCost) dodgeFailed = true;
    else {
      const dodgeX = intentLength > 0.05 ? normalizedX : forwardX;
      const dodgeZ = intentLength > 0.05 ? normalizedZ : forwardZ;
      stamina -= STAMINA_RULES.dodgeCost;
      staminaSpent = true;
      dodgeCandidate = true;
      nextState.velocityX = dodgeX * PLAYER_DODGE_SPEED * derived.movementSpeedMultiplier;
      nextState.velocityZ = dodgeZ * PLAYER_DODGE_SPEED * derived.movementSpeedMultiplier;
      nextState.dodgeSeconds = PLAYER_DODGE_DURATION;
    }
  }

  const hasShield = isShieldItem(player.equipment.offHand);
  if (!input.secondaryDown) nextState.guardExhausted = false;
  else if (hasShield && stamina <= 0) nextState.guardExhausted = true;
  if (input.parryPressed) {
    if (!hasShield) parryFailure = 'NO_SHIELD';
    else if (nextState.parryRecoverySeconds > 0 || nextState.dodgeSeconds > 0) parryFailure = 'RECOVERY';
    else if (stamina < STAMINA_RULES.parryCost) parryFailure = 'NO_STAMINA';
    else {
      stamina -= STAMINA_RULES.parryCost;
      staminaSpent = true;
      nextState.parryWindowSeconds = STAMINA_RULES.parryWindowSeconds;
      nextState.parryRecoverySeconds = STAMINA_RULES.parryRecoverySeconds;
      nextState.guarding = false;
      parryStarted = true;
    }
  }
  nextState.guarding = !parryStarted && !nextState.guardExhausted && hasShield && input.secondaryDown && nextState.dodgeSeconds <= 0 && nextState.parryRecoverySeconds <= 0 && stamina > 0;

  if (nextState.dodgeSeconds <= 0) {
    const speed = (input.sprint && !nextState.guarding ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED)
      * movementSpeedMultiplier(player.statusEffects) * derived.movementSpeedMultiplier * (nextState.guarding ? 0.55 : 1);
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
  if (dodgeCandidate) {
    if (traveled < 0.05) {
      stamina = staminaBeforeActions;
      staminaSpent = false;
      nextState.velocityX = 0;
      nextState.velocityZ = 0;
      nextState.dodgeSeconds = 0;
      nextState.dodgeCooldown = 0;
      dodgeFailed = true;
    } else {
      nextState.dodgeCooldown = PLAYER_DODGE_COOLDOWN * derived.cooldownMultiplier;
      nextState.invulnerabilitySeconds = PLAYER_DODGE_DURATION;
      nextState.perfectDodgeWindowSeconds = STAMINA_RULES.perfectDodgeWindowSeconds;
      dodgeStarted = true;
    }
  }
  if (nextState.guarding) {
    const drain = Math.min(stamina, STAMINA_RULES.shieldDrainPerSecond * dt);
    stamina -= drain;
    staminaSpent ||= drain > 0;
    if (stamina <= 0.001) { nextState.guarding = false; nextState.guardExhausted = true; }
  }
  if (staminaSpent) staminaDelay = STAMINA_RULES.regenerationDelaySeconds;
  else {
    staminaDelay = Math.max(0, staminaDelay - dt);
    if (staminaDelay <= 0) stamina = Math.min(staminaMaximum, stamina + derived.staminaRegenPerSecond * dt);
  }
  nextState.bobSeconds += moving ? dt * (input.sprint ? 13 : 9) : dt * 2;
  const cameraBob = moving && nextState.dodgeSeconds <= 0 ? Math.sin(nextState.bobSeconds) * (input.sprint ? 0.045 : 0.028) : 0;
  return {
    player: { ...player, position, rotation: { yaw, pitch }, stats: { ...player.stats, stamina, staminaRegenDelaySeconds: staminaDelay } },
    state: nextState, isMoving: moving, cameraBob, dodgeStarted, dodgeFailed, parryStarted, parryFailure,
  };
}

function approach(current: number, target: number, delta: number): number {
  if (current < target) return Math.min(target, current + delta);
  return Math.max(target, current - delta);
}
