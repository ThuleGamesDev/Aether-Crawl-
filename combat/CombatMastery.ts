import type { PlayerCharacter, Vector3Like, WorldEnemy } from '../types';
import { getEnemyAttackTelegraphDescriptor } from '../data/enemyAttackTelegraph';
import type { EnemyAttackDefinition } from '../data/enemyAttacks';
import type { AbilityDefinition } from './AbilityRegistry';
import { isTwoHandedItem } from '../services/equipmentRules';

export const STAMINA_RULES = {
  defaultMaximum: 100,
  baseRegenerationPerSecond: 24,
  regenerationDelaySeconds: 0.65,
  dodgeCost: 22,
  parryCost: 18,
  shieldDrainPerSecond: 9,
  parryWindowSeconds: 0.2,
  parryRecoverySeconds: 0.58,
  perfectDodgeWindowSeconds: 0.14,
  perfectDodgeCounterMagnitude: 0.18,
  perfectDodgeCounterSeconds: 1.1,
} as const;

export interface EnemyPoiseProfile {
  maximum: number;
  recoveryPerSecond: number;
  breakSeconds: number;
  breakRecoverySeconds: number;
  immunitySeconds: number;
  bossResistance: number;
}

const PILOT_POISE: Readonly<Record<string, EnemyPoiseProfile>> = {
  rat: { maximum: 38, recoveryPerSecond: 19, breakSeconds: 0.72, breakRecoverySeconds: 1.2, immunitySeconds: 1.1, bossResistance: 1 },
  revenant: { maximum: 66, recoveryPerSecond: 15, breakSeconds: 0.78, breakRecoverySeconds: 1.45, immunitySeconds: 1.35, bossResistance: 1 },
  bull_enforcer: { maximum: 86, recoveryPerSecond: 13, breakSeconds: 0.76, breakRecoverySeconds: 1.55, immunitySeconds: 1.5, bossResistance: 1 },
  gatekeeper: { maximum: 136, recoveryPerSecond: 9, breakSeconds: 0.52, breakRecoverySeconds: 1.8, immunitySeconds: 1.8, bossResistance: 0.48 },
};

export function getEnemyPoiseProfile(enemy: Pick<WorldEnemy, 'attackSetId'>): EnemyPoiseProfile | null {
  return enemy.attackSetId ? PILOT_POISE[enemy.attackSetId] ?? null : null;
}

export function initializeEnemyPoise(enemy: WorldEnemy): WorldEnemy {
  const profile = getEnemyPoiseProfile(enemy);
  if (!profile) return enemy;
  const maximum = finiteClamp(enemy.maxPoise ?? profile.maximum, 1, 1000, profile.maximum);
  return {
    ...enemy,
    maxPoise: maximum,
    poise: finiteClamp(enemy.poise ?? maximum, 0, maximum, maximum),
    poiseRecoveryDelaySeconds: finiteClamp(enemy.poiseRecoveryDelaySeconds ?? 0, 0, 10, 0),
    poiseBreakRecoverySeconds: finiteClamp(enemy.poiseBreakRecoverySeconds ?? 0, 0, 10, 0),
    staggerImmunitySeconds: finiteClamp(enemy.staggerImmunitySeconds ?? 0, 0, 10, 0),
    phaseTransitionLockSeconds: finiteClamp(enemy.phaseTransitionLockSeconds ?? 0, 0, 5, 0),
  };
}

