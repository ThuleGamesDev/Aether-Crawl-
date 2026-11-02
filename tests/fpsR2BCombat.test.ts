import { describe, expect, it } from 'vitest';
import { getAbility } from '../combat/AbilityRegistry';
import { applyEnemyDamage, calculateIncomingDamage, calculatePlayerDamage, resolveMeleeAttack } from '../combat/DamageSystem';
import { updateProjectiles } from '../combat/ProjectileSystem';
import { applyRealtimeStatus, tickRealtimeStatuses } from '../combat/StatusSystem';
import { ENEMY_ATTACK_SETS, getEnemyAttackSet } from '../data/enemyAttacks';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import type { InputFrame } from '../engine/InputSystem';
import { createPlayerControllerState, updatePlayerController } from '../player/PlayerController';
import { createPlayerCharacter } from '../player/PlayerProgression';
import { loadMazeGame } from '../services/mazeSave';
import { createDungeonWorld, createFloorEnemies } from '../world/DungeonWorld';
import { TileType, type PlayerCharacter, type WorldEnemy, type WorldProjectile } from '../types';

const openMap = (size = 8): number[][] => Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => x === 0 || z === 0 || x === size - 1 || z === size - 1 ? TileType.WALL : TileType.EMPTY));
const enemy = (overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id: 'enemy_test', definitionId: 'giant_rat', name: 'Cretan Cave Rat', visualId: 'giant_rat',
  position: { x: 2.4, y: 0, z: 1.5 }, collisionRadius: 0.24,
  health: 30, maxHealth: 30, damage: 5, xpReward: 10, state: 'CHASE', stateTimer: 0,
  attackCooldown: 0, attackRange: 1.2, attackTelegraphSeconds: 0.5, rewardGranted: false,
  isBoss: false, ...overrides,
});
const emptyInput = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
});

