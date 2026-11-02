import { getAbilityDamageType, type AbilityDefinition } from '../combat/AbilityRegistry';
import type { ClassPassiveState, ClassType, PlayerCharacter, WorldEnemy } from '../types';

export interface ClassPassiveActionResult {
  state: ClassPassiveState | undefined;
  damageMultiplier: number;
  passiveName?: string;
}

export function createClassPassiveState(classId: ClassType): ClassPassiveState | undefined {
  if (classId === 'BARBARIAN') return { passiveId: 'war_momentum', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  if (classId === 'PALADIN') return { passiveId: 'unbroken_line', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  if (classId === 'SORCERER') return { passiveId: 'omen_weaving', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0, lastSchool: null };
  if (classId === 'ROGUE') return { passiveId: 'opportunist', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  return undefined;
}

export function normalizeClassPassiveState(classId: ClassType, state?: ClassPassiveState): ClassPassiveState | undefined {
  const expected = createClassPassiveState(classId);
  if (!expected) return undefined;
  if (!state || state.passiveId !== expected.passiveId) return expected;
  if (state.passiveId === 'war_momentum') return { ...state, stacks: clampInt(state.stacks, 0, 5), remainingSeconds: clamp(state.remainingSeconds, 0, 3), cooldownRemaining: 0, charges: 0 };
  if (state.passiveId === 'unbroken_line') return { ...state, stacks: 0, remainingSeconds: clamp(state.remainingSeconds, 0, 3), cooldownRemaining: clamp(state.cooldownRemaining, 0, 4), charges: state.charges === 1 && state.remainingSeconds > 0 ? 1 : 0 };
  if (state.passiveId === 'omen_weaving') return { ...state, stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0, lastSchool: ['FIRE', 'LIGHTNING', 'ARCANE'].includes(String(state.lastSchool)) ? state.lastSchool : null };
  return { ...state, stacks: 0, remainingSeconds: clamp(state.remainingSeconds, 0, 2.5), cooldownRemaining: clamp(state.cooldownRemaining, 0, 2), charges: state.charges === 1 && state.remainingSeconds > 0 ? 1 : 0 };
}

export function tickClassPassiveState(state: ClassPassiveState | undefined, deltaSeconds: number): ClassPassiveState | undefined {
  if (!state) return undefined;
  const dt = clamp(deltaSeconds, 0, 0.05);
  if (state.passiveId === 'war_momentum') {
    const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
    return { ...state, remainingSeconds, stacks: remainingSeconds > 0 ? state.stacks : 0 };
  }
  if (state.passiveId === 'unbroken_line') {
    const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
    return { ...state, remainingSeconds, cooldownRemaining: Math.max(0, state.cooldownRemaining - dt), charges: remainingSeconds > 0 ? state.charges : 0 };
  }
  if (state.passiveId === 'opportunist') {
    const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
    return { ...state, remainingSeconds, cooldownRemaining: Math.max(0, state.cooldownRemaining - dt), charges: remainingSeconds > 0 ? state.charges : 0 };
  }
  return state;
}

export function recordClassDodge(player: PlayerCharacter): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'opportunist' || state.cooldownRemaining > 0) return { ...player, classPassiveState: state };
  return { ...player, classPassiveState: { ...state, charges: 1, remainingSeconds: 2.5 } };
}

export function recordClassBlock(player: PlayerCharacter): { player: PlayerCharacter; activated: boolean } {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'unbroken_line' || state.cooldownRemaining > 0) return { player: { ...player, classPassiveState: state }, activated: false };
  return {
    player: { ...player, classPassiveState: { ...state, charges: 1, remainingSeconds: 3, cooldownRemaining: 4 } },
    activated: true,
  };
}

/** Resolves one ability hit against the class passive state; no passive emits another hit. */
export function resolveClassPassiveAction(
  player: PlayerCharacter,
  ability: AbilityDefinition,
  targets: readonly WorldEnemy[],
): ClassPassiveActionResult {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (!state) return { state: undefined, damageMultiplier: 1 };
  let damageMultiplier = 1;
  let nextState = state;
  let passiveName: string | undefined;

  if (state.passiveId === 'war_momentum' && ability.kind === 'MELEE' && getAbilityDamageType(ability) === 'PHYSICAL') {
    damageMultiplier *= 1 + state.stacks * 0.04;
    if (state.stacks > 0) passiveName = 'War Momentum';
  } else if (state.passiveId === 'unbroken_line' && state.charges > 0 && state.remainingSeconds > 0 && ability.kind === 'MELEE' && targets.length > 0) {
    damageMultiplier *= 1.18;
    nextState = { ...state, charges: 0, remainingSeconds: 0 };
    passiveName = 'Unbroken Line';
  } else if (state.passiveId === 'omen_weaving' && ability.element) {
    if (state.lastSchool && state.lastSchool !== ability.element) {
      damageMultiplier *= 1.18;
      passiveName = 'Omen Weaving';
    }
    nextState = { ...state, lastSchool: ability.element };
  } else if (state.passiveId === 'opportunist' && (ability.kind === 'MELEE' || ability.kind === 'PROJECTILE') && targets.length > 0) {
    const targetWindow = targets.some(enemy => isStaggered(enemy) || isFlanked(player, enemy));
    if ((state.charges > 0 && state.remainingSeconds > 0) || (targetWindow && state.cooldownRemaining <= 0)) {
      damageMultiplier *= 1.22;
      nextState = { ...state, charges: 0, remainingSeconds: 0, cooldownRemaining: 2 };
      passiveName = 'Opportunist';
    }
  }
  return { state: nextState, damageMultiplier, passiveName };
}

/** Builds one momentum stack per successful melee action, never per target or hit pulse. */
export function recordClassMeleeAction(player: PlayerCharacter, ability: AbilityDefinition): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'war_momentum' || ability.kind !== 'MELEE' || getAbilityDamageType(ability) !== 'PHYSICAL') {
    return { ...player, classPassiveState: state };
  }
  return { ...player, classPassiveState: { ...state, stacks: Math.min(5, state.stacks + 1), remainingSeconds: 3 } };
}

export function classPassiveStackSummary(state: ClassPassiveState | undefined): string | null {
  if (!state) return null;
  if (state.passiveId === 'war_momentum' && state.stacks > 0) return `${state.stacks}/5 · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'unbroken_line' && state.charges > 0) return `Counter ready · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'omen_weaving' && state.lastSchool) return `Last school · ${state.lastSchool.toLowerCase()}`;
  if (state.passiveId === 'opportunist' && state.charges > 0) return `Opportunity · ${state.remainingSeconds.toFixed(1)}s`;
  return null;
}

function isStaggered(enemy: WorldEnemy): boolean {
  return enemy.state === 'STAGGER' || (enemy.statusEffects ?? []).some(status => status.statusId === 'STAGGER' && status.durationSeconds > 0);
}

function isFlanked(player: PlayerCharacter, enemy: WorldEnemy): boolean {
  if (enemy.facingYaw === undefined) return false;
  const towardPlayer = Math.atan2(player.position.z - enemy.position.z, player.position.x - enemy.position.x);
  const difference = Math.atan2(Math.sin(towardPlayer - enemy.facingYaw), Math.cos(towardPlayer - enemy.facingYaw));
  return Math.abs(difference) >= Math.PI * 0.68;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum;
}

function clampInt(value: number, minimum: number, maximum: number): number {
  return Math.trunc(clamp(value, minimum, maximum));
}
