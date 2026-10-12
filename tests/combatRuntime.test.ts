import { describe, expect, it } from 'vitest';
import type { Character, Enemy, Player, Skill } from '../types';
import { CombatRuntime } from '../services/combatRuntime';
import { COMBAT_TIMING } from '../data/combatTiming';
import { createEnemyById } from '../services/gameLogic';
import { createStatusEffect } from '../services/combat';

const stun: Skill = { id: 'stun', name: 'Interrupt', type: 'DAMAGE', targetType: 'SINGLE', cost: 2, basePower: 0, scaling: 0, scalingStat: 'INT', description: '', level: 1, maxLevel: 1, vfxType: 'DEBUFF', effect: { type: 'STUN', duration: 1, chance: 1, val: 0 } };
const hero = (id = 'hero', classType: Character['classType'] = 'PALADIN'): Character => ({
  id, name: id, classType, stats: { hp: 10000, maxHp: 10000, mp: 100, maxMp: 100, str: 10, dex: 0, int: 8, xp: 0, level: 1 },
  equipment: { weapon: null, armor: null, offhand: null, accessory: null }, skills: [stun], statusEffects: [], isDefending: false,
});
const party = (characters = [hero()]): Player => ({ pos: { x: 1, y: 1 }, dir: 'E', party: characters, inventory: [], scrap: 10 });
const rat = (): Enemy => ({ ...createEnemyById('giant_rat'), hp: 10000, maxHp: 10000 });
const heavy = (interruptible = true): Enemy => ({ ...createEnemyById('orc_brute'), hp: 10000, maxHp: 10000, combatFlags: ['orc_wind_up'], intent: { type: 'HEAVY_ATTACK', label: 'Crushing Blow', shortLabel: 'Crush', icon: '💥', abilityId: 'orc_crushing_blow', castTimeMs: 2000, recoveryMs: 2200, interruptible } });