describe('FPS-R2B combat foundations', () => {
  it('keeps Dory thrust narrow and allows a close broad Labrys swing', () => {
    const player = createPlayerCharacter('PALADIN', { x: 1.5, y: 0, z: 1.5 });
    const dory = getAbility('paladin_arming_sword')!;
    const sideEnemy = enemy({ position: { x: 2.2, y: 0, z: 2.05 } });
    expect(resolveMeleeAttack(openMap(), player, [sideEnemy], dory, 20).hitEnemyIds).toEqual([]);
    const myrmidon = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    expect(resolveMeleeAttack(openMap(), myrmidon, [sideEnemy], getAbility('barbarian_cleave')!, 20).hitEnemyIds).toEqual([sideEnemy.id]);
    expect(dory.range).toBeGreaterThan(getAbility('barbarian_cleave')!.range);
  });

  it('applies timed poison and burn ticks and expires each effect without turns', () => {
    let effects = applyRealtimeStatus([], { statusId: 'POISON', durationSeconds: 2, magnitude: 3 }, 'rat');
    let poisonDamage = 0;
    for (let index = 0; index < 4; index += 1) { const tick = tickRealtimeStatuses(effects, 0.25); effects = tick.statuses; poisonDamage += tick.damage; }
    expect(poisonDamage).toBe(3);
    let lastPoisonDamage = 0;
    for (let index = 0; index < 4; index += 1) { const tick = tickRealtimeStatuses(effects, 0.25); effects = tick.statuses; lastPoisonDamage += tick.damage; }
    expect(lastPoisonDamage).toBe(3);
    expect(effects).toHaveLength(0);
    effects = applyRealtimeStatus([], { statusId: 'BURN', durationSeconds: 1.2, magnitude: 2 }, 'oracle');
    let burnDamage = 0;
    for (let index = 0; index < 4; index += 1) { const tick = tickRealtimeStatuses(effects, 0.25); effects = tick.statuses; burnDamage += tick.damage; }
    expect(burnDamage).toBe(2);
  });

  it('blocks directional projectile paths at walls and consumes one projectile on its first enemy hit', () => {
    const map = openMap();
    const target = enemy({ position: { x: 2.1, y: 0, z: 1.5 } });
    const projectile: WorldProjectile = {
      id: 1, position: { x: 1.5, y: 0.72, z: 1.5 }, velocity: { x: 18, y: 0, z: 0 }, radius: 0.1,
      damage: 7, remainingSeconds: 1, sourceAbilityId: 'sorcerer_arcane_bolt', color: '#fff', faction: 'PLAYER',
      statusEffect: { statusId: 'BURN', durationSeconds: 2, magnitude: 2 },
    };
    const hit = updateProjectiles([projectile], [target], map, 0.05);
    expect(hit.projectiles).toHaveLength(0);
    expect(hit.impacts.filter(impact => impact.enemyId === target.id)).toHaveLength(1);
    expect(hit.enemies[0].health).toBe(23);
    expect(hit.enemies[0].statusEffects?.[0].statusId).toBe('BURN');
    expect(updateProjectiles(hit.projectiles, hit.enemies, map, 0.05).impacts).toHaveLength(0);

    map[1][2] = TileType.WALL;
    const behindWall = enemy({ position: { x: 3.2, y: 0, z: 1.5 } });
    const blocked = updateProjectiles([projectile], [behindWall], map, 0.05);
    expect(blocked.projectiles).toHaveLength(0);
    expect(blocked.enemies[0].health).toBe(behindWall.health);
    expect(blocked.impacts.some(impact => impact.enemyId)).toBe(false);
  });

  it('lets an Aspis reduce an incoming hit and lets a timed Guard reduce it further', () => {
    const player = createPlayerCharacter('PALADIN');
    const attacker = enemy({ damage: 24 });
    const open = calculateIncomingDamage(attacker, player);
    const blocked = calculateIncomingDamage(attacker, player, true);
    const guarded: PlayerCharacter = {
      ...player,
      statusEffects: applyRealtimeStatus([], { statusId: 'GUARD', durationSeconds: 1, magnitude: 0.4 }, 'shield'),
    };
    expect(blocked).toBeLessThan(open);
    expect(calculateIncomingDamage(attacker, guarded, true)).toBeLessThan(blocked);
  });

  it('gives the Myrmidon a timed perfect-dodge counter for its next melee strike', () => {
    const myrmidon = createPlayerCharacter('BARBARIAN');
    const cleave = getAbility('barbarian_cleave')!;
    const counter = { ...myrmidon, statusEffects: applyRealtimeStatus([], { statusId: 'COUNTER', durationSeconds: 1.2, magnitude: 0.3 }, 'perfect_dodge') };
    expect(calculateIncomingDamage(enemy(), myrmidon)).toBe(calculateIncomingDamage(enemy(), counter));
    expect(calculatePlayerDamage(counter, cleave)).toBeGreaterThan(calculatePlayerDamage(myrmidon, cleave));
    expect(calculatePlayerDamage(counter, getAbility('sorcerer_arcane_bolt')!)).toBe(calculatePlayerDamage(myrmidon, getAbility('sorcerer_arcane_bolt')!));
  });

  it('keeps dodge immediate, wall-safe, and unavailable during its cooldown', () => {
    const map = openMap();
    map[1][2] = TileType.WALL;
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const first = updatePlayerController(player, createPlayerControllerState(), emptyInput({ dodgePressed: true }), map, 0.05);
    expect(first.dodgeStarted).toBe(true);
    expect(first.player.position.x).toBeLessThan(1.85);
    const second = updatePlayerController(first.player, first.state, emptyInput({ dodgePressed: true }), map, 0.05);
    expect(second.dodgeStarted).toBe(false);
    expect(second.state.dodgeCooldown).toBeGreaterThan(0.9);

    const runtime = new FPSGameRuntime('BARBARIAN');
    runtime.world = { ...runtime.world, map: openMap() };
    runtime.enemies = [];
    runtime.player = { ...runtime.player, position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 } };
    runtime.update(0.05, emptyInput({ dodgePressed: true }));
    runtime.projectiles = [{ id: 90, position: { x: runtime.player.position.x + 0.46, y: 1.15, z: runtime.player.position.z }, velocity: { x: 0, y: 0, z: 0 }, radius: 0.2, damage: 10, remainingSeconds: 0.5, sourceAbilityId: 'test_incoming', color: '#9a70b7', faction: 'ENEMY', ownerEnemyId: 'test' }];
    runtime.update(0.05, emptyInput());
    expect(runtime.player.statusEffects.some(status => status.statusId === 'COUNTER' && status.durationSeconds > 0)).toBe(true);
  });

  it('gives the six pilot families distinct timed attack data and makes ranged enemies respect line of sight', () => {
    for (const id of ['rat', 'revenant', 'spider', 'bull_enforcer', 'acolyte', 'plunderer']) {
      const attacks = ENEMY_ATTACK_SETS[id];
      expect(attacks.length).toBeGreaterThanOrEqual(2);
      expect(new Set(attacks.map(attack => attack.id)).size).toBe(attacks.length);
      expect(attacks.every(attack => attack.windupSeconds > 0 && attack.recoverySeconds >= 0 && attack.cooldownSeconds > 0)).toBe(true);
    }
    const map = openMap();
    map[1][3] = TileType.WALL;
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const acolyte = enemy({
      id: 'acolyte', definitionId: 'dark_cultist', attackSetId: 'acolyte', behaviorRole: 'SUPPORT',
      position: { x: 4.5, y: 0, z: 1.5 }, attackCooldown: 0,
    });
    const result = updateEnemyBrains([acolyte], map, player, 0.05);
    expect(result.attacks).toHaveLength(0);
    expect(result.enemies[0].state).not.toBe('ATTACK_WINDUP');
  });

  it('interrupts a windup with Stagger, prevents dead enemies acting, and keeps AI timers bounded', () => {
    const map = openMap();
    const player = createPlayerCharacter('BARBARIAN', { x: 4.5, y: 0, z: 1.5 });
    const windup = enemy({
      attackSetId: 'rat', state: 'ATTACK_WINDUP', activeAttackId: 'rat_leap', stateTimer: 0.5,
      attackTelegraphSeconds: 0.72,
      statusEffects: applyRealtimeStatus([], { statusId: 'STAGGER', durationSeconds: 0.4, magnitude: 0.4 }, 'strike'),
    });
    const interrupted = updateEnemyBrains([windup], map, player, 0.05);
    expect(interrupted.enemies[0].state).toBe('STAGGER');
    expect(interrupted.attacks).toHaveLength(0);

    const corpse = enemy({ health: 0, state: 'DEAD', attackSetId: 'rat', activeAttackId: 'rat_bite' });
    expect(updateEnemyBrains([corpse], map, player, 0.05).attacks).toHaveLength(0);
    expect(applyEnemyDamage(corpse, 100).enemy.health).toBe(0);

    let movingEnemy = enemy({ attackSetId: 'rat', position: { x: 3, y: 0, z: 1.5 }, health: 1000, maxHealth: 1000 });
    let activeWindows = 0;
    for (let index = 0; index < 180; index += 1) {
      const update = updateEnemyBrains([movingEnemy], map, player, 0.05);
      movingEnemy = update.enemies[0];
      activeWindows += update.attacks.length;
      expect(Number.isFinite(movingEnemy.position.x) && Number.isFinite(movingEnemy.position.z)).toBe(true);
    }
    expect(activeWindows).toBeGreaterThan(0);
    expect(movingEnemy.state).not.toBe('DEAD');
    expect(Math.hypot(movingEnemy.position.x - player.position.x, movingEnemy.position.z - player.position.z)).toBeGreaterThanOrEqual((movingEnemy.collisionRadius ?? 0.2) + 0.23);
  });

  it('repositions mobile Plunderers and unlocks the Warden phase transition once without healing', () => {
    const player = createPlayerCharacter('BARBARIAN', { x: 4.5, y: 0, z: 1.5 });
    const plunderer = enemy({ attackSetId: 'plunderer', behaviorRole: 'SKIRMISHER', position: { x: 3, y: 0, z: 1.5 } });
    const retreat = updateEnemyBrains([plunderer], openMap(), player, 0.05).enemies[0];
    expect(retreat.state).toBe('RETREAT');
    expect(retreat.position.x).toBeLessThan(3);

    const runtime = new FPSGameRuntime('BARBARIAN');
    runtime.world = createDungeonWorld(5, 10101);
    runtime.enemies = createFloorEnemies(runtime.world);
    const warden = runtime.enemies.find(candidate => candidate.definitionId === 'guardian_threadbound_warden')!;
    const thresholdHealth = Math.floor(warden.maxHealth * 0.5);
    runtime.enemies = runtime.enemies.map(candidate => candidate.id === warden.id ? { ...candidate, health: thresholdHealth } : candidate);
    runtime.update(0.05, emptyInput());
    const phaseOneEvents = runtime.getRenderState().events.filter(event => event.kind === 'bossPhase');
    expect(runtime.enemies.find(candidate => candidate.id === warden.id)).toMatchObject({ health: thresholdHealth, phase: 2, phaseTransitioned: true });
    expect(phaseOneEvents).toHaveLength(1);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(runtime.save(storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    const resumed = new FPSGameRuntime('BARBARIAN', loaded.save!);
    expect(resumed.enemies.find(candidate => candidate.definitionId === 'guardian_threadbound_warden')).toMatchObject({ health: thresholdHealth, phase: 2, phaseTransitioned: true });
    resumed.update(0.05, emptyInput());
    expect(resumed.getRenderState().events.filter(event => event.kind === 'bossPhase')).toHaveLength(0);
    runtime.update(0.05, emptyInput());
    expect(runtime.getRenderState().events.filter(event => event.kind === 'bossPhase')).toHaveLength(0);
    expect(getEnemyAttackSet('threadbound_warden', 2).some(attack => attack.phase === 2)).toBe(true);
  });
});
