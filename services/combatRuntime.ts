import { characterInitiative, enemyInitiative, initiativeDuration, normalizePlayerInitiative } from './initiative';
import { transitionEvents } from './combatFeedback';
import type { Enemy, EnemyIntent, Player } from '../types';
import { COMBAT_TIMING } from '../data/combatTiming';
import { resolveStatusTurn } from './combat';
import { activateEnemyPhases, interruptEnemyIntent, planEnemyIntent, resolveEnemyIntent, settleDefeatedEnemyTheft } from './enemyAI';
import { resolvePlayerCombatAction, type CombatCommand, type CombatFeedback } from './combatActions';

export interface CombatClock { elapsedMs: number; timeScale: number; paused: boolean }
export interface CombatActorRuntime {
  actorId: string;
  initiative: number;
  side: 'player' | 'enemy';
  remainingMs: number;
  recoveryMs: number;
  ready: boolean;
  guardUntil: number;
  /** Future presentation bands only; never used for damage, movement or targeting. */
  rangeBand?: 'melee' | 'near' | 'far';
  queued?: CombatCommand;
  casting?: { intent: EnemyIntent; remainingMs: number; totalMs: number; interruptible: boolean };
}
export interface CombatSnapshot {
  clock: CombatClock;
  actors: Record<string, CombatActorRuntime>;
  outcome: 'victory' | 'defeat' | 'escaped' | null;
}
export interface CombatUpdate extends CombatFeedback {
  changed: boolean;
  player: Player;
  enemies: Enemy[];
  outcome: CombatSnapshot['outcome'];
}

/** One encounter owns one clock. Gameplay data stays outside the timer records. */
export class CombatRuntime {
  readonly clock: CombatClock = { elapsedMs: 0, timeScale: 1, paused: false };
  readonly actors: Record<string, CombatActorRuntime> = {};
  player: Player;
  enemies: Enemy[];
  outcome: CombatSnapshot['outcome'] = null;
  private feedback: CombatFeedback = { logs: [], vfx: [], events: [] };
  private changed = false;
  private control = { activeActorId: '', targetId: null as string | null, autoBasic: false };

  setControl(activeActorId: string, targetId: string | null, autoBasic: boolean): void { this.control = { activeActorId, targetId, autoBasic }; }
  cancelQueued(actorId?: string): void {
    for (const actor of Object.values(this.actors)) if (!actorId || actor.actorId === actorId) delete actor.queued;
  }
  /** Skills alone may occupy one explicit short buffer; no resource is consumed before READY. */
  queueSkill(command: CombatCommand): boolean {
    const actor = this.actors[command.actorId];
    const hero = this.player.party.find(c => c.id === command.actorId);
    const skill = command.type === 'skill' && hero?.skills.find(s => s.id === command.id);
    if (this.outcome || !hero || hero.stats.hp <= 0 || !actor || actor.side !== 'player' || actor.ready || actor.queued || actor.remainingMs > 250 || !skill || hero.statusEffects.some(e => e.type === 'STUN')) return false;
    if (skill.id === 'soul_pact' ? hero.stats.hp <= 20 : skill.id === 'sacrifice' ? hero.stats.hp <= 15 : hero.stats.mp < skill.cost) return false;
    if (skill.type !== 'HEAL' && skill.type !== 'BUFF' && skill.id !== 'soul_pact' && !this.enemies.some(e => e.id === command.targetId && e.hp > 0)) return false;
    actor.queued = { ...command }; return true;
  }

  constructor(player: Player, enemies: Enemy[], private readonly random: () => number = Math.random) {
    this.player = normalizePlayerInitiative({ ...player, party: player.party.map(c => ({ ...c, isDefending: false })) });
    this.enemies = enemies.map(enemy => enemy.intent ? enemy : planEnemyIntent(enemy, enemies, player.scrap, random));
    this.syncActors();
  }

  snapshot(): CombatSnapshot {
    return { clock: { ...this.clock }, outcome: this.outcome, actors: Object.fromEntries(Object.entries(this.actors).map(([id, actor]) => [id, { ...actor, queued: actor.queued ? { ...actor.queued } : undefined, casting: actor.casting ? { ...actor.casting, intent: { ...actor.casting.intent } } : undefined }])) };
  }

