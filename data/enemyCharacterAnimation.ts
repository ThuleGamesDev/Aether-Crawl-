import type { WorldEnemy } from '../types';
import { getEnemyAttackDefinition, type EnemyAttackDefinition } from './enemyAttacks';
import { getCharacterRigDefinition } from './characterRigs';
import { ENEMY_DEATH_ANIMATION_SECONDS } from '../constants/enemyDeath';

export type EnemyCharacterAnimationMode = 'IDLE' | 'ALERT' | 'RUN' | 'WINDUP' | 'IMPACT' | 'RECOVERY' | 'CAST' | 'GUARD' | 'HURT' | 'STAGGER' | 'DEAD';
export type EnemyAttackAnimationProfile = 'melee' | 'cast' | 'guard' | 'lunge' | 'leap';

export interface EnemyCharacterAnimationSelection {
  mode: EnemyCharacterAnimationMode;
  clipName: string;
  progress: number;
  attackProfile?: EnemyAttackAnimationProfile;
  attackId?: string;
}

export const ENEMY_ANIMATION_PRIORITY = ['DEAD', 'STAGGER', 'HURT', 'ATTACK', 'ALERT', 'MOVEMENT', 'IDLE'] as const;
const movementStates = new Set<WorldEnemy['state']>(['AGGRO', 'APPROACH', 'CHASE', 'REPOSITION', 'RETREAT']);
const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));
const progressFor = (remaining: number, duration: number): number => clampUnit(1 - Math.max(0, remaining) / Math.max(0.01, duration));

function attackIdForState(enemy: WorldEnemy): string | undefined {
  if (enemy.state === 'RECOVER') return enemy.lastAttackId ?? enemy.activeAttackId;
  return enemy.activeAttackId ?? enemy.lastAttackId;
}

export function resolveEnemyAnimationAttack(enemy: WorldEnemy): EnemyAttackDefinition | undefined {
  return getEnemyAttackDefinition(enemy.attackSetId, attackIdForState(enemy), enemy.phase ?? 1);
}

export function getEnemyAttackAnimationProfile(enemy: WorldEnemy, attack?: EnemyAttackDefinition): EnemyAttackAnimationProfile {
  const attackId = attack?.id ?? attackIdForState(enemy) ?? '';
  const authored = getCharacterRigDefinition(enemy.visualId)?.attackStyles[attackId];
  if (authored) return authored;
  if (attack?.statusEffect?.statusId === 'GUARD' || attackId.includes('guard')) return 'guard';
  if (attack?.motion === 'LEAP' || attackId.includes('leap')) return 'leap';
  if (attack?.motion === 'CHARGE' || attack?.shape === 'CHARGE' || attackId.includes('charge') || attackId.includes('lunge')) return 'lunge';
  if (attack && ['PROJECTILE', 'DRAIN', 'RITUAL', 'SIGIL', 'CURSE'].includes(attack.shape)) return 'cast';
  if (attack?.shape === 'BUFF') return 'guard';
  return 'melee';
}

/** Selects a deterministic visual clip from the current combat snapshot; it owns no gameplay state. */
export function selectEnemyCharacterAnimation(enemy: WorldEnemy): EnemyCharacterAnimationSelection {
  if (enemy.state === 'DEAD' || enemy.health <= 0) {
    return { mode: 'DEAD', clipName: 'death', progress: progressFor(enemy.stateTimer, ENEMY_DEATH_ANIMATION_SECONDS) };
  }
  if (enemy.state === 'STAGGER') {
    return { mode: 'STAGGER', clipName: 'stagger', progress: progressFor(enemy.stateTimer, 0.42) };
  }
  if (enemy.state === 'HURT') {
    return { mode: 'HURT', clipName: 'hurt', progress: progressFor(enemy.stateTimer, 0.2) };
  }
  if (enemy.state === 'ATTACK_WINDUP' || enemy.state === 'ATTACK_ACTIVE' || enemy.state === 'ATTACK' || enemy.state === 'RECOVER') {
    const attack = resolveEnemyAnimationAttack(enemy);
    const profile = getEnemyAttackAnimationProfile(enemy, attack);
    const phase = enemy.state === 'ATTACK_WINDUP'
      ? 'windup'
      : enemy.state === 'RECOVER' ? 'recovery' : 'impact';
    const duration = phase === 'windup'
      ? attack?.windupSeconds ?? enemy.attackTelegraphSeconds
      : phase === 'recovery' ? attack?.recoverySeconds ?? 0.62 : attack?.activeSeconds ?? 0.12;
    const mode: EnemyCharacterAnimationMode = profile === 'cast'
      ? 'CAST'
      : profile === 'guard' ? 'GUARD' : phase === 'windup' ? 'WINDUP' : phase === 'recovery' ? 'RECOVERY' : 'IMPACT';
    return {
      mode,
      clipName: `${profile}_${phase}`,
      progress: progressFor(enemy.stateTimer, duration),
      attackProfile: profile,
      attackId: attack?.id ?? attackIdForState(enemy),
    };
  }
  if (enemy.state === 'ALERT' || enemy.state === 'AGGRO') {
    return { mode: 'ALERT', clipName: 'alert', progress: progressFor(enemy.stateTimer, enemy.isBoss ? 0.32 : 0.2) };
  }
  if (movementStates.has(enemy.state)) return { mode: 'RUN', clipName: 'run', progress: 0 };
  return { mode: 'IDLE', clipName: 'idle', progress: 0 };
}

export function isEnemyInMovementState(enemy: WorldEnemy): boolean {
  return movementStates.has(enemy.state);
}
