import { characterInitiative, enemyInitiative, normalizePlayerInitiative } from './initiative';
import { transitionEvents } from './combatFeedback';
import type { Enemy, Player } from '../types';
import { resolveStatusTurn } from './combat';
import { activateEnemyPhases, planEnemyIntent, resolveEnemyIntent, settleDefeatedEnemyTheft } from './enemyAI';
import { resolvePlayerCombatAction, type CombatCommand, type CombatFeedback } from './combatActions';

export interface CombatActorRuntime {
  actorId: string;
  initiative: number;
  side: 'player' | 'enemy';
  ready: boolean;
  eligibleRound: number;
  actedRound: number;
}
export interface CombatSnapshot {
  round: number;
  turnId: string | null;
  order: string[];
  actors: Record<string, CombatActorRuntime>;
  outcome: 'victory' | 'defeat' | 'escaped' | null;
}
export interface CombatUpdate extends CombatFeedback {
  changed: boolean;
  player: Player;
  enemies: Enemy[];
  outcome: CombatSnapshot['outcome'];
}

/** One action per actor per round. Only explicit commands/steps can change gameplay. */
export class CombatRuntime {
  readonly actors: Record<string, CombatActorRuntime> = {};
  player: Player;
  enemies: Enemy[];
  round = 0;
  turnId: string | null = null;
  order: string[] = [];
  outcome: CombatSnapshot['outcome'] = null;
  private feedback: CombatFeedback = { logs: [], vfx: [], events: [] };
  private changed = false;

  constructor(player: Player, enemies: Enemy[], private readonly random: () => number = Math.random) {
    this.player = normalizePlayerInitiative({ ...player, party: player.party.map(c => ({ ...c, isDefending: false })) });
    this.enemies = enemies.map(enemy => enemy.intent ? enemy : planEnemyIntent(enemy, enemies, player.scrap, random));
    this.settle();
    this.openNextTurn();
  }

  snapshot(): CombatSnapshot {
    return { round: this.round, turnId: this.turnId, order: [...this.order], outcome: this.outcome,
      actors: Object.fromEntries(Object.entries(this.actors).map(([id, actor]) => [id, { ...actor }])) };
  }
  isReady(id: string): boolean { return !this.outcome && this.turnId === id && this.actors[id]?.side === 'player' && this.actors[id].ready; }

  private syncActors(): void {
    const living = new Set([...this.player.party.filter(c => c.stats.hp > 0), ...this.enemies.filter(e => e.hp > 0)].map(a => a.id));
    for (const id of Object.keys(this.actors)) if (!living.has(id)) delete this.actors[id];
    this.order = this.order.filter(id => living.has(id));
    const add = (actorId: string, initiative: number, side: CombatActorRuntime['side']) => {
      if (this.actors[actorId]) return;
      // Revivals/summons join the following round, never inside their creator's action.
      this.actors[actorId] = { actorId, initiative, side, ready: false, eligibleRound: this.round + 1, actedRound: 0 };
    };
    this.player.party.filter(c => c.stats.hp > 0).forEach(c => add(c.id, characterInitiative(c), 'player'));
    this.enemies.filter(e => e.hp > 0).forEach(e => add(e.id, enemyInitiative(e), 'enemy'));
  }

  private settle(): void {
    const before = this.enemies;
    const phased = activateEnemyPhases(before);
    this.enemies = phased.enemies;
    this.feedback.logs.push(...phased.logs);
    this.feedback.events!.push(...transitionEvents(this.player, before, this.player, phased.enemies));
    if (phased.logs.length) { this.changed = true; this.feedback.vfx.push({ type: 'DARK', targetId: this.enemies.find(e => e.definitionId === 'the_necromancer')?.id }); }
    const theft = settleDefeatedEnemyTheft(this.enemies);
    this.enemies = theft.enemies;
    if (theft.refundedScrap) { this.player = { ...this.player, scrap: this.player.scrap + theft.refundedScrap }; this.changed = true; }
    this.feedback.logs.push(...theft.logs);
    this.syncActors();
    if (!this.player.party.some(c => c.stats.hp > 0)) this.outcome = 'defeat';
    else if (!this.enemies.some(e => e.hp > 0)) this.outcome = 'victory';
    if (this.outcome) this.finish();
  }

  private finish(): void {
    this.turnId = null; this.order = [];
    this.player = { ...this.player, party: this.player.party.map(c => ({ ...c, isDefending: false })) };
    for (const actor of Object.values(this.actors)) actor.ready = false;
  }

