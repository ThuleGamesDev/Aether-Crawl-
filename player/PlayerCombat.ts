import type { PlayerCharacter } from '../types';
import { CLASS_ABILITY_LOADOUT, getAbility, getAbilityDamageType, type AbilityDefinition } from '../combat/AbilityRegistry';
import { calculateDerivedStats } from './DerivedStats';
import { actionSpeedMultiplier } from '../combat/StatusSystem';
import { combineActionSpeedMultipliers } from '../combat/actionSpeed';
import { isDualWieldLoadout } from '../services/equipmentRules';
import type { EquipmentSlot } from '../types';
import { abilityStaminaCost, STAMINA_RULES } from '../combat/CombatMastery';

export type PlayerActionPhase = 'WINDUP' | 'ACTIVE' | 'RECOVERY';

export interface ActivePlayerAction {
  abilityId: string;
  phase: PlayerActionPhase;
  remainingSeconds: number;
  damageMultiplier: number;
  /** Captured when the action starts so equipment changes cannot alter a live animation. */
  speedMultiplier?: number;
  /** Active-window progress is persisted so a save cannot replay a multi-hit pulse. */
  hitIndex?: number;
  hitCount?: number;
  nextHitSeconds?: number;
  /** A class passive is resolved once per action and reused by every pulse. */
  classPassiveResolved?: boolean;
  classPassiveMultiplier?: number;
  classMeleeRecorded?: boolean;
  /** Captured hand for one melee hit sequence; weapon effects are still resolved once per hit. */
  weaponSlot?: Extract<EquipmentSlot, 'mainHand' | 'offHand'>;
}

export interface PlayerActionStart {
  player: PlayerCharacter;
  ability: AbilityDefinition | null;
  error?: string;
}

export interface PlayerCombatSaveState {
  cooldowns: Record<string, number>;
  action: ActivePlayerAction | null;
  nextMeleeWeaponSlot?: Extract<EquipmentSlot, 'mainHand' | 'offHand'>;
}

export class PlayerCombat {
  private readonly cooldowns = new Map<string, number>();
  private activeAction: ActivePlayerAction | null = null;
  private nextMeleeWeaponSlot: Extract<EquipmentSlot, 'mainHand' | 'offHand'> = 'mainHand';

  get action(): ActivePlayerAction | null { return this.activeAction ? { ...this.activeAction } : null; }

  snapshot(): PlayerCombatSaveState {
    return { cooldowns: Object.fromEntries(this.cooldowns), action: this.action, nextMeleeWeaponSlot: this.nextMeleeWeaponSlot };
  }

  restore(state?: PlayerCombatSaveState): void {
    this.reset();
    if (!state) return;
    this.nextMeleeWeaponSlot = state.nextMeleeWeaponSlot === 'offHand' ? 'offHand' : 'mainHand';
    for (const [id, cooldown] of Object.entries(state.cooldowns)) if (cooldown > 0) this.cooldowns.set(id, cooldown);
    if (!state.action) return;
    const actionAlreadyStarted = state.action.phase !== 'WINDUP';
    this.activeAction = {
      hitIndex: actionAlreadyStarted ? 1 : 0,
      hitCount: 1,
      nextHitSeconds: 0,
      speedMultiplier: 1,
      classPassiveResolved: false,
      classPassiveMultiplier: 1,
      classMeleeRecorded: false,
      ...state.action,
    };
  }

  getCooldown(abilityId: string): number { return Math.max(0, this.cooldowns.get(abilityId) ?? 0); }

  /** Cancels an in-flight animation/action after an equipment transaction while preserving its cooldown. */
  cancelActiveAction(): void { this.activeAction = null; }

  start(player: PlayerCharacter, abilityId: string, chargeSeconds = 0): PlayerActionStart {
    if (this.activeAction) return { player, ability: null, error: 'Recovering from the current action.' };
    const ability = getAbility(abilityId);
    if (!ability) return { player, ability: null, error: 'That skill is not available.' };
    if (this.getCooldown(abilityId) > 0) return { player, ability: null, error: ability.name + ' is not ready.' };
    const derived = calculateDerivedStats(player);
    const manaCost = ability.manaCost * derived.manaCostMultiplier;
    if (player.stats.mp < manaCost) return { player, ability: null, error: 'Not enough mana.' };
    let weaponSlot: Extract<EquipmentSlot, 'mainHand' | 'offHand'> = 'mainHand';
    if (ability.kind === 'MELEE' && isDualWieldLoadout(player.equipment)) weaponSlot = this.nextMeleeWeaponSlot;
    const isClassSkill = CLASS_ABILITY_LOADOUT[player.classId].skillSlots.includes(abilityId);
    const staminaCost = isClassSkill ? 0 : abilityStaminaCost(ability, player, weaponSlot);
    const currentStamina = Math.max(0, Math.min(derived.maxStamina, Number.isFinite(player.stats.stamina) ? player.stats.stamina! : derived.maxStamina));
    if (currentStamina < staminaCost) return { player, ability: null, error: 'Not enough stamina.' };
    const baseSpeedMultiplier = getAbilityDamageType(ability) === 'SPELL' ? derived.castSpeedMultiplier : derived.attackSpeedMultiplier;
    const speedMultiplier = combineActionSpeedMultipliers(baseSpeedMultiplier, actionSpeedMultiplier(player.statusEffects));
    const chargeScale = ability.chargeMinSeconds
      ? 1 + Math.max(0, Math.min(0.65, (chargeSeconds - ability.chargeMinSeconds) * 0.45))
      : 1;
    this.cooldowns.set(abilityId, ability.cooldownSeconds * derived.cooldownMultiplier);
    if (ability.kind === 'MELEE' && isDualWieldLoadout(player.equipment)) {
      this.nextMeleeWeaponSlot = weaponSlot === 'mainHand' ? 'offHand' : 'mainHand';
    }
    this.activeAction = {
      abilityId, phase: 'WINDUP', remainingSeconds: ability.windupSeconds / speedMultiplier,
      damageMultiplier: chargeScale, speedMultiplier,
      hitIndex: 0, hitCount: Math.max(1, Math.min(8, Math.floor(ability.activeHitCount ?? 1))), nextHitSeconds: 0,
      classPassiveResolved: false, classPassiveMultiplier: 1,
      classMeleeRecorded: false, weaponSlot,
    };
    return { player: { ...player, stats: {
      ...player.stats,
      mp: player.stats.mp - manaCost,
      stamina: currentStamina - staminaCost,
      staminaRegenDelaySeconds: staminaCost > 0 ? STAMINA_RULES.regenerationDelaySeconds : player.stats.staminaRegenDelaySeconds ?? 0,
    } }, ability };
  }

