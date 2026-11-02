import { getAbilityDamageType, type AbilityDefinition } from '../combat/AbilityRegistry';
import { applyRealtimeStatus } from '../combat/StatusSystem';
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
  if (classId === 'RANGER') return { passiveId: 'marked_prey', targetId: null, stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  if (classId === 'CLERIC') return { passiveId: 'measured_remedy', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  if (classId === 'MONK') return { passiveId: 'flow_state', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  if (classId === 'NECROMANCER') return { passiveId: 'soul_tribute', stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0 };
  return undefined;
}

export function normalizeClassPassiveState(classId: ClassType, state?: ClassPassiveState): ClassPassiveState | undefined {
  const expected = createClassPassiveState(classId);
  if (!expected) return undefined;
  if (!state || state.passiveId !== expected.passiveId) return expected;
  if (state.passiveId === 'war_momentum') return { ...state, stacks: clampInt(state.stacks, 0, 5), remainingSeconds: clamp(state.remainingSeconds, 0, 3), cooldownRemaining: 0, charges: 0 };
  if (state.passiveId === 'unbroken_line') return { ...state, stacks: 0, remainingSeconds: clamp(state.remainingSeconds, 0, 3), cooldownRemaining: clamp(state.cooldownRemaining, 0, 4), charges: state.charges === 1 && state.remainingSeconds > 0 ? 1 : 0 };
  if (state.passiveId === 'omen_weaving') return { ...state, stacks: 0, remainingSeconds: 0, cooldownRemaining: 0, charges: 0, lastSchool: ['FIRE', 'LIGHTNING', 'ARCANE'].includes(String(state.lastSchool)) ? state.lastSchool : null };
  if (state.passiveId === 'opportunist') return { ...state, stacks: 0, remainingSeconds: clamp(state.remainingSeconds, 0, 2.5), cooldownRemaining: clamp(state.cooldownRemaining, 0, 2), charges: state.charges === 1 && state.remainingSeconds > 0 ? 1 : 0 };
  if (state.passiveId === 'marked_prey') return { ...state, targetId: typeof state.targetId === 'string' ? state.targetId.slice(0, 120) : null, stacks: clampInt(state.stacks, 0, 3), remainingSeconds: clamp(state.remainingSeconds, 0, 4), cooldownRemaining: 0, charges: 0 };
  if (state.passiveId === 'measured_remedy') return { ...state, stacks: 0, remainingSeconds: 0, cooldownRemaining: clamp(state.cooldownRemaining, 0, 10), charges: 0 };
  if (state.passiveId === 'flow_state') return { ...state, stacks: clampInt(state.stacks, 0, 5), remainingSeconds: clamp(state.remainingSeconds, 0, 1.6), cooldownRemaining: 0, charges: 0 };
  return { ...state, stacks: clampInt(state.stacks, 0, 3), remainingSeconds: clamp(state.remainingSeconds, 0, 4), cooldownRemaining: clamp(state.cooldownRemaining, 0, 10), charges: state.charges === 1 && state.remainingSeconds > 0 ? 1 : 0 };
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
  if (state.passiveId === 'marked_prey') {
    const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
    return { ...state, remainingSeconds, stacks: remainingSeconds > 0 ? state.stacks : 0, targetId: remainingSeconds > 0 ? state.targetId : null };
  }
  if (state.passiveId === 'measured_remedy') return { ...state, cooldownRemaining: Math.max(0, state.cooldownRemaining - dt) };
  if (state.passiveId === 'flow_state') {
    const remainingSeconds = Math.max(0, state.remainingSeconds - dt);
    return { ...state, remainingSeconds, stacks: remainingSeconds > 0 ? state.stacks : 0 };
  }
  if (state.passiveId === 'soul_tribute') {
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
  } else if (state.passiveId === 'marked_prey' && ability.kind === 'PROJECTILE' && targets.length > 0
    && state.targetId === targets[0].id && state.stacks > 0 && state.remainingSeconds > 0) {
    damageMultiplier *= 1 + state.stacks * 0.06;
    nextState = { ...state, targetId: null, stacks: 0, remainingSeconds: 0 };
    passiveName = 'Marked Prey';
  } else if (state.passiveId === 'flow_state' && ability.kind === 'MELEE' && getAbilityDamageType(ability) === 'PHYSICAL') {
    damageMultiplier *= 1 + state.stacks * 0.03;
    if (state.stacks > 0) passiveName = 'Flow State';
  } else if (state.passiveId === 'soul_tribute' && state.charges > 0 && state.remainingSeconds > 0
    && getAbilityDamageType(ability) === 'SPELL') {
    damageMultiplier *= 1.2;
    nextState = { ...state, charges: 0, remainingSeconds: 0 };
    passiveName = 'Soul Tribute';
  }
  return { state: nextState, damageMultiplier, passiveName };
}

/** Builds one momentum stack per successful melee action, never per target or hit pulse. */
export function recordClassMeleeAction(player: PlayerCharacter, ability: AbilityDefinition): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (ability.kind !== 'MELEE' || getAbilityDamageType(ability) !== 'PHYSICAL') {
    return { ...player, classPassiveState: state };
  }
  if (state?.passiveId === 'war_momentum') return { ...player, classPassiveState: { ...state, stacks: Math.min(5, state.stacks + 1), remainingSeconds: 3 } };
  if (state?.passiveId === 'flow_state') return { ...player, classPassiveState: { ...state, stacks: Math.min(5, state.stacks + 1), remainingSeconds: 1.6 } };
  return { ...player, classPassiveState: state };
}

/** Builds bounded focus only from a direct arrow impact on the currently aimed target. */
export function recordMarkedPreyHit(player: PlayerCharacter, targetId: string): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'marked_prey') return { ...player, classPassiveState: state };
  const sameTarget = state.targetId === targetId && state.remainingSeconds > 0;
  return { ...player, classPassiveState: { ...state, targetId, stacks: sameTarget ? Math.min(3, state.stacks + 1) : 1, remainingSeconds: 4 } };
}

