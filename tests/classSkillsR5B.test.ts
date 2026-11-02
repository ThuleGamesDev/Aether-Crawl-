import { describe, expect, it } from 'vitest';
import { ABILITY_REGISTRY, CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { applyEnemyDamage, resolveAreaAttack } from '../combat/DamageSystem';
import { updateProjectiles } from '../combat/ProjectileSystem';
import { applyRealtimeStatus, actionSpeedMultiplier, cleanseRealtimeStatuses, movementSpeedMultiplier, tickRealtimeStatuses } from '../combat/StatusSystem';
import { getClassSkillKit } from '../data/classSkillKits';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import type { InputFrame } from '../engine/InputSystem';
import { PlayerCombat } from '../player/PlayerCombat';
import { createClassPassiveState, recordClassHealing, recordClassKill, recordClassMeleeAction, recordMarkedPreyHit, resolveClassPassiveAction, tickClassPassiveState } from '../player/ClassPassives';
import { createPlayerCharacter, grantExperience } from '../player/PlayerProgression';
import { getRankedAbility, normalizeSkillProgression } from '../player/SkillProgression';
import { loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import { TileType, type PlayerCharacter, type WorldEnemy } from '../types';

const openMap = (size = 16): number[][] => Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => x === 0 || z === 0 || x === size - 1 || z === size - 1 ? TileType.WALL : TileType.EMPTY));
const makeEnemy = (id: string, x: number, z = 1.5, overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id, definitionId: 'giant_rat', name: 'Cretan Cave Rat', visualId: 'giant_rat', position: { x, y: 0, z }, collisionRadius: 0.24,
  health: 500, maxHealth: 500, damage: 20, xpReward: 0, state: 'STAGGER', stateTimer: 8, attackCooldown: 8,
  attackRange: 1.2, attackTelegraphSeconds: 0.5, rewardGranted: false, isBoss: false, attackSetId: 'rat',
  statusEffects: [], facingYaw: Math.PI, ...overrides,
});
const input = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
});

function prepareRuntime(classId: PlayerCharacter['classId'], skills: string[]): FPSGameRuntime {
  const runtime = new FPSGameRuntime(classId);
  runtime.world = { ...runtime.world, map: openMap() };
  runtime.player = {
    ...runtime.player,
    position: { x: 1.5, y: 0, z: 1.5 },
    rotation: { yaw: 0, pitch: -0.08 },
    stats: { ...runtime.player.stats, level: 6, hp: runtime.player.stats.maxHp, mp: runtime.player.stats.maxMp },
    skills: skills.map(abilityId => ({ abilityId, rank: 1 })),
    skillPoints: 0,
    classPassiveState: createClassPassiveState(classId),
    statusEffects: [],
  };
  runtime.enemies = [];
  return runtime;
}

function advance(runtime: FPSGameRuntime, frames = 20): void {
  for (let index = 0; index < frames; index += 1) runtime.update(0.05, input());
}