  isReady(id: string): boolean { return !this.outcome && Boolean(this.actors[id]?.side === 'player' && this.actors[id]?.ready); }
  setPaused(paused: boolean): void { this.clock.paused = paused; }
  setSlowdown(slow: boolean): void { this.clock.timeScale = slow ? COMBAT_TIMING.tacticalScale : 1; }

  private recover(actor: CombatActorRuntime, ms: number): void {
    actor.remainingMs = actor.recoveryMs = Math.max(1, Math.min(5000, Number.isFinite(ms) ? ms : COMBAT_TIMING.enemyRecoveryMs));
    actor.ready = false;
    delete actor.casting;
    delete actor.queued;
  }

  private syncActors(): void {
    const living = new Set([...this.player.party.filter(c => c.stats.hp > 0), ...this.enemies.filter(e => e.hp > 0)].map(a => a.id));
    for (const id of Object.keys(this.actors)) if (!living.has(id)) delete this.actors[id];
    this.player.party.forEach(character => {
      if (character.stats.hp <= 0 || this.actors[character.id]) return;
      const initiative = characterInitiative(character);
      const ms = initiativeDuration(COMBAT_TIMING.initialReadyMs, initiative);
      this.actors[character.id] = { actorId: character.id, initiative, side: 'player', remainingMs: ms, recoveryMs: ms, ready: false, guardUntil: 0 };
    });
    this.enemies = this.enemies.map(enemy => {
      if (enemy.hp <= 0 || this.actors[enemy.id]) return enemy;
      const initiative = enemyInitiative(enemy);
      const ms = initiativeDuration(COMBAT_TIMING.initialReadyMs, initiative);
      this.actors[enemy.id] = { actorId: enemy.id, initiative, side: 'enemy', remainingMs: ms, recoveryMs: ms, ready: false, guardUntil: 0 };
      return enemy.intent ? enemy : planEnemyIntent(enemy, this.enemies, this.player.scrap, this.random);
    });
  }

  private settle(): void {
    const before = this.enemies;
    const phased = activateEnemyPhases(this.enemies);
    this.enemies = phased.enemies;
    this.feedback.logs.push(...phased.logs);
    this.feedback.events!.push(...transitionEvents(this.player, before, this.player, phased.enemies));
    if (phased.logs.length) this.changed = true;
    if (phased.logs.length) this.feedback.vfx.push({ type: 'DARK', targetId: this.enemies.find(e => e.definitionId === 'the_necromancer')?.id });
    const theft = settleDefeatedEnemyTheft(this.enemies);
    this.enemies = theft.enemies;
    this.player = { ...this.player, scrap: this.player.scrap + theft.refundedScrap };
    this.feedback.logs.push(...theft.logs);
    if (theft.refundedScrap > 0) this.changed = true;
    this.syncActors();
    this.consumeReadyStuns();
    // Party defeat wins ties (e.g. status damage). Completion is latched once.
    if (!this.player.party.some(c => c.stats.hp > 0)) this.outcome = 'defeat';
    else if (!this.enemies.some(e => e.hp > 0)) this.outcome = 'victory';
    if (this.outcome) this.clearGuards();
  }

  private clearGuards(): void {
    this.player = { ...this.player, party: this.player.party.map(c => ({ ...c, isDefending: false })) };
    for (const actor of Object.values(this.actors)) { actor.guardUntil = 0; delete actor.queued; }
  }

  private consumeReadyStuns(): void {
    this.player.party.forEach(character => {
      const actor = this.actors[character.id];
      if (!actor?.ready || !character.statusEffects.some(e => e.type === 'STUN')) return;
      this.player = { ...this.player, party: this.player.party.map(c => c.id === character.id ? { ...c, statusEffects: c.statusEffects.flatMap(e => e.type !== 'STUN' ? [e] : e.duration > 1 ? [{ ...e, duration: e.duration - 1 }] : []) } : c) };
      this.recover(actor, initiativeDuration(COMBAT_TIMING.baseRecoveryMs, actor.initiative));
      this.feedback.logs.push(`${character.name} is stunned!`); this.changed = true;
    });
  }

