import type { PlayerCharacter } from '../types';
import { CLASS_ABILITY_LOADOUT, getAbility, type AbilityDefinition } from '../combat/AbilityRegistry';

export type PlayerActionPhase = 'WINDUP' | 'ACTIVE' | 'RECOVERY';

export interface ActivePlayerAction {
  abilityId: string;
  phase: PlayerActionPhase;
  remainingSeconds: number;
  damageMultiplier: number;
}

export interface PlayerActionStart {
  player: PlayerCharacter;
  ability: AbilityDefinition | null;
  error?: string;
}

export interface PlayerCombatSaveState {
  cooldowns: Record<string, number>;
  action: ActivePlayerAction | null;
}

export class PlayerCombat {
  private readonly cooldowns = new Map<string, number>();
  private activeAction: ActivePlayerAction | null = null;

  get action(): ActivePlayerAction | null { return this.activeAction ? { ...this.activeAction } : null; }

  snapshot(): PlayerCombatSaveState {
    return { cooldowns: Object.fromEntries(this.cooldowns), action: this.action };
  }

  restore(state?: PlayerCombatSaveState): void {
    this.reset();
    if (!state) return;
    for (const [id, cooldown] of Object.entries(state.cooldowns)) if (cooldown > 0) this.cooldowns.set(id, cooldown);
    this.activeAction = state.action ? { ...state.action } : null;
  }

  getCooldown(abilityId: string): number { return Math.max(0, this.cooldowns.get(abilityId) ?? 0); }

  start(player: PlayerCharacter, abilityId: string, chargeSeconds = 0): PlayerActionStart {
    if (this.activeAction) return { player, ability: null, error: 'Recovering from the current action.' };
    const ability = getAbility(abilityId);
    if (!ability) return { player, ability: null, error: 'That skill is not available.' };
    if (this.getCooldown(abilityId) > 0) return { player, ability: null, error: ability.name + ' is not ready.' };
    if (player.stats.mp < ability.manaCost) return { player, ability: null, error: 'Not enough mana.' };
    const chargeScale = ability.chargeMinSeconds
      ? 1 + Math.max(0, Math.min(0.65, (chargeSeconds - ability.chargeMinSeconds) * 0.45))
      : 1;
    this.cooldowns.set(abilityId, ability.cooldownSeconds);
    this.activeAction = { abilityId, phase: 'WINDUP', remainingSeconds: ability.windupSeconds, damageMultiplier: chargeScale };
    return { player: { ...player, stats: { ...player.stats, mp: player.stats.mp - ability.manaCost } }, ability };
  }

  update(deltaSeconds: number): { activeStarted: boolean; completed: boolean; action: ActivePlayerAction | null } {
    const dt = Math.max(0, Math.min(0.05, deltaSeconds));
    for (const [id, cooldown] of this.cooldowns) {
      const next = Math.max(0, cooldown - dt);
      if (next === 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, next);
    }
    if (!this.activeAction) return { activeStarted: false, completed: false, action: null };
    this.activeAction.remainingSeconds = Math.max(0, this.activeAction.remainingSeconds - dt);
    if (this.activeAction.remainingSeconds > 0) return { activeStarted: false, completed: false, action: this.action };
    if (this.activeAction.phase === 'WINDUP') {
      const ability = getAbility(this.activeAction.abilityId)!;
      this.activeAction.phase = 'ACTIVE';
      this.activeAction.remainingSeconds = ability.activeSeconds;
      return { activeStarted: true, completed: false, action: this.action };
    }
    if (this.activeAction.phase === 'ACTIVE') {
      const ability = getAbility(this.activeAction.abilityId)!;
      this.activeAction.phase = 'RECOVERY';
      this.activeAction.remainingSeconds = ability.recoverySeconds;
      return { activeStarted: false, completed: false, action: this.action };
    }
    this.activeAction = null;
    return { activeStarted: false, completed: true, action: null };
  }

  reset(): void {
    this.cooldowns.clear();
    this.activeAction = null;
  }
}

export const classAbilityIds = (player: PlayerCharacter) => CLASS_ABILITY_LOADOUT[player.classId];