describe('FPS-R5B eight-class integration', () => {
  it('registers four distinct active skills beside the unchanged primary and secondary for all eight classes', () => {
    const classes = ['BARBARIAN', 'PALADIN', 'SORCERER', 'ROGUE', 'RANGER', 'CLERIC', 'MONK', 'NECROMANCER'] as const;
    for (const classId of classes) {
      const kit = getClassSkillKit(classId);
      const loadout = CLASS_ABILITY_LOADOUT[classId];
      expect(kit?.skills).toHaveLength(4);
      expect(loadout.skillSlots).toHaveLength(4);
      expect(loadout.skillSlots.every(id => Boolean(id && getAbility(id)))).toBe(true);
      expect(new Set(loadout.skillSlots).size).toBe(4);
      expect(loadout.skillSlots).not.toContain(loadout.primary);
      expect(loadout.skillSlots).not.toContain(loadout.secondary);
      expect(getAbility(loadout.primary)).toBeDefined();
      expect(getAbility(loadout.secondary)).toBeDefined();
    }
    expect(CLASS_ABILITY_LOADOUT.RANGER.primary).toBe('ranger_shortbow');
    expect(CLASS_ABILITY_LOADOUT.CLERIC.secondary).toBe('cleric_holy_bolt');
    expect(CLASS_ABILITY_LOADOUT.MONK.primary).toBe('monk_palm_strike');
    expect(CLASS_ABILITY_LOADOUT.NECROMANCER.primary).toBe('necromancer_bone_shard');
    expect(Object.keys(ABILITY_REGISTRY).length).toBeGreaterThan(40);
  });

  it('migrates the four former single-skill kits without changing their stable starter ranks', () => {
    const starters = {
      RANGER: 'ranger_volley', CLERIC: 'cleric_restoration', MONK: 'monk_flying_kick', NECROMANCER: 'necromancer_corpse_burst',
    } as const;
    for (const [classId, starter] of Object.entries(starters) as Array<[keyof typeof starters, string]>) {
      const legacy = createPlayerCharacter(classId);
      const migrated = normalizeSkillProgression({
        ...legacy,
        stats: { ...legacy.stats, level: 4 },
        skills: [{ abilityId: starter, rank: 1 }],
        skillProgressionVersion: undefined,
        skillPoints: undefined,
        classPassiveState: undefined,
      });
      expect(migrated.skills).toEqual([{ abilityId: starter, rank: 1 }]);
      expect(migrated.skillPoints).toBe(3);
      expect(createClassPassiveState(classId)).toBeDefined();
    }
  });

  it('keeps rank scaling bounded while preserving mana cost and cooldown', () => {
    const player = createPlayerCharacter('RANGER');
    const base = getAbility('ranger_hunters_snare')!;
    const rankOne = getRankedAbility({ ...player, skills: [{ abilityId: base.id, rank: 1 }] }, base.id)!;
    const rankFive = getRankedAbility({ ...player, skills: [{ abilityId: base.id, rank: 99 }] }, base.id)!;
    expect(rankFive.damage).toBeGreaterThan(rankOne.damage);
    expect(rankFive.radius).toBeGreaterThan(rankOne.radius!);
    expect(rankFive.onHitStatus?.magnitude).toBeLessThanOrEqual(100);
    expect(rankFive.manaCost).toBe(base.manaCost);
    expect(rankFive.cooldownSeconds).toBe(base.cooldownSeconds);
    const combat = new PlayerCombat();
    const started = combat.start(player, base.id);
    expect(started.error).toBeUndefined();
    expect(player.stats.mp - started.player.stats.mp).toBe(base.manaCost);
    expect(combat.getCooldown(base.id)).toBe(base.cooldownSeconds);
  });
});