  private interruptCasts(): void {
    for (const enemy of this.enemies) {
      const actor = this.actors[enemy.id];
      if (enemy.hp <= 0 || !actor?.casting?.interruptible || !enemy.statusEffects.some(effect => effect.type === 'STUN')) continue;
      const interrupted = interruptEnemyIntent(enemy);
      const label = actor.casting.intent.label;
      this.enemies = this.enemies.map(e => e.id === enemy.id ? interrupted : e);
      this.enemies = this.enemies.map(e => e.id === enemy.id ? planEnemyIntent(e, this.enemies, this.player.scrap, this.random) : e);
      this.recover(actor, initiativeDuration(COMBAT_TIMING.interruptRecoveryMs, actor.initiative));
      this.feedback.logs.push(`${enemy.name}'s ${label} is interrupted!`);
      this.feedback.events!.push({ kind: 'interrupt', targetId: enemy.id });
      this.feedback.vfx.push({ type: 'DEBUFF', targetId: enemy.id });
      this.changed = true;
    }
  }

  act(command: CombatCommand): CombatUpdate {
    if (this.outcome) return this.drain();
    this.consumeReadyStuns();
    if (!this.isReady(command.actorId)) { this.feedback.logs.push('Still recovering.'); return this.drain(); }
    this.applyCommand(command);
    return this.drain();
  }

  private applyCommand(command: CombatCommand): void {
    const result = resolvePlayerCombatAction(this.player, this.enemies, command, this.random);
    this.feedback.logs.push(...result.logs); this.feedback.vfx.push(...result.vfx); this.feedback.sound = result.sound;
    if (!result.accepted) return;
    this.feedback.events!.push(...(result.events ?? []), ...transitionEvents(this.player, this.enemies, result.player, result.enemies));
    this.player = result.player; this.enemies = result.enemies; this.changed = true;
    const actor = this.actors[command.actorId];
    this.recover(actor, result.recoveryMs);
    if (command.type === 'defend') actor.guardUntil = this.clock.elapsedMs + COMBAT_TIMING.guardMs;
    if (result.escaped) { this.outcome = 'escaped'; this.clearGuards(); }
    else { this.settle(); this.interruptCasts(); }
    return;
  }

  /** Pure simulated elapsed time; fixed substeps keep guard/cast ordering consistent. */
  advance(deltaMs: number): CombatUpdate {
    let remaining = Number.isFinite(deltaMs) ? Math.max(0, Math.min(10000, deltaMs)) * this.clock.timeScale : 0;
    if (this.clock.paused || this.outcome) return this.drain();
    while (remaining > 0 && !this.outcome) {
      const dt = Math.min(50, remaining); remaining -= dt; this.clock.elapsedMs += dt;
      this.interruptCasts();
      for (const actor of Object.values(this.actors)) {
        if (this.outcome) break;
        if (!this.actors[actor.actorId]) continue;
        if (actor.side === 'player' && actor.guardUntil > 0 && actor.guardUntil <= this.clock.elapsedMs) {
          actor.guardUntil = 0;
          this.player = { ...this.player, party: this.player.party.map(c => c.id === actor.actorId ? { ...c, isDefending: false } : c) };
          this.changed = true;
        }
        if (actor.ready) continue;
        const casting = actor.casting;
        if (casting) {
          const overflow = Math.max(0, dt - casting.remainingMs);
          casting.remainingMs = Math.max(0, casting.remainingMs - dt);
          if (casting.remainingMs === 0) { this.resolveEnemy(actor); actor.remainingMs = Math.max(0, actor.remainingMs - overflow); }
          continue;
        }
        const before = actor.remainingMs;
        actor.remainingMs = Math.max(0, before - dt);
        if (actor.remainingMs > 0) continue;
        if (actor.side === 'player') this.readyPlayer(actor);
        else {
          const enemy = this.enemies.find(e => e.id === actor.actorId && e.hp > 0);
          if (!enemy?.intent) continue;
          const authoredMs = enemy.intent.castTimeMs ?? 400;
          const castMs = Math.max(0, Math.min(5000, Number.isFinite(authoredMs) ? authoredMs : 400));
          const overflow = Math.max(0, dt - before);
          actor.casting = { intent: { ...enemy.intent }, remainingMs: Math.max(0, castMs - overflow), totalMs: castMs, interruptible: enemy.intent.interruptible === true || !enemy.isBoss && enemy.intent.interruptible !== false };
          if (actor.casting.remainingMs === 0) { this.resolveEnemy(actor); actor.remainingMs = Math.max(0, actor.remainingMs - Math.max(0, overflow - castMs)); }
        }
      }
      this.settle();
      this.runReadyCommands();
    }
    return this.drain();
  }


