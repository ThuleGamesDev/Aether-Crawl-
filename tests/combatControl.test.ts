import { describe, expect, it } from 'vitest';
import { combatKeyInput, combatTouchInput, cycleTarget, quickCommand, quickPotion, selectCharacter, skillEffectSummary } from '../services/combatInput';
import { CombatRuntime } from '../services/combatRuntime';
import { createEnemyById } from '../services/gameLogic';
import { createStatusEffect } from '../services/combat';
import { eventLabel } from '../services/combatFeedback';
import type { Character, Player, Skill } from '../types';
const skill: Skill = { id: 'zap', name: 'Zap', type: 'DAMAGE', targetType: 'SINGLE', cost: 10, basePower: 20, scaling: 0, scalingStat: 'INT', description: 'Zap', level: 1, maxLevel: 1, vfxType: 'ATTACK' };
const hero = (id: string): Character => ({ id, name: id, classType: 'PALADIN', stats: { hp: 1000, maxHp: 1000, mp: 100, maxMp: 100, str: 10, dex: 0, int: 10, xp: 0, level: 1 }, equipment: { weapon: null, armor: null, offhand: null, accessory: null }, skills: [skill], statusEffects: [], isDefending: false });
const player = (): Player => ({ pos: { x: 1, y: 1 }, dir: 'E', party: [hero('a'), hero('b')], inventory: [{ id: 'potion_hp', name: 'HP', description: '', type: 'POTION', value: 30, quantity: 3 }, { id: 'potion_mp', name: 'MP', description: '', type: 'POTION', value: 30, quantity: 2 }], scrap: 0 });
const enemy = () => ({ ...createEnemyById('giant_rat'), hp: 10000, maxHp: 10000 });
const runtime = () => new CombatRuntime(player(), [enemy()], () => 0.5);