describe('R5B projectile, status, and class passive rules', () => {
  it('caps piercing at the first target plus the configured additional targets', () => {
    const map = openMap();
    const enemies = [makeEnemy('one', 2.6), makeEnemy('two', 3.3), makeEnemy('three', 4), makeEnemy('four', 4.7)];
    const projectile = {
      id: 1, position: { x: 1.5, y: 0.72, z: 1.5 }, velocity: { x: 50, y: 0, z: 0 }, radius: 0.1,
      damage: 25, remainingSeconds: 1, sourceAbilityId: 'ranger_piercing_hunt', color: '#d5b77a', faction: 'PLAYER' as const,
      pierceRemaining: 2, hitEnemyIds: [],
    };
    const result = updateProjectiles([projectile], enemies, map, 0.05);
    expect(result.impacts.filter(impact => impact.kind === 'enemy').map(impact => impact.enemyId)).toEqual(['one', 'two', 'three']);
    expect(result.enemies.slice(0, 3).every(target => target.health < target.maxHealth)).toBe(true);
    expect(result.enemies[3].health).toBe(result.enemies[3].maxHealth);
    expect(result.projectiles).toHaveLength(0);
  });

  it('applies a reduced boss curse, refreshes rather than stacks, and increases damage against marked targets', () => {
    const curse = getAbility('necromancer_shade_mark')!.onHitStatus!;
    const boss = makeEnemy('boss', 2.6, 1.5, { isBoss: true, health: 1000, maxHealth: 1000 });
    const map = openMap();
    const projectile = {
      id: 1, position: { x: 1.5, y: 0.72, z: 1.5 }, velocity: { x: 24, y: 0, z: 0 }, radius: 0.14,
      damage: 1, remainingSeconds: 1, sourceAbilityId: 'necromancer_shade_mark', color: '#72506f', faction: 'PLAYER' as const,
      statusEffect: curse,
    };
    const impact = updateProjectiles([projectile], [boss], map, 0.05);
    expect(impact.enemies[0].statusEffects?.find(status => status.statusId === 'CURSE')?.magnitude).toBeCloseTo(0.1);
    const refreshed = applyRealtimeStatus(impact.enemies[0].statusEffects, { ...curse, magnitude: 0.05, durationSeconds: 2 }, 'refresh');
    expect(refreshed.filter(status => status.statusId === 'CURSE')).toHaveLength(1);
    expect(refreshed.find(status => status.statusId === 'CURSE')?.magnitude).toBeCloseTo(0.1);

    const normal = makeEnemy('normal', 2.6, 1.5, { health: 1000, maxHealth: 1000 });
    const marked = { ...normal, statusEffects: applyRealtimeStatus([], curse, 'shade_mark') };
    const ordinary = applyEnemyDamage(normal, 20).enemy.health;
    const cursed = applyEnemyDamage(marked, 20).enemy.health;
    expect(ordinary - cursed).toBeGreaterThan(0);
    const blast = resolveAreaAttack(map, 2.6, 1.5, 1, [marked], 20, { statusId: 'CURSE', multiplier: 1.35 });
    expect(1000 - blast.enemies[0].health).toBeGreaterThan(ordinary - cursed);
  });

  it('applies curse vulnerability to timed damage as well as direct hits', () => {
    const ordinary = prepareRuntime('NECROMANCER', ['necromancer_corpse_burst', 'necromancer_shade_mark', 'necromancer_death_burst', 'necromancer_soul_ward']);
    ordinary.enemies = [makeEnemy('ordinary-dot', 4, 1.5, { statusEffects: applyRealtimeStatus([], { statusId: 'BURN', durationSeconds: 2, magnitude: 10 }, 'test') })];
    const cursed = prepareRuntime('NECROMANCER', ['necromancer_corpse_burst', 'necromancer_shade_mark', 'necromancer_death_burst', 'necromancer_soul_ward']);
    let cursedStatuses = applyRealtimeStatus([], { statusId: 'BURN', durationSeconds: 2, magnitude: 10 }, 'test');
    cursedStatuses = applyRealtimeStatus(cursedStatuses, { statusId: 'CURSE', durationSeconds: 2, magnitude: 0.2 }, 'test');
    cursed.enemies = [makeEnemy('cursed-dot', 4, 1.5, { statusEffects: cursedStatuses })];
    advance(ordinary, 24);
    advance(cursed, 24);
    const ordinaryDamage = 500 - ordinary.enemies[0].health;
    const cursedDamage = 500 - cursed.enemies[0].health;
    expect(ordinaryDamage).toBeGreaterThanOrEqual(10);
    expect(cursedDamage).toBeGreaterThan(ordinaryDamage);
  });

  it('cleanses at most one allowed ailment and leaves stagger and unrelated state intact', () => {
    const statuses = [
      { id: 'stagger', statusId: 'STAGGER', durationSeconds: 1, magnitude: 1 },
      { id: 'burn', statusId: 'BURN', durationSeconds: 3, magnitude: 2, tickRemainingSeconds: 1 },
      { id: 'poison', statusId: 'POISON', durationSeconds: 3, magnitude: 2, tickRemainingSeconds: 1 },
    ];
    const result = cleanseRealtimeStatuses(statuses, ['POISON', 'BURN', 'BLEED', 'SLOW', 'WEAKNESS'], 1);
    expect(result.removed).toHaveLength(1);
    expect(['BURN', 'POISON']).toContain(result.removed[0]);
    expect(result.statuses.some(status => status.statusId === 'STAGGER')).toBe(true);
    expect(result.statuses.filter(status => status.statusId === 'BURN' || status.statusId === 'POISON')).toHaveLength(1);
  });

  it('ticks regeneration once per second and caps haste, slow, and precision modifiers', () => {
    let statuses = applyRealtimeStatus([], { statusId: 'REGEN', durationSeconds: 5, magnitude: 5 }, 'renewal');
    statuses = applyRealtimeStatus(statuses, { statusId: 'REGEN', durationSeconds: 5, magnitude: 3 }, 'refresh');
    expect(statuses).toHaveLength(1);
    let healing = 0;
    for (let index = 0; index < 21; index += 1) {
      const tick = tickRealtimeStatuses(statuses, 0.05);
      statuses = tick.statuses;
      healing += tick.healing;
    }
    expect(healing).toBe(5);
    const speed = [
      { id: 'slow', statusId: 'SLOW', durationSeconds: 2, magnitude: 0.28 },
      { id: 'haste', statusId: 'HASTE', durationSeconds: 2, magnitude: 0.2 },
    ];
    expect(movementSpeedMultiplier(speed)).toBeCloseTo(0.72 * 1.2);
    expect(actionSpeedMultiplier(speed)).toBeCloseTo(1.2);
  });

  it('builds and spends Marked Prey focus on the same aimed target only', () => {
    let hunter = createPlayerCharacter('RANGER');
    for (let index = 0; index < 3; index += 1) hunter = recordMarkedPreyHit(hunter, 'target-a');
    const ability = getAbility('ranger_piercing_hunt')!;
    const wrongTarget = resolveClassPassiveAction(hunter, ability, [makeEnemy('target-b', 3)]);
    expect(wrongTarget.damageMultiplier).toBe(1);
    expect(wrongTarget.state).toMatchObject({ passiveId: 'marked_prey', targetId: 'target-a', stacks: 3 });
    const correctTarget = resolveClassPassiveAction(hunter, ability, [makeEnemy('target-a', 3)]);
    expect(correctTarget.damageMultiplier).toBeCloseTo(1.18);
    expect(correctTarget.state).toMatchObject({ passiveId: 'marked_prey', targetId: null, stacks: 0 });
  });

  it('opens Measured Remedy only on crossing half health and respects its cooldown', () => {
    let cleric = createPlayerCharacter('CLERIC');
    cleric = recordClassHealing(cleric, 40, 50, 100);
    expect(cleric.statusEffects.some(status => status.statusId === 'GUARD' && status.magnitude === 0.22)).toBe(true);
    expect(cleric.classPassiveState).toMatchObject({ passiveId: 'measured_remedy', cooldownRemaining: 10 });
    const noRefresh = recordClassHealing(cleric, 40, 55, 100);
    expect(noRefresh.classPassiveState).toMatchObject({ passiveId: 'measured_remedy', cooldownRemaining: 10 });
    let state = cleric.classPassiveState;
    for (let index = 0; index < 200; index += 1) state = tickClassPassiveState(state, 0.05);
    expect(state).toMatchObject({ passiveId: 'measured_remedy', cooldownRemaining: 0 });
  });

  it('bounds Flow State to five stacks, one stack per action, and expires on a lull', () => {
    let pankratiast = createPlayerCharacter('MONK');
    const strike = getAbility('monk_palm_strike')!;
    for (let index = 0; index < 8; index += 1) pankratiast = recordClassMeleeAction(pankratiast, strike);
    expect(pankratiast.classPassiveState).toMatchObject({ passiveId: 'flow_state', stacks: 5, remainingSeconds: 1.6 });
    expect(resolveClassPassiveAction(pankratiast, strike, [makeEnemy('target', 2)]).damageMultiplier).toBeCloseTo(1.15);
    let state = pankratiast.classPassiveState;
    for (let index = 0; index < 33; index += 1) state = tickClassPassiveState(state, 0.05);
    expect(state).toMatchObject({ passiveId: 'flow_state', stacks: 0, remainingSeconds: 0 });
  });

  it('grants exactly one Soul Tribute charge per three rewarded kills and spends it on one spell', () => {
    let shadebinder = createPlayerCharacter('NECROMANCER');
    shadebinder = recordClassKill(shadebinder);
    shadebinder = recordClassKill(shadebinder);
    expect(shadebinder.classPassiveState).toMatchObject({ passiveId: 'soul_tribute', stacks: 2, charges: 0 });
    shadebinder = recordClassKill(shadebinder);
    shadebinder = recordClassKill(shadebinder);
    expect(shadebinder.classPassiveState).toMatchObject({ passiveId: 'soul_tribute', stacks: 0, charges: 1, remainingSeconds: 4, cooldownRemaining: 10 });
    const spell = getAbility('necromancer_death_burst')!;
    const powered = resolveClassPassiveAction(shadebinder, spell, []);
    expect(powered.damageMultiplier).toBeCloseTo(1.2);
    expect(powered.state).toMatchObject({ passiveId: 'soul_tribute', charges: 0, remainingSeconds: 0 });
    expect(resolveClassPassiveAction({ ...shadebinder, classPassiveState: powered.state }, spell, []).damageMultiplier).toBe(1);
  });
});

