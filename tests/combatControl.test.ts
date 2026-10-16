import { describe, expect, it } from 'vitest';
import { combatKeyInput, combatTouchInput, cycleTarget, quickCommand, quickPotion, skillEffectSummary } from '../services/combatInput';
import { CombatRuntime } from '../services/combatRuntime';
import { createEnemyById } from '../services/gameLogic';
import { createStatusEffect } from '../services/combat';
import { eventLabel } from '../services/combatFeedback';
import type { Character, Player, Skill } from '../types';
const skill: Skill = { id: 'zap', name: 'Zap', type: 'DAMAGE', targetType: 'SINGLE', cost: 10, basePower: 20, scaling: 0, scalingStat: 'INT', description: 'Zap', level: 1, maxLevel: 1, vfxType: 'ATTACK' };
const hero = (id: string): Character => ({ id, name: id, classType: 'PALADIN', stats: { initiative: 10, hp: 1000, maxHp: 1000, mp: 100, maxMp: 100, str: 10, dex: 0, int: 10, xp: 0, level: 1 }, equipment: { weapon: null, armor: null, offhand: null, accessory: null }, skills: [skill], statusEffects: [], isDefending: false });
const player = (): Player => ({ pos: { x: 1, y: 1 }, dir: 'E', party: [hero('a'), hero('b')], inventory: [{ id: 'potion_hp', name: 'HP', description: '', type: 'POTION', value: 30, quantity: 3 }, { id: 'potion_mp', name: 'MP', description: '', type: 'POTION', value: 30, quantity: 2 }], scrap: 0 });
const enemy = () => ({ ...createEnemyById('giant_rat'), initiative: 10, hp: 10000, maxHp: 10000 });
const runtime = () => new CombatRuntime(player(), [enemy()], () => 0.5);

describe('Initiative-round direct controls', () => {
  it('rejects a mapped action from a waiting hero without changing turn ownership', () => {
    const rt = runtime(), before = rt.enemies[0].hp;
    const command = quickCommand(rt.player.party[1], rt.enemies[0].id, { type: 'attack' }, rt.player.inventory)!;
    expect(rt.act(command).logs.join(' ')).toContain('not that hero');
    expect(rt.turnId).toBe('a'); expect(rt.enemies[0].hp).toBe(before);
  });
  it('maps party keys and all four quick skills without colliding with target keys', () => {
    expect(combatKeyInput('F2')).toEqual({ type: 'character', index: 1 });
    expect(combatKeyInput('Digit4')).toEqual({ type: 'character', index: 3 });
    ['KeyQ', 'KeyE', 'KeyR', 'KeyF'].forEach((code, slot) => expect(combatKeyInput(code)).toEqual({ type: 'quickSkill', slot }));
    expect(combatKeyInput('Tab', true)).toEqual({ type: 'targetCycle', direction: -1 });
    expect(combatKeyInput('KeyW')).toBeNull();
  });
  it('uses the same command mapping for mouse/basic, keyboard skill and touch', () => {
    const p = player();
    expect(quickCommand(p.party[1], 'rat', { type: 'attack' }, p.inventory)).toEqual({ type: 'attack', actorId: 'b', targetId: 'rat' });
    expect(quickCommand(p.party[0], 'rat', combatTouchInput('skill0')!, p.inventory)).toEqual({ type: 'skill', actorId: 'a', targetId: 'rat', id: 'zap' });
    expect(quickCommand(p.party[0], 'rat', { type: 'quickSkill', slot: 3 }, p.inventory)).toBeNull();
    expect(combatTouchInput('target')).toEqual({ type: 'targetCycle', direction: 1 });
    expect(combatTouchInput('party')).toBeNull();
    expect(combatTouchInput('unknown')).toBeNull();
  });
  it('cycles only living targets, wraps in both directions, and handles stale IDs and empty lists', () => {
    const first = enemy(), dead = { ...enemy(), hp: 0 }, last = enemy(); const list = [first, dead, last];
    expect(cycleTarget(list, first.id)).toBe(last.id); expect(cycleTarget(list, first.id, -1)).toBe(last.id);
    expect(cycleTarget(list, last.id)).toBe(first.id); expect(cycleTarget(list, dead.id)).toBe(first.id);
    expect(cycleTarget([dead], dead.id)).toBeNull();
  });
  it('defaults to HP potion and never silently substitutes another potion for an exhausted explicit binding', () => {
    const p = player(); expect(quickPotion(p.inventory)?.id).toBe('potion_hp');
    expect(quickPotion(p.inventory, 'potion_mp')?.id).toBe('potion_mp');
    expect(quickPotion(p.inventory, 'missing')).toBeUndefined();
  });
  it('maps no auto, pause or party-cycle command in turn-based combat', () => {
    expect(combatKeyInput('KeyB')).toBeNull(); expect(combatKeyInput('Space')).toBeNull();
    expect(combatTouchInput('auto')).toBeNull(); expect(combatTouchInput('party')).toBeNull();
  });
  it('reports actual absorbed damage separately and caps the floating hit at remaining HP', () => {
    const e = { ...enemy(), hp: 4, guard: 5 }; const rt = new CombatRuntime(player(), [e], () => 0.5); rt.flush();
    const result = rt.act({ type: 'attack', actorId: 'a', targetId: e.id });
    expect(result.events?.filter(e => e.kind === 'damage')).toEqual([{ kind: 'damage', amount: 4, targetId: e.id, source: 'player' }]);
    expect(result.events?.filter(e => e.kind === 'block')).toEqual([{ kind: 'block', amount: 5, targetId: e.id }]);
    expect(eventLabel({ kind: 'crit', amount: 12, targetId: 'a' })).toBe('CRIT 12');
  });
  it('emits phase events once through encounter transitions', () => {
    const boss = { ...createEnemyById('the_necromancer'), hp: 100, maxHp: 400 };
    const rt = new CombatRuntime(player(), [boss], () => 0.5);
    expect(rt.flush().events?.filter(e => e.kind === 'phase')).toHaveLength(1);
    expect(rt.flush().events?.filter(e => e.kind === 'phase')).toHaveLength(0);
  });
});


describe('Quick skill effect descriptions', () => {
  it('describes Soul Pact custom resources without promising its unused regeneration metadata', () => {
    const soul = { ...skill, id: 'soul_pact', type: 'BUFF' as const, effect: { type: 'REGEN' as const, chance: 1, duration: 1, val: 20 } };
    expect(skillEffectSummary(hero('a'), soul)).toBe('Spend 20 HP to restore up to 40 MP.');
  });
  it('describes actual ally targeting and HP healing rather than suggesting a group heal or MP recovery', () => {
    expect(skillEffectSummary(hero('a'), { ...skill, type: 'HEAL', targetType: 'ALLY' })).toBe('Restore up to 20 HP to the lowest-health ally.');
    expect(skillEffectSummary(hero('a'), { ...skill, id: 'focus', type: 'HEAL', targetType: 'SELF' })).toBe('Restore up to 20 HP to self.');
  });
});