/** Counts only one successful enemy reward; one charge empowers one later Shadebinder spell. */
export function recordClassKill(player: PlayerCharacter): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'soul_tribute' || state.cooldownRemaining > 0 || state.charges > 0) return { ...player, classPassiveState: state };
  const stacks = state.stacks + 1;
  return stacks < 3
    ? { ...player, classPassiveState: { ...state, stacks } }
    : { ...player, classPassiveState: { ...state, stacks: 0, charges: 1, remainingSeconds: 4, cooldownRemaining: 10 } };
}

/** Crossing half health through actual healing grants one short guard window, at most every 10 seconds. */
export function recordClassHealing(player: PlayerCharacter, previousHealth: number, nextHealth: number, maximumHealth: number): PlayerCharacter {
  const state = normalizeClassPassiveState(player.classId, player.classPassiveState);
  if (state?.passiveId !== 'measured_remedy' || state.cooldownRemaining > 0
    || previousHealth >= maximumHealth * 0.5 || nextHealth < maximumHealth * 0.5) return { ...player, classPassiveState: state };
  return {
    ...player,
    classPassiveState: { ...state, cooldownRemaining: 10 },
    statusEffects: applyRealtimeStatus(player.statusEffects, { statusId: 'GUARD', durationSeconds: 2.25, magnitude: 0.22 }, 'measured_remedy'),
  };
}

export function classPassiveStackSummary(state: ClassPassiveState | undefined): string | null {
  if (!state) return null;
  if (state.passiveId === 'war_momentum' && state.stacks > 0) return `${state.stacks}/5 · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'unbroken_line' && state.charges > 0) return `Counter ready · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'omen_weaving' && state.lastSchool) return `Last school · ${state.lastSchool.toLowerCase()}`;
  if (state.passiveId === 'opportunist' && state.charges > 0) return `Opportunity · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'marked_prey' && state.stacks > 0) return `${state.stacks}/3 focus · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'measured_remedy' && state.cooldownRemaining > 0) return `Remedy · ${state.cooldownRemaining.toFixed(0)}s`;
  if (state.passiveId === 'flow_state' && state.stacks > 0) return `${state.stacks}/5 flow · ${state.remainingSeconds.toFixed(1)}s`;
  if (state.passiveId === 'soul_tribute') return state.charges > 0 ? `Tribute ready · ${state.remainingSeconds.toFixed(1)}s` : `${state.stacks}/3 souls`;
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