describe('R5B runtime actions and persistence', () => {
  it('aims Hunter’s Snare at a visible target and applies a short slow', () => {
    const runtime = prepareRuntime('RANGER', ['ranger_volley', 'ranger_piercing_hunt', 'ranger_hunters_snare', 'ranger_moonlit_pursuit']);
    runtime.enemies = [makeEnemy('snared', 3.5)];
    runtime.update(0.05, input({ skillPressed: true, skillSlot: 3 }));
    advance(runtime, 22);
    expect(runtime.enemies[0].health).toBeLessThan(500);
    expect(runtime.enemies[0].statusEffects?.some(status => status.statusId === 'SLOW' && status.magnitude > 0)).toBe(true);
    expect(runtime.getSnapshot().skillCooldowns[2]).toBeGreaterThan(4);
  });

  it('requires a real window for Grappler’s Counter and interrupts a nearby windup', () => {
    const idle = prepareRuntime('MONK', ['monk_flying_kick', 'monk_twin_palm', 'monk_grapplers_counter', 'monk_champions_rush']);
    idle.update(0.05, input({ skillPressed: true, skillSlot: 3 }));
    advance(idle, 5);
    expect(idle.player.statusEffects.some(status => status.statusId === 'COUNTER')).toBe(false);

    const timed = prepareRuntime('MONK', ['monk_flying_kick', 'monk_twin_palm', 'monk_grapplers_counter', 'monk_champions_rush']);
    timed.enemies = [makeEnemy('windup', 2.5, 1.5, { state: 'ATTACK_WINDUP', stateTimer: 1 })];
    timed.update(0.05, input({ skillPressed: true, skillSlot: 3 }));
    advance(timed, 1);
    expect(timed.player.statusEffects.some(status => status.statusId === 'COUNTER')).toBe(true);
    expect(timed.player.statusEffects.some(status => status.statusId === 'GUARD')).toBe(true);
    expect(timed.enemies[0].state).toBe('STAGGER');
  });

  it('caps both direct Grace and Serpent’s Renewal healing at derived maximum health', () => {
    const cleric = prepareRuntime('CLERIC', ['cleric_restoration', 'cleric_serpents_renewal', 'cleric_purifying_rite', 'cleric_sacred_aegis']);
    const maximum = cleric.player.stats.maxHp;
    cleric.player = { ...cleric.player, stats: { ...cleric.player.stats, hp: maximum - 3 } };
    cleric.update(0.05, input({ skillPressed: true, skillSlot: 1 }));
    advance(cleric, 16);
    expect(cleric.player.stats.hp).toBe(maximum);

    cleric.player = { ...cleric.player, stats: { ...cleric.player.stats, hp: maximum - 1 } };
    cleric.update(0.05, input({ skillPressed: true, skillSlot: 2 }));
    advance(cleric, 120);
    expect(cleric.player.stats.hp).toBe(maximum);
    expect(cleric.player.statusEffects.some(status => status.statusId === 'REGEN')).toBe(false);
  });

  it('saves new skill, passive, and status fields without invalidating the run', () => {
    const runtime = new FPSGameRuntime('NECROMANCER');
    runtime.player = {
      ...runtime.player,
      stats: { ...runtime.player.stats, level: 6 },
      skills: [{ abilityId: 'necromancer_corpse_burst', rank: 2 }, { abilityId: 'necromancer_shade_mark', rank: 1 }],
      classPassiveState: { passiveId: 'soul_tribute', stacks: 2, remainingSeconds: 0, cooldownRemaining: 3, charges: 0 },
      statusEffects: applyRealtimeStatus([], { statusId: 'CURSE', durationSeconds: 3, magnitude: 0.2 }, 'test'),
    };
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(runtime.save(storage)).toBe(true);
    expect(values.has(MAZE_SAVE_KEY)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.player.skills).toEqual(runtime.player.skills);
    expect(loaded.save?.player.classPassiveState).toEqual(runtime.player.classPassiveState);
    expect(loaded.save?.player.statusEffects.some(status => status.statusId === 'CURSE')).toBe(true);
  });
});