  private runReadyCommands(): void {
    if (this.outcome || this.clock.paused) return;
    for (const actor of Object.values(this.actors)) {
      if (this.outcome || actor.side !== 'player' || !actor.ready || !this.actors[actor.actorId]) continue;
      const queued = actor.queued;
      if (queued) {
        delete actor.queued;
        // A buffered offensive skill must keep its chosen living target; never redirect a paid skill.
        const hero = this.player.party.find(c => c.id === actor.actorId)!;
        const skill = queued.type === 'skill' ? hero.skills.find(s => s.id === queued.id) : undefined;
        if (skill && (skill.type === 'HEAL' || skill.type === 'BUFF' || skill.id === 'soul_pact' || this.enemies.some(e => e.id === queued.targetId && e.hp > 0))) this.applyCommand(queued);
        else this.feedback.logs.push('Buffered skill cancelled: target unavailable.');
        continue;
      }
      if (this.control.autoBasic && actor.actorId !== this.control.activeActorId && this.enemies.some(e => e.id === this.control.targetId && e.hp > 0)) {
        this.applyCommand({ type: 'attack', actorId: actor.actorId, targetId: this.control.targetId });
      }
    }
  }

  private readyPlayer(actor: CombatActorRuntime): void {
    const character = this.player.party.find(c => c.id === actor.actorId)!;
    const stunned = character.statusEffects.some(e => e.type === 'STUN');
    const status = resolveStatusTurn(character.stats.hp, character.stats.maxHp, character.statusEffects);
    this.player = { ...this.player, party: this.player.party.map(c => c.id === actor.actorId ? { ...c, stats: { ...c.stats, hp: status.hp }, statusEffects: status.statusEffects } : c) };
    status.ticks.forEach(tick => { this.feedback.events!.push({ kind: tick.type === 'REGEN' ? 'heal' : tick.type === 'POISON' ? 'poison' : 'burn', targetId: character.id, amount: tick.value }); this.feedback.logs.push(`${character.name}: ${tick.type} ${tick.value}.`); this.feedback.vfx.push({ type: tick.type === 'POISON' ? 'POISON' : tick.type === 'BURN' ? 'FIREBALL' : 'HEAL', targetId: character.id }); });
    this.changed = true;
    if (status.defeated) { this.feedback.logs.push(`${character.name} collapsed!`); delete this.actors[character.id]; }
    else if (stunned) { this.feedback.logs.push(`${character.name} is stunned!`); this.recover(actor, initiativeDuration(COMBAT_TIMING.baseRecoveryMs, actor.initiative)); }
    else actor.ready = true;
  }

  private resolveEnemy(actor: CombatActorRuntime): void {
    const cast = actor.casting;
    if (!cast) return;
    // Restore the exact announced intent even when a boss phase changed while casting.
    this.enemies = this.enemies.map(e => e.id === actor.actorId ? { ...e, intent: cast.intent } : e);
    const result = resolveEnemyIntent(actor.actorId, this.enemies, this.player.party, this.player.scrap, this.random);
    this.feedback.events!.push(...result.events, ...transitionEvents(this.player, this.enemies, { ...this.player, party: result.party }, result.enemies));
    this.enemies = result.enemies;
    this.player = { ...this.player, party: result.party, scrap: result.scrap };
    this.feedback.logs.push(...result.logs); this.feedback.vfx.push(...result.vfx);
    if (result.acted && result.vfx.some(v => v.type === 'DAMAGE')) this.feedback.sound = 'attack';
    this.changed = true;
    this.recover(actor, initiativeDuration(result.stunned ? COMBAT_TIMING.interruptRecoveryMs : cast.intent.recoveryMs ?? COMBAT_TIMING.enemyRecoveryMs, actor.initiative));
    this.settle();
    this.enemies = this.enemies.map(e => e.id === actor.actorId && e.hp > 0 ? planEnemyIntent(e, this.enemies, this.player.scrap, this.random) : e);
  }

  private drain(): CombatUpdate {
    const update = { ...this.feedback, changed: this.changed, player: this.player, enemies: this.enemies, outcome: this.outcome };
    this.feedback = { logs: [], vfx: [], events: [] }; this.changed = false;
    return update;
  }
}
