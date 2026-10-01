import { describe, expect, it } from 'vitest';
import type { Character, Enemy, EnemyIntent } from '../types';
import { createEnemyById } from '../services/gameLogic';
import {
  activateEnemyPhases,
  planEnemyIntent,
  resolveEnemyIntent,
  settleDefeatedEnemyTheft,
} from '../services/enemyAI';

const character = (id = 'hero'): Character => ({
  id,
  name: id === 'hero' ? 'Aldric' : id,
  classType: 'PALADIN',
  stats: { hp: 100, maxHp: 100, mp: 20, maxMp: 20, str: 10, dex: 0, int: 8, xp: 0, level: 1 },
  equipment: { weapon: null, armor: null, offhand: null, accessory: null },
  skills: [],
  statusEffects: [],
  isDefending: false,
});

const intent = (enemy: Enemy, abilityId: string, type: EnemyIntent['type'], label: string): Enemy => ({
  ...enemy,
  intent: { type, label, shortLabel: label, icon: '⚔', abilityId },
});

describe('enemy intents and ability resolution', () => {
  it('plans a Giant Rat bite before the party phase and resolves that advertised ability', () => {
    const rat = planEnemyIntent(createEnemyById('giant_rat'), [], 0, () => 0);
    expect(rat.intent).toMatchObject({ type: 'ATTACK', abilityId: 'rat_bite', minDamage: 3, maxDamage: 5 });
    const result = resolveEnemyIntent(rat.id, [rat], [character()], 0, () => 0);
    expect(result.logs.join(' ')).toContain('uses Bite on Aldric');
    expect(result.party[0].stats.hp).toBe(96);
    expect(planEnemyIntent({ ...rat, hp: 5 }, [rat], 0, () => 0.99).intent).toMatchObject({ type: 'HEAVY_ATTACK', abilityId: 'rat_desperate_bite' });
  });

  it('guarantees the Orc wind-up follow-up and its recover action', () => {
    const orc = createEnemyById('orc_brute');
    const windUp = planEnemyIntent({ ...orc, previousAbilityId: 'orc_slam', abilityCooldowns: { orc_slam: 1 } }, [orc], 0, () => 0);
    expect(windUp.intent).toMatchObject({ type: 'PREPARE', abilityId: 'orc_wind_up', interruptible: true });
    const prepared = resolveEnemyIntent(windUp.id, [windUp], [character()], 0, () => 0);
    expect(prepared.enemies[0].combatFlags).toContain('orc_wind_up');

    const crushing = planEnemyIntent(prepared.enemies[0], prepared.enemies, 0, () => 0.99);
    expect(crushing.intent).toMatchObject({ type: 'HEAVY_ATTACK', abilityId: 'orc_crushing_blow', label: 'Crushing Blow', interruptible: true });
    expect(crushing.intent).not.toHaveProperty('minDamage');
    const hit = resolveEnemyIntent(crushing.id, [crushing], [{ ...character(), isDefending: true }], 0, () => 0);
    expect(hit.logs.join(' ')).toContain('uses Crushing Blow');
    expect(hit.party[0].stats.hp).toBe(86);
    expect(hit.enemies[0].combatFlags).toContain('orc_recover');

    const recover = planEnemyIntent(hit.enemies[0], hit.enemies, 0, () => 0.99);
    expect(recover.intent).toMatchObject({ type: 'DEFEND', abilityId: 'orc_recover' });
    expect(resolveEnemyIntent(recover.id, [recover], [character()], 0).enemies[0].combatFlags).not.toContain('orc_recover');
  });

  it('lets Stun cancel a prepared Orc heavy attack', () => {
    const orc = intent(createEnemyById('orc_brute'), 'orc_crushing_blow', 'HEAVY_ATTACK', 'Crushing Blow');
    orc.combatFlags = ['orc_wind_up'];
    orc.statusEffects = [{ id: 'stun', type: 'STUN', name: 'Stun', duration: 1, value: 0, icon: '💫' }];
    const result = resolveEnemyIntent(orc.id, [orc], [character()], 0, () => 0);
    expect(result.stunned).toBe(true);
    expect(result.party[0].stats.hp).toBe(100);
    expect(result.enemies[0].combatFlags).not.toContain('orc_wind_up');
    expect(result.logs.join(' ')).toContain('loses Crushing Blow');
  });

  it('has Acid Spider Venom Fang apply the existing Poison status', () => {
    const spider = planEnemyIntent(createEnemyById('acid_spider'), [], 0, () => 0);
    expect(spider.intent?.abilityId).toBe('spider_venom_fang');
    expect(spider.intent).toMatchObject({ type: 'DEBUFF', label: 'Venom Fang', icon: '☠' });
    expect(spider.intent).not.toHaveProperty('minDamage');
    const result = resolveEnemyIntent(spider.id, [spider], [character()], 0, () => 0);
    expect(result.party[0].statusEffects).toContainEqual(expect.objectContaining({ type: 'POISON', duration: 2, value: 3 }));
    expect(result.logs.join(' ')).toContain('afflicted with poison');
  });

  it('makes Dark Chant strengthen all living enemies but leaves dead enemies unchanged', () => {
    const cultist = createEnemyById('dark_cultist');
    const ally = createEnemyById('skeleton_warrior');
    const deadAlly = { ...createEnemyById('giant_rat'), hp: 0 };
    const group = [cultist, ally, deadAlly];
    const planned = planEnemyIntent(cultist, group, 0, () => 0.99);
    expect(planned.intent?.abilityId).toBe('cultist_dark_chant');
    const result = resolveEnemyIntent(planned.id, [planned, ally, deadAlly], [character()], 0, () => 0);
    expect(result.enemies[0].statusEffects).toContainEqual(expect.objectContaining({ type: 'STRENGTH', value: 4, duration: 3 }));
    expect(result.enemies[1].statusEffects).toContainEqual(expect.objectContaining({ type: 'STRENGTH', value: 4, duration: 3 }));
    expect(result.enemies[2].statusEffects).toHaveLength(0);
  });

  it('lets a Skeleton Warrior guard itself and protect a living ally', () => {
    const skeleton = createEnemyById('skeleton_warrior');
    const ally = createEnemyById('goblin_scavenger');
    const planned = planEnemyIntent(skeleton, [skeleton, ally], 0, () => 0.99);
    expect(planned.intent?.abilityId).toBe('skeleton_raise_shield');
    const result = resolveEnemyIntent(planned.id, [planned, ally], [character()], 0, () => 0);
    expect(result.enemies[0].guard).toBe(10);
    expect(result.enemies[1].guard).toBe(10);
    expect(result.logs.join(' ')).toContain('shields an ally');
  });

  it('returns a Goblin Scavenger’s stolen scrap as soon as it is defeated', () => {
    const goblin = createEnemyById('goblin_scavenger');
    const planned = planEnemyIntent(goblin, [goblin], 6, () => 0.99);
    expect(planned.intent?.abilityId).toBe('goblin_scavenge');
    const stolen = resolveEnemyIntent(planned.id, [planned], [character()], 6, () => 0);
    expect(stolen.scrap).toBe(3);
    expect(stolen.enemies[0].stolenScrap).toBe(3);
    const returned = settleDefeatedEnemyTheft(stolen.enemies.map(enemy => ({ ...enemy, hp: 0 })));
    expect(returned.refundedScrap).toBe(3);
    expect(returned.enemies[0].stolenScrap).toBe(0);
  });

  it('prepares and splits a wounded Green Slime once, creating non-splitting children', () => {
    const slime = { ...createEnemyById('green_slime'), hp: 40, previousAbilityId: 'slime_bounce' };
    const unstable = planEnemyIntent(slime, [slime], 0, () => 0.99);
    expect(unstable.intent?.abilityId).toBe('slime_unstable');
    const primed = resolveEnemyIntent(unstable.id, [unstable], [character()], 0, () => 0);
    const split = planEnemyIntent(primed.enemies[0], primed.enemies, 0, () => 0);
    expect(split.intent).toMatchObject({ type: 'SUMMON', abilityId: 'slime_split' });
    const result = resolveEnemyIntent(split.id, [split], [character()], 0, () => 0);
    const children = result.enemies.filter(enemy => enemy.id !== slime.id);
    expect(children).toHaveLength(2);
    expect(result.enemies.find(enemy => enemy.id === slime.id)?.hp).toBe(0);
    expect(result.enemies.filter(enemy => enemy.hp > 0)).toHaveLength(2);
    expect(children.every(enemy => enemy.definitionId === 'green_slime' && enemy.canSplit === false && enemy.isSummoned)).toBe(true);
    expect(children.every(enemy => enemy.xpReward === 0)).toBe(true);
    const childNextIntent = planEnemyIntent(children[0], children, 0, () => 0);
    expect(childNextIntent.intent?.abilityId).not.toBe('slime_unstable');
  });

  it('enters Necromancer phase two, telegraphs Mass Raise, and respects the enemy cap', () => {
    const boss = { ...createEnemyById('the_necromancer', 1, { isBoss: true }), hp: 230 };
    const phase = activateEnemyPhases([boss]);
    expect(phase.enemies[0]).toMatchObject({ phase: 2, combatFlags: ['necromancer_mass_due'] });
    expect(phase.logs[0]).toContain('Phase II');

    const preparation = planEnemyIntent(phase.enemies[0], phase.enemies, 0, () => 0.99);
    expect(preparation.intent).toMatchObject({ type: 'PREPARE', abilityId: 'necromancer_mass_raise_prepare' });
    const prepared = resolveEnemyIntent(preparation.id, [preparation], [character()], 0, () => 0);
    const summonIntent = planEnemyIntent(prepared.enemies[0], prepared.enemies, 0, () => 0);
    expect(summonIntent.intent).toMatchObject({ type: 'SUMMON', abilityId: 'necromancer_mass_raise' });

    const alreadyCrowded = [summonIntent, ...Array.from({ length: 3 }, () => createEnemyById('giant_rat'))];
    const summoned = resolveEnemyIntent(summonIntent.id, alreadyCrowded, [character()], 0, () => 0, 5);
    expect(summoned.enemies.filter(enemy => enemy.hp > 0)).toHaveLength(5);
    expect(summoned.enemies.filter(enemy => enemy.summonedBy === boss.id)).toHaveLength(1);
    expect(summoned.logs.join(' ')).toContain('enemy limit reached');
  });

  it('supports Phase I Summon Dead and allows Stun to interrupt the Phase II ritual', () => {
    const boss = {
      ...createEnemyById('the_necromancer', 1, { isBoss: true }),
      abilityCooldowns: { necromancer_soul_bolt: 1, necromancer_curse: 1 },
    };
    const summonIntent = planEnemyIntent(boss, [boss], 0, () => 0.99);
    expect(summonIntent.intent?.abilityId).toBe('necromancer_summon_dead');
    const summoned = resolveEnemyIntent(summonIntent.id, [summonIntent], [character()], 0, () => 0);
    expect(summoned.enemies.filter(enemy => enemy.summonedBy === boss.id)).toHaveLength(1);

    const raised = intent(createEnemyById('the_necromancer', 1, { isBoss: true }), 'necromancer_mass_raise', 'SUMMON', 'Mass Raise');
    raised.intent = { ...raised.intent!, interruptible: true };
    raised.phase = 2;
    raised.combatFlags = ['necromancer_mass_ready'];
    raised.statusEffects = [{ id: 'stun', type: 'STUN', name: 'Stun', duration: 1, value: 0, icon: '💫' }];
    const interrupted = resolveEnemyIntent(raised.id, [raised], [character()], 0, () => 0);
    expect(interrupted.stunned).toBe(true);
    expect(interrupted.enemies[0].combatFlags).not.toContain('necromancer_mass_ready');
    expect(interrupted.enemies.filter(enemy => enemy.summonedBy === raised.id)).toHaveLength(0);

    const soulBolt = intent({ ...createEnemyById('the_necromancer', 1, { isBoss: true }), statusEffects: [{ id: 'stun', type: 'STUN', name: 'Stun', duration: 1, value: 0, icon: '💫' }] }, 'necromancer_soul_bolt', 'ATTACK', 'Soul Bolt');
    const resisted = resolveEnemyIntent(soulBolt.id, [soulBolt], [character()], 0, () => 0);
    expect(resisted.stunned).toBe(false);
    expect(resisted.party[0].stats.hp).toBe(75);
    expect(resisted.logs.join(' ')).toContain('not interruptible');
  });

  it('lets Soul Harvest consume one summon and heal the Necromancer without exceeding max HP', () => {
    const boss = {
      ...createEnemyById('the_necromancer', 1, { isBoss: true }),
      hp: 390,
      phase: 2,
      previousAbilityId: 'necromancer_soul_bolt',
      combatFlags: ['necromancer_mass_raised'],
    };
    const minion = createEnemyById('skeleton_warrior', 0.75, { isSummoned: true, summonedBy: boss.id, canSplit: false });
    const planned = planEnemyIntent(boss, [boss, minion], 0, () => 0);
    expect(planned.intent?.abilityId).toBe('necromancer_soul_harvest');
    const result = resolveEnemyIntent(planned.id, [planned, minion], [character()], 0, () => 0);
    expect(result.enemies.find(enemy => enemy.id === boss.id)?.hp).toBe(400);
    expect(result.enemies.find(enemy => enemy.id === minion.id)?.hp).toBe(0);
    expect(result.logs.join(' ')).toContain('consumes Skeleton Warrior');
  });

  it('does not let dead enemies act and counts down ability cooldowns between their turns', () => {
    const deadRat = { ...createEnemyById('giant_rat'), hp: 0 };
    const deadResult = resolveEnemyIntent(deadRat.id, [deadRat], [character()], 0);
    expect(deadResult.acted).toBe(false);
    expect(deadResult.party[0].stats.hp).toBe(100);

    const spider = intent(createEnemyById('acid_spider'), 'spider_venom_fang', 'DEBUFF', 'Venom Fang');
    const used = resolveEnemyIntent(spider.id, [spider], [character()], 0, () => 0);
    const next = planEnemyIntent(used.enemies[0], used.enemies, 0, () => 0.99);
    expect(next.intent?.abilityId).toBe('spider_web');
    const recovered = resolveEnemyIntent(next.id, [next], [character()], 0, () => 0);
    expect(planEnemyIntent(recovered.enemies[0], recovered.enemies, 0, () => 0).intent?.abilityId).toBe('spider_venom_fang');
  });
});
