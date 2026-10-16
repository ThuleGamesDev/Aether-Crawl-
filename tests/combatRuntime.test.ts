import { describe, expect, it } from 'vitest';
import { CombatRuntime } from '../services/combatRuntime';
import { createEnemyById } from '../services/gameLogic';
import { createStatusEffect } from '../services/combat';
import type { Character, Enemy, Player, Skill } from '../types';
const stun: Skill = { id: 'stun', name: 'Stun', type: 'DAMAGE', targetType: 'SINGLE', cost: 5, basePower: 1, scaling: 0, scalingStat: 'INT', description: '', level: 1, maxLevel: 1, vfxType: 'ATTACK', effect: { type: 'STUN', duration: 1, val: 0, chance: 1 } };
const hero = (id = 'hero', initiative = 15): Character => ({ id, name: id, classType: 'PALADIN', stats: { initiative, hp: 10000, maxHp: 10000, mp: 100, maxMp: 100, str: 10, dex: 0, int: 8, xp: 0, level: 1 }, equipment: { weapon: null, armor: null, offhand: null, accessory: null }, skills: [stun], statusEffects: [], isDefending: false });
const party = (heroes = [hero()]): Player => ({ pos: { x: 1, y: 1 }, dir: 'E', party: heroes, inventory: [], scrap: 10 });
const rat = (): Enemy => ({ ...createEnemyById('giant_rat'), initiative: 10, hp: 10000, maxHp: 10000 });
const heavy = (interruptible = true): Enemy => ({ ...createEnemyById('orc_brute'), initiative: 10, hp: 10000, maxHp: 10000, combatFlags: ['orc_wind_up'], intent: { type: 'HEAVY_ATTACK', label: 'Crushing Blow', shortLabel: 'Crush', icon: '!', abilityId: 'orc_crushing_blow', interruptible } });
const step = (r: CombatRuntime) => r.stepEnemy(r.turnId!, r.round);

