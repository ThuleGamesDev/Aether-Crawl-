import { describe, expect, it } from 'vitest';
import { ABILITY_REGISTRY, CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { calculateIncomingDamage, calculatePlayerDamage, getMeleeTargetIds, resolveChainAttack, resolveMeleeAttack } from '../combat/DamageSystem';
import { PlayerCombat } from '../player/PlayerCombat';
import { applySkillUpgrade, getClassSkillUnlockLevel, getRankedAbility, getSkillRank, getSkillUpgradeOptions, isClassSkillSlotUnlocked, normalizeSkillProgression } from '../player/SkillProgression';
import { createPlayerCharacter, grantExperience } from '../player/PlayerProgression';
import { recordClassBlock, recordClassDodge, recordClassMeleeAction, resolveClassPassiveAction, tickClassPassiveState } from '../player/ClassPassives';
import { applyRealtimeStatus } from '../combat/StatusSystem';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import type { InputFrame } from '../engine/InputSystem';
import { loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import { createDungeonWorld, createFloorEnemies } from '../world/DungeonWorld';
import { TileType, type PlayerCharacter, type WorldEnemy } from '../types';

const openMap = (size = 12): number[][] => Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => x === 0 || z === 0 || x === size - 1 || z === size - 1 ? TileType.WALL : TileType.EMPTY));
const enemy = (id: string, x: number, z = 1.5, overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id, definitionId: 'giant_rat', name: 'Cretan Cave Rat', visualId: 'giant_rat', position: { x, y: 0, z }, collisionRadius: 0.24,
  health: 500, maxHealth: 500, damage: 20, xpReward: 0, state: 'STAGGER', stateTimer: 8, attackCooldown: 8,
  attackRange: 1.2, attackTelegraphSeconds: 0.5, rewardGranted: false, isBoss: false, attackSetId: 'rat',
  statusEffects: [], facingYaw: Math.PI, ...overrides,
});
const emptyInput = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
});