  update(deltaSeconds: number): { activeStarted: boolean; activeHitIndices: number[]; completed: boolean; action: ActivePlayerAction | null } {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    for (const [id, cooldown] of this.cooldowns) {
      const next = Math.max(0, cooldown - dt);
      if (next === 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, next);
    }
    if (!this.activeAction) return { activeStarted: false, activeHitIndices: [], completed: false, action: null };
    this.activeAction.remainingSeconds = Math.max(0, this.activeAction.remainingSeconds - dt);
    if (this.activeAction.phase === 'WINDUP') {
      if (this.activeAction.remainingSeconds > 0) return { activeStarted: false, activeHitIndices: [], completed: false, action: this.action };
      const ability = getAbility(this.activeAction.abilityId)!;
      this.activeAction.phase = 'ACTIVE';
      this.activeAction.remainingSeconds = ability.activeSeconds / (this.activeAction.speedMultiplier ?? 1);
      this.activeAction.hitCount = Math.max(1, Math.min(8, Math.floor(ability.activeHitCount ?? 1)));
      this.activeAction.hitIndex = 1;
      this.activeAction.nextHitSeconds = this.activeAction.remainingSeconds / this.activeAction.hitCount;
      return { activeStarted: true, activeHitIndices: [0], completed: false, action: this.action };
    }
    if (this.activeAction.phase === 'ACTIVE') {
      const ability = getAbility(this.activeAction.abilityId)!;
      const hitCount = Math.max(1, this.activeAction.hitCount ?? ability.activeHitCount ?? 1);
      const activeDuration = ability.activeSeconds / (this.activeAction.speedMultiplier ?? 1);
      const activeHitIndices: number[] = [];
      this.activeAction.nextHitSeconds = (this.activeAction.nextHitSeconds ?? activeDuration) - dt;
      while ((this.activeAction.hitIndex ?? 1) < hitCount && (this.activeAction.nextHitSeconds ?? 0) <= 0.000001) {
        activeHitIndices.push(this.activeAction.hitIndex ?? 1);
        this.activeAction.hitIndex = (this.activeAction.hitIndex ?? 1) + 1;
        this.activeAction.nextHitSeconds = (this.activeAction.nextHitSeconds ?? 0) + activeDuration / hitCount;
      }
      if (this.activeAction.remainingSeconds <= 0) {
        this.activeAction.phase = 'RECOVERY';
        this.activeAction.remainingSeconds = ability.recoverySeconds / (this.activeAction.speedMultiplier ?? 1);
        this.activeAction.nextHitSeconds = 0;
      }
      return { activeStarted: activeHitIndices.length > 0, activeHitIndices, completed: false, action: this.action };
    }
    if (this.activeAction.remainingSeconds > 0) return { activeStarted: false, activeHitIndices: [], completed: false, action: this.action };
    this.activeAction = null;
    return { activeStarted: false, activeHitIndices: [], completed: true, action: null };
  }

  reset(): void {
    this.cooldowns.clear();
    this.activeAction = null;
    this.nextMeleeWeaponSlot = 'mainHand';
  }

  setClassPassiveResult(multiplier: number): void {
    if (!this.activeAction || this.activeAction.phase !== 'ACTIVE') return;
    this.activeAction.classPassiveResolved = true;
    this.activeAction.classPassiveMultiplier = Number.isFinite(multiplier) ? Math.max(0.25, Math.min(2.5, multiplier)) : 1;
  }

  markClassMeleeRecorded(): void {
    if (this.activeAction?.phase === 'ACTIVE') this.activeAction.classMeleeRecorded = true;
  }
}

export const classAbilityIds = (player: PlayerCharacter) => CLASS_ABILITY_LOADOUT[player.classId];