describe('initiative rounds', () => {
  it('interleaves both sides by descending initiative with exactly one owner', () => {
    const fast = { ...rat(), initiative: 20 }, slow = rat();
    const rt = new CombatRuntime(party([hero('a', 18), hero('b', 8)]), [slow, fast]);
    expect(rt.order).toEqual([fast.id, 'a', slow.id, 'b']); expect(rt.isReady('a')).toBe(false);
    step(rt); expect(rt.turnId).toBe('a'); expect(rt.isReady('a')).toBe(true);
  });
  it('never progresses during a player decision or from an enemy step submitted on a hero turn', () => {
    const rt = new CombatRuntime(party(), [rat()]); rt.flush(); const before = rt.snapshot(), hp = rt.player.party[0].stats.hp;
    for (let i = 0; i < 100; i++) rt.stepEnemy(rt.turnId!, rt.round);
    expect(rt.snapshot()).toEqual(before); expect(rt.player.party[0].stats.hp).toBe(hp);
  });
  it('blocks out-of-turn commands and double attacks without spending resources', () => {
    const rt = new CombatRuntime(party([hero(), hero('slow', 5)]), [rat()], () => 0.5); rt.flush();
    rt.act({ type: 'skill', actorId: 'slow', id: 'stun' }); expect(rt.player.party[1].stats.mp).toBe(100);
    rt.act({ type: 'attack', actorId: 'hero' }); const hp = rt.enemies[0].hp;
    rt.act({ type: 'attack', actorId: 'hero' }); expect(rt.enemies[0].hp).toBe(hp); expect(rt.turnId).toBe(rt.enemies[0].id);
  });
  it('rebuilds rounds in initiative order without granting extra fast-actor turns', () => {
    const rt = new CombatRuntime(party([hero('fast', 30), hero('slow', 1)]), [rat()]);
    rt.act({ type: 'defend', actorId: 'fast' }); step(rt); expect(rt.turnId).toBe('slow'); expect(rt.round).toBe(1);
    rt.act({ type: 'defend', actorId: 'slow' }); expect(rt.round).toBe(2); expect(rt.turnId).toBe('fast');
    expect(rt.actors.fast.actedRound).toBe(1);
  });
  it('uses stable actor IDs to break ties independently of array order', () => {
    const p = party([hero('b', 10), hero('a', 10)]), e = rat();
    const a = new CombatRuntime(p, [e]), b = new CombatRuntime({ ...p, party: [...p.party].reverse() }, [e]);
    expect(a.order).toEqual(b.order); expect(a.order.slice(0, 2)).toEqual(['a', 'b']);
  });
  it('rejects stale enemy callbacks, including an ID repeated in the next round', () => {
    const e = { ...rat(), initiative: 20 }, rt = new CombatRuntime(party(), [e]); const round = rt.round;
    step(rt); rt.act({ type: 'defend', actorId: 'hero' }); expect(rt.turnId).toBe(e.id);
    const hp = rt.player.party[0].stats.hp; rt.stepEnemy(e.id, round); expect(rt.player.party[0].stats.hp).toBe(hp); expect(rt.round).toBe(2);
  });
  it('keeps guard through enemy actions and expires it at the next own turn', () => {
    const rt = new CombatRuntime(party([hero(), hero('slow', 5)]), [heavy()], () => 0);
    rt.act({ type: 'defend', actorId: 'hero' }); const hit = step(rt);
    expect(hit.player.party[0].stats.hp).toBe(9986); expect(rt.player.party[0].isDefending).toBe(true);
    rt.act({ type: 'defend', actorId: 'slow' }); expect(rt.player.party[0].isDefending).toBe(false);
  });
  it('consumes accepted stun once at the enemy turn and cancels the advertised heavy intent', () => {
    const e = heavy(), rt = new CombatRuntime(party(), [e], () => 0.5);
    rt.act({ type: 'skill', actorId: 'hero', id: 'stun', targetId: e.id }); const update = step(rt);
    expect(update.logs.join(' ')).toContain('loses Crushing Blow'); expect(update.events?.filter(e => e.kind === 'interrupt')).toHaveLength(1);
    expect(rt.player.party[0].stats.hp).toBe(10000); expect(rt.enemies[0].statusEffects).toHaveLength(0);
    expect(rt.enemies[0].intent?.abilityId).not.toBe('orc_crushing_blow');
  });
  it('retains uninterruptible intents and boss stun resistance', () => {
    const rt = new CombatRuntime(party(), [heavy(false)], () => 0.5);
    rt.act({ type: 'skill', actorId: 'hero', id: 'stun' }); step(rt); expect(rt.player.party[0].stats.hp).toBe(9972);
    const boss = { ...createEnemyById('the_necromancer'), initiative: 10, intent: { type: 'ATTACK' as const, abilityId: 'necromancer_soul_bolt', label: 'Bolt', shortLabel: 'Bolt', icon: '', interruptible: true } };
    const resisted = new CombatRuntime(party(), [boss], () => 0);
    expect(resisted.act({ type: 'skill', actorId: 'hero', id: 'stun' }).logs.join(' ')).toContain('resists');
    expect(step(resisted).logs.join(' ')).toContain('uses Soul Bolt');
  });
  it('ticks poison once per own turn, including a skipped stunned turn', () => {
    const h = hero(); h.statusEffects = [createStatusEffect('STUN', 1, 0), createStatusEffect('POISON', 2, 3)];
    const e = rat(); e.statusEffects = [createStatusEffect('STUN', 1, 0)];
    const rt = new CombatRuntime(party([h]), [e]); expect(rt.turnId).toBe(rt.enemies[0].id); expect(rt.player.party[0].stats.hp).toBe(9997);
    rt.flush(); step(rt); expect(rt.player.party[0].stats.hp).toBe(9994); expect(rt.isReady('hero')).toBe(true);
    rt.stepEnemy(rt.turnId!, rt.round); expect(rt.player.party[0].stats.hp).toBe(9994);
  });
  it('removes actors defeated by status and latches terminal outcomes once', () => {
    const h = hero(); h.stats.hp = 1; h.statusEffects = [createStatusEffect('POISON', 1, 5)];
    const defeat = new CombatRuntime(party([h]), [rat()]); expect(defeat.flush().outcome).toBe('defeat'); expect(defeat.turnId).toBeNull();
    const rt = new CombatRuntime(party(), [{ ...rat(), hp: 1 }]);
    expect(rt.act({ type: 'attack', actorId: 'hero' }).outcome).toBe('victory');
    expect(rt.act({ type: 'attack', actorId: 'hero' }).logs).toHaveLength(0); expect(rt.order).toEqual([]);
  });
  it('preserves invalid actions, potion consumption and unsuccessful flee as a full action', () => {
    const p = party(); p.party[0].stats.mp = 0; p.party[0].stats.hp = 9000;
    p.inventory = [{ id: 'potion_hp', name: 'HP', description: '', type: 'POTION', value: 30, quantity: 1 }];
    const rt = new CombatRuntime(p, [rat()], () => 0);
    rt.act({ type: 'skill', actorId: 'hero', id: 'stun' }); expect(rt.isReady('hero')).toBe(true);
    rt.act({ type: 'item', actorId: 'hero', id: 'missing' }); expect(rt.isReady('hero')).toBe(true);
    rt.act({ type: 'item', actorId: 'hero', id: 'potion_hp' }); expect(rt.player.party[0].stats.hp).toBe(9030); expect(rt.player.inventory).toHaveLength(0);
    step(rt); rt.act({ type: 'run', actorId: 'hero' }); expect(rt.isReady('hero')).toBe(false); expect(rt.outcome).toBeNull();
  });
  it('initializes summons next round with no immediate attack and no reward', () => {
    const boss = { ...createEnemyById('the_necromancer'), initiative: 10, phase: 2, combatFlags: ['necromancer_mass_ready'], intent: { type: 'SUMMON' as const, label: 'Mass Raise', shortLabel: 'Raise', icon: '', abilityId: 'necromancer_mass_raise', interruptible: true } };
    const rt = new CombatRuntime(party([hero('slow', 1)]), [boss], () => 0.5); step(rt);
    const summoned = rt.enemies.filter(e => e.isSummoned); expect(summoned).toHaveLength(2); expect(rt.turnId).toBe('slow');
    summoned.forEach(e => { expect(rt.actors[e.id].eligibleRound).toBe(2); expect(rt.order).not.toContain(e.id); expect(e.xpReward).toBe(0); });
    rt.act({ type: 'defend', actorId: 'slow' }); summoned.forEach(e => expect(rt.order).toContain(e.id));
  });
  it('preserves announced boss intent across phase change then plans the ritual', () => {
    const h = hero(); h.stats.str = 170;
    const boss = { ...createEnemyById('the_necromancer'), initiative: 10, intent: { type: 'ATTACK' as const, label: 'Soul Bolt', shortLabel: 'Bolt', icon: '', abilityId: 'necromancer_soul_bolt', interruptible: true } };
    const rt = new CombatRuntime(party([h]), [boss], () => 0.5); const result = rt.act({ type: 'attack', actorId: 'hero' });
    expect(rt.enemies[0].phase).toBe(2); expect(result.events?.filter(e => e.kind === 'phase')).toHaveLength(1);
    expect(rt.enemies[0].intent?.abilityId).toBe('necromancer_soul_bolt'); step(rt);
    expect(rt.enemies[0].intent?.abilityId).toBe('necromancer_mass_raise_prepare');
  });
  it('revives an ally into the following round without granting an immediate extra action', () => {
    const healer = hero(); healer.skills = [{ ...stun, id: 'heal', type: 'HEAL', targetType: 'ALLY', basePower: 30, effect: undefined }];
    const dead = hero('dead', 20); dead.stats.hp = 0;
    const rt = new CombatRuntime(party([healer, dead]), [rat()]); rt.act({ type: 'skill', actorId: 'hero', id: 'heal' });
    expect(rt.player.party[1].stats.hp).toBe(30); expect(rt.actors.dead.eligibleRound).toBe(2); expect(rt.order).not.toContain('dead');
    step(rt); expect(rt.turnId).toBe('dead');
  });
  it('clears guard on escape and retains HP-for-MP special skill costs', () => {
    const h = hero(); h.skills = [{ ...stun, id: 'soul_pact', type: 'BUFF', targetType: 'SELF', cost: 0, effect: undefined }]; h.stats.mp = 0;
    const rt = new CombatRuntime(party([h]), [rat()], () => 0.99);
    rt.act({ type: 'skill', actorId: 'hero', id: 'soul_pact' }); expect(rt.player.party[0].stats.hp).toBe(9980); expect(rt.player.party[0].stats.mp).toBe(40);
    step(rt); expect(rt.act({ type: 'run', actorId: 'hero' }).outcome).toBe('escaped'); expect(rt.turnId).toBeNull(); expect(rt.player.party[0].isDefending).toBe(false);
  });
  it('removes a queued enemy killed by another hero and ends combat on last-enemy status death', () => {
    const first = { ...rat(), hp: 1 }, second = rat();
    const rt = new CombatRuntime(party(), [first, second], () => 0.5);
    rt.act({ type: 'attack', actorId: 'hero', targetId: first.id });
    expect(rt.order).not.toContain(first.id); expect(rt.actors[first.id]).toBeUndefined(); expect(rt.turnId).toBe(second.id);
    const poisoned = { ...rat(), hp: 1, statusEffects: [createStatusEffect('POISON', 1, 5)] };
    const end = new CombatRuntime(party(), [poisoned]); end.act({ type: 'defend', actorId: 'hero' });
    expect(step(end).outcome).toBe('victory'); expect(end.player.party[0].isDefending).toBe(false); expect(end.turnId).toBeNull();
  });
  it('cancels a forced Necromancer ritual without immediately planning it again', () => {
    const boss = { ...createEnemyById('the_necromancer'), initiative: 10, phase: 2, combatFlags: ['necromancer_mass_due'], intent: { type: 'PREPARE' as const, label: 'Mass Raise', shortLabel: 'Raise', icon: '', abilityId: 'necromancer_mass_raise_prepare', interruptible: true } };
    const rt = new CombatRuntime(party(), [boss], () => 0.99);
    rt.act({ type: 'skill', actorId: 'hero', id: 'stun' }); step(rt);
    expect(rt.enemies[0].combatFlags).not.toContain('necromancer_mass_due'); expect(rt.enemies[0].intent?.abilityId).not.toBe('necromancer_mass_raise_prepare');
  });
  it('keeps a low-health Soul Pact invalid without consuming its turn', () => {
    const h = hero(); h.stats.hp = 20; h.skills = [{ ...stun, id: 'soul_pact', type: 'BUFF', targetType: 'SELF', cost: 0, effect: undefined }];
    const rt = new CombatRuntime(party([h]), [rat()]); rt.act({ type: 'skill', actorId: 'hero', id: 'soul_pact' });
    expect(rt.isReady('hero')).toBe(true); expect(rt.player.party[0].stats.hp).toBe(20);
  });

});