describe('Combat 2.5A actor timeline', () => {
  it('loads party and enemy timers independently and never auto-attacks for READY players', () => {
    const enemy = rat(); const runtime = new CombatRuntime(party([hero(), hero('rogue', 'ROGUE')]), [enemy], () => 0.5);
    runtime.advance(450);
    expect(runtime.isReady('hero')).toBe(true); expect(runtime.isReady('rogue')).toBe(false);
    expect(runtime.actors[enemy.id].remainingMs).toBe(950);
    runtime.advance(200);
    expect(runtime.isReady('rogue')).toBe(true); expect(runtime.enemies[0].hp).toBe(10000);
  });

  it('consumes an action atomically and blocks double-clicks until its own recovery ends', () => {
    const enemy = rat(); const runtime = new CombatRuntime(party([hero(), hero('rogue', 'ROGUE')]), [enemy], () => 0.5);
    runtime.advance(650);
    runtime.act({ type: 'attack', actorId: 'hero', targetId: enemy.id });
    expect(runtime.enemies[0].hp).toBe(9990); expect(runtime.isReady('hero')).toBe(false);
    runtime.act({ type: 'attack', actorId: 'hero', targetId: enemy.id });
    expect(runtime.enemies[0].hp).toBe(9990);
    runtime.act({ type: 'attack', actorId: 'rogue', targetId: enemy.id });
    expect(runtime.actors.rogue.recoveryMs).toBe(720);
    runtime.advance(720); expect(runtime.isReady('rogue')).toBe(true); expect(runtime.isReady('hero')).toBe(false);
    runtime.advance(180); expect(runtime.isReady('hero')).toBe(true);
  });

  it('freezes recovery, casts and guard clocks during pause while allowing menu commands', () => {
    const enemy = heavy(); const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(1500); runtime.setPaused(true);
    runtime.act({ type: 'defend', actorId: 'hero' });
    const snapshot = runtime.snapshot(); runtime.advance(5000);
    expect(runtime.snapshot()).toEqual(snapshot);
    runtime.setPaused(false); runtime.advance(100); expect(runtime.clock.elapsedMs).toBe(1600);
  });

  it('scales the same timers to 20% without affecting readiness rules', () => {
    const runtime = new CombatRuntime(party(), [rat()], () => 0.5);
    runtime.setSlowdown(true); runtime.advance(1000);
    expect(runtime.clock.elapsedMs).toBe(200); expect(runtime.actors.hero.remainingMs).toBe(250);
    runtime.setSlowdown(false); runtime.advance(250); expect(runtime.isReady('hero')).toBe(true);
  });

  it('holds the advertised intent through the complete cast, then resolves exactly once', () => {
    const enemy = heavy(); const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(1400); expect(runtime.actors[enemy.id].casting?.remainingMs).toBe(2000);
    runtime.advance(1900); expect(runtime.player.party[0].stats.hp).toBe(10000);
    expect(runtime.enemies[0].intent?.abilityId).toBe('orc_crushing_blow');
    const hit = runtime.advance(100); expect(hit.logs.filter(line => line.includes('uses Crushing Blow'))).toHaveLength(1);
    expect(runtime.player.party[0].stats.hp).toBe(9972);
    expect(runtime.advance(0).logs).toHaveLength(0);
    expect(runtime.actors[enemy.id].casting).toBeUndefined();
  });

  it('interrupts a live cast with STUN, consumes it once, and avoids immediate heavy repetition', () => {
    const enemy = heavy(); const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(1800);
    const action = runtime.act({ type: 'skill', id: 'stun', actorId: 'hero', targetId: enemy.id });
    expect(action.logs.join(' ')).toContain('interrupted');
    expect(runtime.actors[enemy.id].casting).toBeUndefined();
    expect(runtime.actors[enemy.id].remainingMs).toBe(COMBAT_TIMING.interruptRecoveryMs);
    expect(runtime.enemies[0].intent?.abilityId).not.toBe('orc_crushing_blow');
    expect(runtime.enemies[0].statusEffects.some(e => e.type === 'STUN')).toBe(false);
    expect(runtime.player.party[0].stats.hp).toBe(10000);
  });

  it('lets an explicitly uninterruptible cast finish even with STUN applied', () => {
    const enemy = heavy(false); const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(1800); runtime.act({ type: 'skill', id: 'stun', actorId: 'hero', targetId: enemy.id });
    expect(runtime.actors[enemy.id].casting?.remainingMs).toBe(1600);
    runtime.advance(1600); expect(runtime.player.party[0].stats.hp).toBe(9972);
  });

  it('supports per-ability boss resistance instead of making every boss immune', () => {
    const boss = { ...createEnemyById('the_necromancer'), intent: { type: 'ATTACK' as const, label: 'Soul Bolt', shortLabel: 'Bolt', icon: '', abilityId: 'necromancer_soul_bolt', castTimeMs: 900, interruptible: true } };
    const resisted = new CombatRuntime(party(), [boss], () => 0); resisted.advance(1500);
    expect(resisted.act({ type: 'skill', id: 'stun', actorId: 'hero' }).logs.join(' ')).toContain('resists');
    expect(resisted.actors[boss.id].casting).toBeDefined();
    const interrupted = new CombatRuntime(party(), [boss], () => 0.99); interrupted.advance(1500);
    expect(interrupted.act({ type: 'skill', id: 'stun', actorId: 'hero' }).logs.join(' ')).toContain('interrupted');
  });

  it('keeps Defend active across recovery and reduces a telegraphed hit, then expires', () => {
    const enemy = heavy(); const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(1800); runtime.act({ type: 'defend', actorId: 'hero' });
    runtime.advance(1600); expect(runtime.player.party[0].stats.hp).toBe(9986);
    expect(runtime.player.party[0].isDefending).toBe(true);
    runtime.advance(1200); expect(runtime.player.party[0].isDefending).toBe(false);
  });

  it('removes defeated actors immediately, latches victory, and does not grant repeated actions', () => {
    const enemy = { ...rat(), hp: 1 }; const runtime = new CombatRuntime(party(), [enemy], () => 0.5);
    runtime.advance(450); const victory = runtime.act({ type: 'attack', actorId: 'hero' });
    expect(victory.outcome).toBe('victory'); expect(runtime.actors[enemy.id]).toBeUndefined();
    expect(runtime.advance(10000).logs).toHaveLength(0);
    const poisoned = hero(); poisoned.stats.hp = 1; poisoned.statusEffects = [createStatusEffect('POISON', 1, 5)];
    const defeat = new CombatRuntime(party([poisoned]), [rat()]);
    expect(defeat.advance(450).outcome).toBe('defeat'); expect(defeat.actors.hero).toBeUndefined();
  });

  it('initializes summoned actors with their own delayed recovery and preserves the enemy cap', () => {
    const boss = { ...createEnemyById('the_necromancer'), phase: 2, combatFlags: ['necromancer_mass_ready'], intent: { type: 'SUMMON' as const, label: 'Mass Raise', shortLabel: 'Raise', icon: '', abilityId: 'necromancer_mass_raise', castTimeMs: 2500, interruptible: true } };
    const runtime = new CombatRuntime(party(), [boss], () => 0.5); const result = runtime.advance(3900);
    expect(result.enemies).toHaveLength(3);
    const summons = runtime.enemies.filter(e => e.isSummoned);
    expect(summons).toHaveLength(2);
    summons.forEach(e => { expect(runtime.actors[e.id].remainingMs).toBe(1400); expect(e.intent).toBeDefined(); expect(e.xpReward).toBe(0); });
    expect(runtime.advance(0).logs).toHaveLength(0);
  });

  it('lets boss phase changes preserve the current cast and choose the phase intent afterward', () => {
    const boss = { ...createEnemyById('the_necromancer'), intent: { type: 'ATTACK' as const, label: 'Soul Bolt', shortLabel: 'Bolt', icon: '', abilityId: 'necromancer_soul_bolt', castTimeMs: 900, interruptible: true } };
    const strong = hero(); strong.stats.str = 170;
    const runtime = new CombatRuntime(party([strong]), [boss], () => 0.5); runtime.advance(1500);
    runtime.act({ type: 'attack', actorId: 'hero' });
    expect(runtime.enemies[0].phase).toBe(2); expect(runtime.actors[boss.id].casting?.intent.abilityId).toBe('necromancer_soul_bolt');
    runtime.advance(800); expect(runtime.enemies[0].intent?.abilityId).toBe('necromancer_mass_raise_prepare');
  });

  it('never spends resources or recovery on invalid actions and supports potions', () => {
    const p = party(); p.party[0].stats.mp = 0;
    p.inventory = [{ id: 'potion_hp', name: 'Health', description: '', type: 'POTION', value: 30, quantity: 1 }];
    p.party[0].stats.hp = 9900;
    const runtime = new CombatRuntime(p, [rat()], () => 0.5); runtime.advance(450);
    runtime.act({ type: 'skill', id: 'stun', actorId: 'hero' }); expect(runtime.isReady('hero')).toBe(true);
    runtime.act({ type: 'item', id: 'missing', actorId: 'hero' }); expect(runtime.isReady('hero')).toBe(true);
    runtime.act({ type: 'item', id: 'potion_hp', actorId: 'hero' }); expect(runtime.player.party[0].stats.hp).toBe(9930);
    expect(runtime.player.inventory).toHaveLength(0); expect(runtime.isReady('hero')).toBe(false);
  });

  it('blocks a READY hero newly stunned by an enemy without double-ticking other statuses', () => {
    const runtime = new CombatRuntime(party(), [rat()], () => 0.5); runtime.advance(450);
    runtime.player.party[0].statusEffects = [createStatusEffect('STUN', 1, 0), createStatusEffect('POISON', 2, 3)];
    runtime.act({ type: 'attack', actorId: 'hero' });
    expect(runtime.isReady('hero')).toBe(false); expect(runtime.enemies[0].hp).toBe(10000);
    expect(runtime.player.party[0].stats.hp).toBe(10000);
  });

  it('preserves ally healing and initializes a revived party member with a fresh gauge', () => {
    const healer = hero(); healer.skills = [{ ...stun, id: 'heal', name: 'Heal', type: 'HEAL', targetType: 'ALLY', basePower: 30, effect: undefined }];
    const fallen = hero('fallen'); fallen.stats.hp = 0;
    const runtime = new CombatRuntime(party([healer, fallen]), [rat()], () => 0.5); runtime.advance(450);
    runtime.act({ type: 'skill', id: 'heal', actorId: 'hero' });
    expect(runtime.player.party[1].stats.hp).toBe(30);
    expect(runtime.actors.fallen.ready).toBe(false); expect(runtime.actors.fallen.remainingMs).toBe(570);
  });

  it('retains HP-for-MP skill costs and prevents invalid health sacrifices', () => {
    const caster = hero(); caster.skills = [{ ...stun, id: 'soul_pact', name: 'Soul Pact', type: 'BUFF', targetType: 'SELF', cost: 0, effect: undefined }]; caster.stats.mp = 0;
    const runtime = new CombatRuntime(party([caster]), [rat()], () => 0.5); runtime.advance(450);
    runtime.act({ type: 'skill', id: 'soul_pact', actorId: 'hero' });
    expect(runtime.player.party[0].stats.hp).toBe(9980); expect(runtime.player.party[0].stats.mp).toBe(40);
    const low = { ...caster, stats: { ...caster.stats, hp: 20 } }; const blocked = new CombatRuntime(party([low]), [rat()]); blocked.advance(450);
    blocked.act({ type: 'skill', id: 'soul_pact', actorId: 'hero' }); expect(blocked.player.party[0].stats.hp).toBe(20); expect(blocked.isReady('hero')).toBe(true);
  });

  it('cancels a forced ritual preparation without immediately scheduling that same ritual again', () => {
    const boss = { ...createEnemyById('the_necromancer'), phase: 2, combatFlags: ['necromancer_mass_due'], intent: { type: 'PREPARE' as const, label: 'Mass Raise', shortLabel: 'Mass Raise', icon: '', abilityId: 'necromancer_mass_raise_prepare', castTimeMs: 1500, interruptible: true } };
    const runtime = new CombatRuntime(party(), [boss], () => 0.99); runtime.advance(1500);
    runtime.act({ type: 'skill', id: 'stun', actorId: 'hero' });
    expect(runtime.enemies[0].combatFlags).not.toContain('necromancer_mass_due');
    expect(runtime.enemies[0].intent?.abilityId).not.toBe('necromancer_mass_raise_prepare');
    expect(runtime.actors[boss.id].casting).toBeUndefined();
  });

  it('uses elapsed time consistently across frame sizes and bounds invalid cast data', () => {
    const enemy = rat(); const a = new CombatRuntime(party(), [enemy], () => 0.5); const b = new CombatRuntime(party(), [enemy], () => 0.5);
    a.advance(10000); for (let i = 0; i < 100; i++) b.advance(100);
    expect(a.snapshot()).toEqual(b.snapshot()); expect(a.player.party[0].stats.hp).toBe(b.player.party[0].stats.hp);
    const invalid = heavy(); invalid.intent!.castTimeMs = NaN;
    const bounded = new CombatRuntime(party(), [invalid], () => 0.5); bounded.advance(2000);
    expect(bounded.actors[invalid.id].casting).toBeUndefined();
  });
});