  private openNextTurn(): void {
    while (!this.outcome) {
      if (!this.order.length) {
        this.round++;
        this.order = Object.values(this.actors).filter(a => a.eligibleRound <= this.round)
          .sort((a, b) => b.initiative - a.initiative || (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0)).map(a => a.actorId);
      }
      const id = this.order[0];
      const actor = this.actors[id];
      if (!actor) { this.order.shift(); continue; }
      this.turnId = id;
      this.changed = true;
      if (actor.side === 'enemy') return;
      const hero = this.player.party.find(c => c.id === id)!;
      const stunned = hero.statusEffects.some(e => e.type === 'STUN');
      const status = resolveStatusTurn(hero.stats.hp, hero.stats.maxHp, hero.statusEffects);
      this.player = { ...this.player, party: this.player.party.map(c => c.id === id ? { ...c, isDefending: false, stats: { ...c.stats, hp: status.hp }, statusEffects: status.statusEffects } : c) };
      for (const tick of status.ticks) {
        this.feedback.events!.push({ kind: tick.type === 'REGEN' ? 'heal' : tick.type === 'POISON' ? 'poison' : 'burn', targetId: id, amount: tick.value });
        this.feedback.logs.push(`${hero.name}: ${tick.type} ${tick.value}.`);
        this.feedback.vfx.push({ type: tick.type === 'POISON' ? 'POISON' : tick.type === 'BURN' ? 'FIREBALL' : 'HEAL', targetId: id });
      }
      if (status.defeated || stunned) {
        this.feedback.logs.push(status.defeated ? `${hero.name} collapsed!` : `${hero.name} is stunned and loses this turn!`);
        actor.actedRound = this.round; this.order.shift(); this.turnId = null;
        this.settle(); continue;
      }
      actor.ready = true;
      return;
    }
  }

  /** No elapsed-time simulation: used to collect initial/status feedback only. */
  flush(): CombatUpdate { return this.drain(); }

  act(command: CombatCommand): CombatUpdate {
    if (this.outcome) return this.drain();
    if (!this.isReady(command.actorId)) { this.feedback.logs.push('It is not that hero’s turn.'); return this.drain(); }
    const result = resolvePlayerCombatAction(this.player, this.enemies, command, this.random);
    this.feedback.logs.push(...result.logs); this.feedback.vfx.push(...result.vfx); this.feedback.sound = result.sound;
    if (!result.accepted) return this.drain();
    this.feedback.events!.push(...(result.events ?? []), ...transitionEvents(this.player, this.enemies, result.player, result.enemies));
    this.player = result.player; this.enemies = result.enemies; this.changed = true;
    this.completeTurn();
    if (result.escaped) { this.outcome = 'escaped'; this.finish(); }
    else { this.settle(); this.openNextTurn(); }
    return this.drain();
  }

  /** Resolve exactly one enemy turn; the UI owns only its presentation delay. */
  stepEnemy(expectedTurnId: string, expectedRound: number): CombatUpdate {
    if (this.outcome || this.round !== expectedRound || this.turnId !== expectedTurnId || this.actors[expectedTurnId]?.side !== 'enemy') return this.drain();
    const result = resolveEnemyIntent(expectedTurnId, this.enemies, this.player.party, this.player.scrap, this.random);
    this.feedback.events!.push(...result.events, ...transitionEvents(this.player, this.enemies, { ...this.player, party: result.party }, result.enemies));
    if (result.stunned) this.feedback.events!.push({ kind: 'interrupt', targetId: expectedTurnId });
    this.enemies = result.enemies; this.player = { ...this.player, party: result.party, scrap: result.scrap };
    this.feedback.logs.push(...result.logs); this.feedback.vfx.push(...result.vfx);
    if (result.acted && result.vfx.some(v => v.type === 'DAMAGE')) this.feedback.sound = 'attack';
    this.changed = true; this.completeTurn(); this.settle();
    this.enemies = this.enemies.map(e => e.id === expectedTurnId && e.hp > 0 ? planEnemyIntent(e, this.enemies, this.player.scrap, this.random) : e);
    this.openNextTurn();
    return this.drain();
  }

  private completeTurn(): void {
    const actor = this.turnId ? this.actors[this.turnId] : undefined;
    if (actor) { actor.ready = false; actor.actedRound = this.round; }
    this.order.shift(); this.turnId = null;
  }
  private drain(): CombatUpdate {
    const update = { ...this.feedback, changed: this.changed, player: this.player, enemies: this.enemies, outcome: this.outcome };
    this.feedback = { logs: [], vfx: [], events: [] }; this.changed = false;
    return update;
  }
}