describe('Combat 2.5B direct controls', () => {
  it('selects living characters directly even before they are READY, and skips defeated members when cycling', () => {
    const party = player().party;
    expect(selectCharacter(party, 1)).toBe(1);
    party[1].stats.hp = 0; expect(selectCharacter(party, 1)).toBeNull(); expect(selectCharacter(party, 0, true)).toBe(0);
    expect(selectCharacter(party, 3)).toBeNull();
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
    expect(combatTouchInput('party')).toEqual({ type: 'characterCycle' });
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
  it('rejects an early basic attack without changing resources, HP or readiness', () => {
    const rt = runtime(); const before = rt.snapshot(); const hp = rt.enemies[0].hp;
    expect(rt.act({ actorId: 'a', type: 'attack', targetId: rt.enemies[0].id }).logs).toEqual(['Still recovering.']);
    expect(rt.snapshot()).toEqual(before); expect(rt.enemies[0].hp).toBe(hp);
  });
  it('buffers one skill only in the last 250 ms and pays once at READY', () => {
    const rt = runtime(); const command = { actorId: 'a', type: 'skill' as const, id: 'zap', targetId: rt.enemies[0].id };
    expect(rt.queueSkill(command)).toBe(false); rt.advance(250);
    expect(rt.queueSkill(command)).toBe(true); expect(rt.queueSkill(command)).toBe(false);
    expect(rt.player.party[0].stats.mp).toBe(100); rt.advance(200);
    expect(rt.player.party[0].stats.mp).toBe(90); expect(rt.enemies[0].hp).toBe(9980);
    expect(rt.actors.a.queued).toBeUndefined(); rt.advance(10); expect(rt.player.party[0].stats.mp).toBe(90);
  });
  it('cancels the buffer explicitly and on stun, leaving resources unspent', () => {
    const rt = runtime(); rt.advance(250); const command = { actorId: 'a', type: 'skill' as const, id: 'zap', targetId: rt.enemies[0].id };
    rt.queueSkill(command); rt.cancelQueued('a'); rt.advance(200); expect(rt.player.party[0].stats.mp).toBe(100);
    const other = runtime(); other.advance(250); other.queueSkill({ ...command, targetId: other.enemies[0].id });
    other.player.party[0].statusEffects = [createStatusEffect('STUN', 1, 0)]; other.advance(200);
    expect(other.actors.a.queued).toBeUndefined(); expect(other.player.party[0].stats.mp).toBe(100);
  });
  it('cancels a skill whose target died, instead of silently redirecting it', () => {
    const rt = new CombatRuntime(player(), [enemy(), enemy()], () => 0.5); rt.advance(250);
    rt.queueSkill({ actorId: 'a', type: 'skill', id: 'zap', targetId: rt.enemies[0].id });
    rt.enemies[0] = { ...rt.enemies[0], hp: 0 }; rt.advance(200);
    expect(rt.enemies[1].hp).toBe(10000); expect(rt.player.party[0].stats.mp).toBe(100);
  });
  it('revalidates MP at buffer execution and does not leave an infinite buffer', () => {
    const rt = runtime(); rt.advance(250); rt.queueSkill({ actorId: 'a', type: 'skill', id: 'zap', targetId: rt.enemies[0].id });
    rt.player.party[0].stats.mp = 0; rt.advance(200);
    expect(rt.actors.a.queued).toBeUndefined(); expect(rt.isReady('a')).toBe(true); expect(rt.enemies[0].hp).toBe(10000);
  });
  it('keeps auto OFF by default; ON acts only for an inactive hero without spending MP or items', () => {
    const rt = runtime(); rt.advance(600); expect(rt.enemies[0].hp).toBe(10000);
    const inv = rt.player.inventory; rt.setControl('a', rt.enemies[0].id, true); rt.advance(1);
    expect(rt.enemies[0].hp).toBe(9990); expect(rt.isReady('a')).toBe(true); expect(rt.isReady('b')).toBe(false);
    expect(rt.player.party.map(h => h.stats.mp)).toEqual([100, 100]); expect(rt.player.inventory).toEqual(inv);
  });
  it('requires a valid living target for auto, and disabling auto preserves READY', () => {
    const rt = runtime(); rt.setControl('a', 'missing', true); rt.advance(600); expect(rt.isReady('b')).toBe(true);
    rt.setControl('a', rt.enemies[0].id, false); rt.advance(100); expect(rt.enemies[0].hp).toBe(10000);
  });
  it('freezes auto and buffer during pause and respects slowdown', () => {
    const rt = runtime(); rt.advance(250); rt.queueSkill({ actorId: 'a', type: 'skill', id: 'zap', targetId: rt.enemies[0].id });
    rt.setControl('a', rt.enemies[0].id, true); rt.setPaused(true); rt.advance(5000);
    expect(rt.player.party[0].stats.mp).toBe(100); expect(rt.actors.a.remainingMs).toBe(200);
    rt.setPaused(false); rt.setSlowdown(true); rt.advance(500); expect(rt.actors.a.remainingMs).toBe(100);
    rt.advance(500); expect(rt.player.party[0].stats.mp).toBe(90);
  });
  it('reports actual absorbed damage separately and caps the floating hit at remaining HP', () => {
    const e = { ...enemy(), hp: 4, guard: 5 }; const rt = new CombatRuntime(player(), [e], () => 0.5); rt.advance(600);
    const result = rt.act({ type: 'attack', actorId: 'a', targetId: e.id });
    expect(result.events?.filter(e => e.kind === 'damage')).toEqual([{ kind: 'damage', amount: 4, targetId: e.id, source: 'player' }]);
    expect(result.events?.filter(e => e.kind === 'block')).toEqual([{ kind: 'block', amount: 5, targetId: e.id }]);
    expect(eventLabel({ kind: 'crit', amount: 12, targetId: 'a' })).toBe('CRIT 12');
  });
  it('emits phase events once through the central clock', () => {
    const boss = { ...createEnemyById('the_necromancer'), hp: 100, maxHp: 400 };
    const rt = new CombatRuntime(player(), [boss], () => 0.5);
    expect(rt.advance(1).events?.filter(e => e.kind === 'phase')).toHaveLength(1);
    expect(rt.advance(1).events?.filter(e => e.kind === 'phase')).toHaveLength(0);
  });
});


describe('Combat 2.5B feedback lifecycle', () => {
  it('emits one structured interrupt when a live heavy cast is cancelled', () => {
    const orc = { ...createEnemyById('orc_brute'), hp: 10000, maxHp: 10000, intent: { type: 'HEAVY_ATTACK' as const, abilityId: 'orc_crushing_blow', label: 'Crush', shortLabel: 'Crush', icon: '!', interruptible: true, castTimeMs: 2000 } };
    const rt = new CombatRuntime(player(), [orc], () => 0.5); rt.advance(1500);
    rt.enemies[0] = { ...rt.enemies[0], statusEffects: [createStatusEffect('STUN', 1, 0)] };
    expect(rt.advance(1).events?.filter(e => e.kind === 'interrupt')).toEqual([{ kind: 'interrupt', targetId: orc.id }]);
    expect(rt.advance(1).events?.filter(e => e.kind === 'interrupt')).toHaveLength(0);
  });
  it('keeps enemy damage, block and status-tick feedback separate', () => {
    const rt = new CombatRuntime(player(), [enemy()], () => 0); rt.player.party[0].equipment.armor = { id: 'armor', name: 'Armor', description: '', type: 'ARMOR', value: 2, quantity: 1 };
    rt.player.party[0].statusEffects = [createStatusEffect('POISON', 1, 3)];
    expect(rt.advance(600).events?.some(e => e.kind === 'poison' && e.amount === 3)).toBe(true);
    rt.act({ type: 'defend', actorId: 'a' });
    const hit = rt.advance(1800); expect(hit.events?.some(e => e.kind === 'damage' && e.source === 'enemy')).toBe(true);
    expect(hit.events?.some(e => e.kind === 'block')).toBe(true);
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