export function tickEnemyPoise(enemy: WorldEnemy, deltaSeconds: number): WorldEnemy {
  const profile = getEnemyPoiseProfile(enemy);
  const dt = Math.max(0, Math.min(0.05, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  if (!profile) {
    const currentPhaseLock = enemy.phaseTransitionLockSeconds ?? 0;
    if (currentPhaseLock <= 0) return enemy;
    return { ...enemy, phaseTransitionLockSeconds: Math.max(0, currentPhaseLock - dt) };
  }
  const initialized = initializeEnemyPoise(enemy);
  const breakRecovery = Math.max(0, (initialized.poiseBreakRecoverySeconds ?? 0) - dt);
  const immunity = Math.max(0, (initialized.staggerImmunitySeconds ?? 0) - dt);
  const phaseLock = Math.max(0, (initialized.phaseTransitionLockSeconds ?? 0) - dt);
  const delay = Math.max(0, (initialized.poiseRecoveryDelaySeconds ?? 0) - dt);
  const canRecover = breakRecovery <= 0 && immunity <= 0 && phaseLock <= 0 && delay <= 0;
  const poise = canRecover
    ? Math.min(initialized.maxPoise!, (initialized.poise ?? initialized.maxPoise!) + profile.recoveryPerSecond * dt)
    : initialized.poise!;
  return { ...initialized, poise, poiseRecoveryDelaySeconds: delay, poiseBreakRecoverySeconds: breakRecovery, staggerImmunitySeconds: immunity, phaseTransitionLockSeconds: phaseLock };
}

export function applyEnemyPoiseDamage(enemy: WorldEnemy, requestedDamage: number): { enemy: WorldEnemy; applied: number; broken: boolean } {
  const profile = getEnemyPoiseProfile(enemy);
  if (!profile || enemy.health <= 0) return { enemy, applied: 0, broken: false };
  const initialized = initializeEnemyPoise(enemy);
  if ((initialized.poiseBreakRecoverySeconds ?? 0) > 0 || (initialized.staggerImmunitySeconds ?? 0) > 0 || (initialized.phaseTransitionLockSeconds ?? 0) > 0) {
    return { enemy: initialized, applied: 0, broken: false };
  }
  const resistance = enemy.isBoss ? profile.bossResistance : 1;
  const applied = Math.max(0, Math.min(1000, Number.isFinite(requestedDamage) ? requestedDamage : 0)) * resistance;
  const remaining = Math.max(0, (initialized.poise ?? profile.maximum) - applied);
  if (remaining > 0) {
    return { enemy: { ...initialized, poise: remaining, poiseRecoveryDelaySeconds: 1.05 }, applied, broken: false };
  }
  return {
    enemy: {
      ...initialized,
      poise: 0,
      poiseRecoveryDelaySeconds: profile.breakRecoverySeconds,
      poiseBreakRecoverySeconds: profile.breakSeconds,
      staggerImmunitySeconds: profile.immunitySeconds,
      state: 'STAGGER',
      stateTimer: profile.breakSeconds,
      attackCooldown: Math.max(enemy.attackCooldown, profile.breakSeconds + 0.35),
      activeAttackId: undefined,
      telegraphPosition: undefined,
    },
    applied,
    broken: true,
  };
}

export function abilityStaminaCost(ability: AbilityDefinition, player: PlayerCharacter, weaponSlot: 'mainHand' | 'offHand'): number {
  const base = Math.max(0, Number.isFinite(ability.staminaCost) ? ability.staminaCost! : 0);
  if (!base) return 0;
  const handItem = player.equipment[weaponSlot];
  const handScale = weaponSlot === 'offHand' ? 0.88
    : isTwoHandedItem(handItem) ? 1.18 : 1;
  return Math.round(base * handScale * 10) / 10;
}

export function abilityPoiseDamage(ability: AbilityDefinition, player: PlayerCharacter, weaponSlot: 'mainHand' | 'offHand'): number {
  if (ability.kind !== 'MELEE') return Math.max(0, ability.poiseDamage ?? 0);
  const styleScale = ability.meleeStyle === 'BASH' ? 1.18 : ability.meleeStyle === 'THRUST' ? 1.04 : ability.meleeStyle === 'UNARMED' ? 0.72 : 0.88;
  const base = Math.max(0, ability.poiseDamage ?? (ability.staggerSeconds ? 18 : 11));
  const handItem = player.equipment[weaponSlot];
  const handScale = weaponSlot === 'offHand' ? 0.82 : isTwoHandedItem(handItem) ? 1.5 : 1;
  return Math.min(100, base * styleScale * handScale);
}

export function enemyAttackContainsPoint(
  attack: EnemyAttackDefinition,
  origin: Vector3Like,
  facingYaw: number,
  point: Vector3Like,
  telegraphTarget: Vector3Like = point,
): boolean {
  const descriptor = getEnemyAttackTelegraphDescriptor(attack);
  const center = descriptor.center === 'target' ? telegraphTarget : origin;
  const dx = point.x - center.x;
  const dz = point.z - center.z;
  const distance = Math.hypot(dx, dz);
  if (distance > descriptor.radius) return false;
  if (attack.shape === 'CONE' || attack.shape === 'CHARGE') {
    const targetYaw = Math.atan2(dz, dx);
    const difference = Math.atan2(Math.sin(targetYaw - facingYaw), Math.cos(targetYaw - facingYaw));
    return Math.abs(difference) <= descriptor.arcRadians / 2;
  }
  return attack.shape === 'MELEE' || attack.shape === 'SLAM' || attack.shape === 'RITUAL'
    || attack.shape === 'SIGIL' || attack.shape === 'CURSE';
}

function finiteClamp(value: number, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}