describe('FPS-R5A class skill kits', () => {
  it('registers four stable, usable active skill slots for each R5A class', () => {
    for (const classId of ['BARBARIAN', 'PALADIN', 'SORCERER', 'ROGUE'] as const) {
      const loadout = CLASS_ABILITY_LOADOUT[classId];
      expect(loadout.skillSlots).toHaveLength(4);
      expect(loadout.skillSlots.every(id => Boolean(id && getAbility(id)))).toBe(true);
      expect(new Set(loadout.skillSlots).size).toBe(4);
      expect(getAbility(loadout.primary)).toBeDefined();
      expect(getAbility(loadout.secondary)).toBeDefined();
    }
    expect(CLASS_ABILITY_LOADOUT.BARBARIAN.secondary).toBe('barbarian_heavy_strike');
    expect(CLASS_ABILITY_LOADOUT.PALADIN.secondary).toBe('paladin_smite');
    expect(CLASS_ABILITY_LOADOUT.SORCERER.secondary).toBe('sorcerer_charged_bolt');
    expect(CLASS_ABILITY_LOADOUT.ROGUE.secondary).toBe('rogue_shadow_strike');
    expect(Object.keys(ABILITY_REGISTRY).length).toBeGreaterThan(30);
  });

  it('keeps costs and cooldowns fixed while Rank 1–5 improves bounded power and geometry', () => {
    const player = createPlayerCharacter('SORCERER');
    const abilityId = 'sorcerer_storm_invocation';
    const base = getAbility(abilityId)!;
    const rank1 = getRankedAbility({ ...player, skills: [{ abilityId, rank: 1 }] }, abilityId)!;
    const rank5 = getRankedAbility({ ...player, skills: [{ abilityId, rank: 5 }] }, abilityId)!;
    expect(rank5.damage).toBeGreaterThan(rank1.damage);
    expect(rank5.radius).toBeGreaterThan(rank1.radius!);
    expect(rank5.manaCost).toBe(base.manaCost);
    expect(rank5.cooldownSeconds).toBe(base.cooldownSeconds);
    expect(getRankedAbility({ ...player, skills: [{ abilityId, rank: 999 }] }, abilityId)!.damage).toBe(rank5.damage);

    const combat = new PlayerCombat();
    const started = combat.start(player, abilityId);
    expect(started.error).toBeUndefined();
    expect(player.stats.mp - started.player.stats.mp).toBeCloseTo(base.manaCost);
    expect(combat.getCooldown(abilityId)).toBeGreaterThan(0);
  });

  it('migrates existing levels into retained skill points and enforces unlock levels', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const legacy: PlayerCharacter = { ...player, stats: { ...player.stats, level: 4 }, skillProgressionVersion: undefined, skillPoints: undefined, classPassiveState: undefined };
    const migrated = normalizeSkillProgression(legacy);
    expect(migrated.skillPoints).toBe(3);
    expect(getSkillRank(migrated, 'barbarian_ground_slam')).toBe(1);
    expect(getClassSkillUnlockLevel('BARBARIAN', 4)).toBe(6);
    expect(isClassSkillSlotUnlocked(migrated, 1)).toBe(true);
    expect(isClassSkillSlotUnlocked(migrated, 4)).toBe(false);
    expect(getSkillUpgradeOptions(migrated).some(option => option.abilityId === 'barbarian_bronze_cyclone')).toBe(true);
    const spent = applySkillUpgrade(migrated, 'barbarian_bronze_cyclone')!;
    expect(spent.skillPoints).toBe(2);
    expect(getSkillRank(spent, 'barbarian_bronze_cyclone')).toBe(1);

    const invalid = normalizeSkillProgression({ ...migrated, skills: [{ abilityId: 'unknown_skill', rank: 5 }, { abilityId: 'barbarian_ground_slam', rank: 99 }] });
    expect(invalid.skills).toEqual([{ abilityId: 'barbarian_ground_slam', rank: 1 }]);
    const premature = normalizeSkillProgression({ ...migrated, skills: [{ abilityId: 'barbarian_heroic_execution', rank: 1 }] });
    expect(premature.skills).toEqual([{ abilityId: 'barbarian_ground_slam', rank: 1 }]);
  });

  it('grants one bounded point per level and leaves the four other class kits alone', () => {
    let myrmidon = createPlayerCharacter('BARBARIAN');
    const result = grantExperience(myrmidon, 100);
    myrmidon = result.player;
    expect(result.levelsGained).toBe(2);
    expect(myrmidon.skillPoints).toBe(2);
    for (const classId of ['RANGER', 'CLERIC', 'MONK', 'NECROMANCER'] as const) {
      const untouched = grantExperience(createPlayerCharacter(classId), 100).player;
      expect(untouched.skillPoints).toBe(0);
      expect(untouched.skills).toHaveLength(1);
    }
  });

  it('builds War Momentum once per melee action and expires its capped stacks', () => {
    let player = createPlayerCharacter('BARBARIAN');
    const cleave = getAbility('barbarian_cleave')!;
    for (let index = 0; index < 7; index += 1) player = recordClassMeleeAction(player, cleave);
    expect(player.classPassiveState).toMatchObject({ passiveId: 'war_momentum', stacks: 5 });
    expect(resolveClassPassiveAction(player, cleave, [enemy('target', 2.1)]).damageMultiplier).toBeCloseTo(1.2);
    let state = player.classPassiveState;
    for (let index = 0; index < 61; index += 1) state = tickClassPassiveState(state, 0.05);
    expect(state).toMatchObject({ passiveId: 'war_momentum', stacks: 0, remainingSeconds: 0 });
    const rogue = createPlayerCharacter('ROGUE');
    expect(recordClassMeleeAction(rogue, getAbility('rogue_quick_stab')!).classPassiveState).toMatchObject({ passiveId: 'opportunist', stacks: 0 });
  });

  it('opens a one-hit Hoplite counter window only after a block cooldown is ready', () => {
    const blocked = recordClassBlock(createPlayerCharacter('PALADIN'));
    expect(blocked.activated).toBe(true);
    const result = resolveClassPassiveAction(blocked.player, getAbility('paladin_arming_sword')!, [enemy('target', 2.1)]);
    expect(result.damageMultiplier).toBeCloseTo(1.18);
    expect(result.state).toMatchObject({ passiveId: 'unbroken_line', charges: 0 });
    const cooldownState = recordClassBlock({ ...blocked.player, classPassiveState: { passiveId: 'unbroken_line', stacks: 0, remainingSeconds: 2, cooldownRemaining: 2, charges: 1 } });
    expect(cooldownState.activated).toBe(false);
  });

  it('alternates Oracle spell schools and gives Trickster only one capped opportunity', () => {
    const oracle = createPlayerCharacter('SORCERER');
    const fire = getAbility('sorcerer_fireburst')!;
    const storm = getAbility('sorcerer_storm_invocation')!;
    const first = resolveClassPassiveAction(oracle, fire, []);
    const alternating = resolveClassPassiveAction({ ...oracle, classPassiveState: first.state }, storm, []);
    const repeated = resolveClassPassiveAction({ ...oracle, classPassiveState: alternating.state }, storm, []);
    expect(first.state).toMatchObject({ passiveId: 'omen_weaving', lastSchool: 'FIRE' });
    expect(alternating.damageMultiplier).toBeCloseTo(1.18);
    expect(repeated.damageMultiplier).toBe(1);

    const rogue = recordClassDodge(createPlayerCharacter('ROGUE'));
    const flurry = getAbility('rogue_kopis_flurry')!;
    const opportunity = resolveClassPassiveAction(rogue, flurry, [enemy('staggered', 2.1)]);
    const noRepeat = resolveClassPassiveAction({ ...rogue, classPassiveState: opportunity.state }, flurry, [enemy('staggered', 2.1)]);
    expect(opportunity.damageMultiplier).toBeCloseTo(1.22);
    expect(opportunity.state).toMatchObject({ passiveId: 'opportunist', charges: 0, cooldownRemaining: 2 });
    expect(noRepeat.damageMultiplier).toBe(1);
  });

  it('applies Blood Oath risk and reward through shared incoming and outgoing damage', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const ability = getAbility('barbarian_cleave')!;
    const attacker = enemy('attacker', 2.1, 1.5, { damage: 24 });
    const oath = { ...player, statusEffects: applyRealtimeStatus([], { statusId: 'BLOOD_OATH', durationSeconds: 6, magnitude: 0.25 }, ability.id) };
    expect(calculatePlayerDamage(oath, ability, 1, 1)).toBeGreaterThan(calculatePlayerDamage(player, ability, 1, 1));
    expect(calculateIncomingDamage(attacker, oath)).toBeGreaterThan(calculateIncomingDamage(attacker, player));
  });

  it('respects melee range and line of sight, and boosts Heroic Execution below its threshold', () => {
    const map = openMap();
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    player.rotation.yaw = 0;
    const execution = getAbility('barbarian_heroic_execution')!;
    const low = enemy('low', 2.2, 1.5, { health: 30, maxHealth: 100 });
    const healthy = enemy('healthy', 2.2, 1.5, { health: 50, maxHealth: 100 });
    const lowHit = resolveMeleeAttack(map, player, [low], execution, 10).enemies[0];
    const healthyHit = resolveMeleeAttack(map, player, [healthy], execution, 10).enemies[0];
    expect(lowHit.health).toBe(14);
    expect(healthyHit.health).toBe(40);
    expect(getMeleeTargetIds(map, player, [low], execution)).toEqual([low.id]);
    map[1][2] = TileType.WALL;
    expect(getMeleeTargetIds(map, player, [low], execution)).toEqual([]);
  });

  it('caps Storm Invocation chain jumps and stops lightning at walls', () => {
    const map = openMap();
    const first = enemy('first', 2.1);
    const second = enemy('second', 3.35);
    const third = enemy('third', 4.5);
    const fourth = enemy('fourth', 5.6);
    const maxJumps = getAbility('sorcerer_storm_invocation')?.chain?.maxJumps ?? 0;
    const result = resolveChainAttack(map, [first, second, third, fourth], [first.id], maxJumps, 2, 12);
    expect(maxJumps).toBe(2);
    expect(result.hitEnemyIds).toHaveLength(2);
    expect(result.hitEnemyIds).toEqual(['second', 'third']);
    expect(result.links).toHaveLength(2);
    map[1][3] = TileType.WALL;
    const blocked = resolveChainAttack(map, [first, second, third], [first.id], 2, 2, 12);
    expect(blocked.hitEnemyIds).toHaveLength(0);
  });

  it('records each multi-hit window once across a save and restore', () => {
    const player = createPlayerCharacter('ROGUE');
    const combat = new PlayerCombat();
    expect(combat.start(player, 'rogue_kopis_flurry').error).toBeUndefined();
    combat.update(0.05);
    combat.update(0.05);
    expect(combat.update(0.05).activeHitIndices).toEqual([0]);
    const restored = new PlayerCombat();
    restored.restore(combat.snapshot());
    const laterHits: number[] = [];
    for (let index = 0; index < 12; index += 1) laterHits.push(...restored.update(0.05).activeHitIndices);
    expect(laterHits).toEqual([1, 2]);
  });

  it('applies Venomous Cut to a real in-range enemy and collision-checks Shadow Lunge', () => {
    const runtime = new FPSGameRuntime('ROGUE');
    runtime.world = { ...runtime.world, map: openMap() };
    runtime.player = {
      ...grantExperience(runtime.player, 180).player,
      position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 },
      skills: [{ abilityId: 'rogue_knife_fan', rank: 1 }, { abilityId: 'rogue_venomous_cut', rank: 1 }],
    };
    runtime.enemies = [enemy('venom_target', 2.2)];
    runtime.update(0.05, emptyInput({ skillPressed: true, skillSlot: 3 }));
    runtime.update(0.05, emptyInput());
    runtime.update(0.05, emptyInput());
    expect(runtime.enemies[0].health).toBeLessThan(500);
    expect(runtime.enemies[0].statusEffects?.some(status => status.statusId === 'POISON')).toBe(true);

    const lunge = new FPSGameRuntime('ROGUE');
    const blockedMap = openMap();
    blockedMap[1][2] = TileType.WALL;
    lunge.world = { ...lunge.world, map: blockedMap };
    lunge.player = {
      ...grantExperience(lunge.player, 400).player,
      position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 },
      skills: [{ abilityId: 'rogue_knife_fan', rank: 1 }, { abilityId: 'rogue_kopis_flurry', rank: 1 }, { abilityId: 'rogue_venomous_cut', rank: 1 }, { abilityId: 'rogue_shadow_lunge', rank: 1 }],
    };
    lunge.enemies = [];
    for (let index = 0; index < 3; index += 1) lunge.update(0.05, emptyInput({ skillPressed: index === 0, skillSlot: index === 0 ? 4 : null }));
    expect(lunge.player.position.x).toBeLessThan(1.83);
  });

  it('pauses level-up choices, keeps deferred points, and saves learned ranks and passives', () => {
    const runtime = new FPSGameRuntime('PALADIN');
    runtime.player = {
      ...grantExperience(runtime.player, 40).player,
      classPassiveState: { passiveId: 'unbroken_line', stacks: 0, remainingSeconds: 2, cooldownRemaining: 3, charges: 1 },
    };
    runtime.openSkillUpgradeScreen();
    expect(runtime.getSnapshot().levelUpOpen).toBe(true);
    const start = { ...runtime.player.position };
    runtime.update(0.05, emptyInput({ movement: { forward: 1, strafe: 0, turn: 0 } }));
    expect(runtime.player.position).toEqual(start);
    runtime.deferSkillUpgrade();
    expect(runtime.player.skillPoints).toBe(1);
    expect(runtime.getSnapshot().levelUpOpen).toBe(false);
    runtime.openSkillUpgradeScreen();
    expect(runtime.chooseSkillUpgrade('paladin_dory_impale')).toBe(true);
    expect(runtime.player.skillPoints).toBe(0);
    expect(runtime.player.skills.some(skill => skill.abilityId === 'paladin_dory_impale' && skill.rank === 1)).toBe(true);

    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(runtime.save(storage)).toBe(true);
    expect(values.has(MAZE_SAVE_KEY)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.player.skills.some(skill => skill.abilityId === 'paladin_dory_impale' && skill.rank === 1)).toBe(true);
    expect(loaded.save?.player.classPassiveState).toMatchObject({ passiveId: 'unbroken_line' });
    expect(new FPSGameRuntime('PALADIN', loaded.save!).player.skillPoints).toBe(0);
  });

  it('preserves R4B save progress and normalizes passive state on load', () => {
    const world = createDungeonWorld(1, 77881);
    const player = createPlayerCharacter('SORCERER');
    const legacy: PlayerCharacter = { ...player, stats: { ...player.stats, level: 3 }, skillProgressionVersion: undefined, skillPoints: undefined, classPassiveState: undefined };
    const runtime = new FPSGameRuntime('SORCERER', { player: legacy, world, enemies: createFloorEnemies(world), loot: [], combat: { cooldowns: {}, action: null } });
    expect(runtime.player.skillPoints).toBe(2);
    expect(runtime.player.skills).toEqual([{ abilityId: 'sorcerer_fireburst', rank: 1 }]);
    expect(runtime.player.classPassiveState).toMatchObject({ passiveId: 'omen_weaving', lastSchool: null });
    expect(runtime.getSnapshot().levelUpOpen).toBe(true);
  });
});
