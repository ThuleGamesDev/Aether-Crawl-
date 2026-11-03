import { describe, expect, it } from 'vitest';
import { abilityTooltip, getAbility } from '../combat/AbilityRegistry';
import { enemyAttackContainsPoint, abilityPoiseDamage, abilityStaminaCost, applyEnemyPoiseDamage, getEnemyPoiseProfile, initializeEnemyPoise, STAMINA_RULES, tickEnemyPoise } from '../combat/CombatMastery';
import { ENEMY_ATTACK_SETS, isEnemyAttackParryable } from '../data/enemyAttacks';
import { getEnemyAttackTelegraphDescriptor } from '../data/enemyAttackTelegraph';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import type { InputFrame } from '../engine/InputSystem';
import { createPlayerControllerState, updatePlayerController } from '../player/PlayerController';
import { PlayerCombat } from '../player/PlayerCombat';
import { calculateDerivedStats } from '../player/DerivedStats';
import { applyEnemyDamage } from '../combat/DamageSystem';
import { createItemInstance, createPlayerCharacter } from '../player/PlayerProgression';
import { getItemBase } from '../data/itemBases';
import { isMazeRunSave, loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import type { PlayerCharacter, WorldEnemy } from '../types';
import { TileType } from '../types';
import { hasLineOfSight } from '../world/CollisionWorld';
import type { KeyValueStorage } from '../services/fpsSave';

const openMap = (size = 8): number[][] => Array.from({ length: size }, (_, z) => Array.from({ length: size }, (_, x) => x === 0 || z === 0 || x === size - 1 || z === size - 1 ? TileType.WALL : TileType.EMPTY));

const input = (overrides: Partial<InputFrame> = {}): InputFrame => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
});

const enemy = (overrides: Partial<WorldEnemy> = {}): WorldEnemy => ({
  id: 'r6c_enemy', definitionId: 'giant_rat', name: 'Cretan Cave Rat', visualId: 'giant_rat',
  position: { x: 2.5, y: 0, z: 1.5 }, collisionRadius: 0.24,
  health: 80, maxHealth: 80, damage: 12, xpReward: 10, state: 'CHASE', stateTimer: 0,
  attackCooldown: 0, attackRange: 1.2, attackTelegraphSeconds: 0.42, attackSetId: 'rat',
  rewardGranted: false, isBoss: false, ...overrides,
});

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('R6C combat mastery', () => {
  it('charges heavy attacks before cooldown, keeps class skills and spells usable at zero stamina, and shows the cost', () => {
    const heavy = getAbility('barbarian_heavy_strike')!;
    expect(abilityTooltip(heavy)).toContain('18 stamina');
    const player = createPlayerCharacter('BARBARIAN');
    const combat = new PlayerCombat();
    const tooTired = { ...player, stats: { ...player.stats, stamina: 20 } };
    const rejected = combat.start(tooTired, heavy.id);
    expect(rejected.error).toBe('Not enough stamina.');
    expect(combat.getCooldown(heavy.id)).toBe(0);
    expect(combat.action).toBeNull();

    const started = combat.start(player, heavy.id);
    expect(started.error).toBeUndefined();
    expect(started.player.stats.stamina).toBeCloseTo(78.8);

    const paladin = createPlayerCharacter('PALADIN');
    const zeroStaminaSkill = { ...paladin, stats: { ...paladin.stats, stamina: 0 } };
    expect(new PlayerCombat().start(zeroStaminaSkill, 'paladin_aspis_charge').error).toBeUndefined();
    const oracle = createPlayerCharacter('SORCERER');
    expect(new PlayerCombat().start({ ...oracle, stats: { ...oracle.stats, stamina: 0 } }, 'sorcerer_arcane_bolt').error).toBeUndefined();
  });

  it('keeps movement available when exhausted, cancels wall-blocked dodges, and times shield parry and guard stamina', () => {
    const map = openMap();
    map[1][2] = TileType.WALL;
    const tired = { ...createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 }), stats: { ...createPlayerCharacter('BARBARIAN').stats, stamina: 0 } };
    const failed = updatePlayerController(tired, createPlayerControllerState(), input({ dodgePressed: true, movement: { forward: 1, strafe: 0, turn: 0 } }), openMap(), 0.05);
    expect(failed.dodgeFailed).toBe(true);
    expect(failed.dodgeStarted).toBe(false);
    expect(failed.player.position.x).toBeGreaterThan(tired.position.x);

    const againstWall = { ...tired, position: { x: 1.82, y: 0, z: 1.5 }, stats: { ...tired.stats, stamina: 100 } };
    const blocked = updatePlayerController(againstWall, createPlayerControllerState(), input({ dodgePressed: true }), map, 0.05);
    expect(blocked.dodgeFailed).toBe(true);
    expect(blocked.dodgeStarted).toBe(false);
    expect(blocked.state.invulnerabilitySeconds).toBe(0);
    expect(blocked.player.stats.stamina).toBe(100);

    const hoplite = createPlayerCharacter('PALADIN');
    const parry = updatePlayerController(hoplite, createPlayerControllerState(), input({ parryPressed: true }), openMap(), 0.05);
    expect(parry.parryStarted).toBe(true);
    expect(parry.state.parryWindowSeconds).toBe(STAMINA_RULES.parryWindowSeconds);
    expect(parry.state.guarding).toBe(false);
    expect(parry.player.stats.stamina).toBe(82);

    const guard = updatePlayerController(hoplite, createPlayerControllerState(), input({ secondaryDown: true }), openMap(), 0.05);
    expect(guard.state.guarding).toBe(true);
    expect(guard.player.stats.stamina).toBeCloseTo(100 - STAMINA_RULES.shieldDrainPerSecond * 0.05);
    let exhaustedGuard = updatePlayerController({ ...hoplite, stats: { ...hoplite.stats, stamina: 0.2 } }, createPlayerControllerState(), input({ secondaryDown: true }), openMap(), 0.05);
    expect(exhaustedGuard.state.guardExhausted).toBe(true);
    for (let step = 0; step < 20; step += 1) exhaustedGuard = updatePlayerController(exhaustedGuard.player, exhaustedGuard.state, input({ secondaryDown: true }), openMap(), 0.05);
    expect(exhaustedGuard.state.guarding).toBe(false);
    expect(exhaustedGuard.player.stats.stamina).toBeGreaterThan(0);
    exhaustedGuard = updatePlayerController(exhaustedGuard.player, exhaustedGuard.state, input(), openMap(), 0.05);
    expect(exhaustedGuard.state.guardExhausted).toBe(false);
    const regenerated = updatePlayerController({ ...hoplite, stats: { ...hoplite.stats, stamina: 50, staminaRegenDelaySeconds: 0 } }, createPlayerControllerState(), input(), openMap(), 0.05);
    expect(regenerated.player.stats.stamina).toBeCloseTo(51.2);
  });

  it('uses the shared tell bounds for strike bounds and only marks explicit pilot attacks as parryable', () => {
    const slash = ENEMY_ATTACK_SETS.revenant.find(attack => attack.id === 'revenant_xiphos')!;
    const tell = getEnemyAttackTelegraphDescriptor(slash);
    expect(tell.radius).toBe(slash.range + 0.28);
    expect(enemyAttackContainsPoint(slash, { x: 2, y: 0, z: 2 }, 0, { x: 2 + tell.radius - 0.001, y: 0, z: 2 })).toBe(true);
    expect(enemyAttackContainsPoint(slash, { x: 2, y: 0, z: 2 }, 0, { x: 2 + tell.radius + 0.01, y: 0, z: 2 })).toBe(false);
    expect(enemyAttackContainsPoint(slash, { x: 2, y: 0, z: 2 }, 0, { x: 2, y: 0, z: 2 + 0.7 })).toBe(false);
    expect(isEnemyAttackParryable('rat', 'rat_bite')).toBe(true);
    expect(isEnemyAttackParryable('rat', 'rat_leap')).toBe(false);
    expect(isEnemyAttackParryable('bull_enforcer', 'enforcer_charge')).toBe(false);
    expect(isEnemyAttackParryable('gatekeeper', 'gatekeeper_sweep')).toBe(true);
    expect(isEnemyAttackParryable('acolyte', 'acolyte_underworld_bolt')).toBe(false);
  });

  it('resolves one deterministic windup at the authored strike time and preserves line of sight', () => {
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const map = openMap();
    const run = () => {
      let foes = [enemy({ state: 'CHASE', position: { x: 2.3, y: 0, z: 1.5 }, attackIndex: 0 })];
      const fired: string[] = [];
      const first = updateEnemyBrains(foes, map, player, 0.05);
      foes = first.enemies;
      expect(first.telegraphs).toEqual([foes[0].id]);
      expect(first.attacks).toEqual([]);
      expect(foes[0].activeAttackId).toBe('rat_bite');
      expect(foes[0].attackTelegraphSeconds).toBe(ENEMY_ATTACK_SETS.rat[0].windupSeconds);
      for (let step = 0; step < 8; step += 1) {
        const update = updateEnemyBrains(foes, map, player, 0.05);
        foes = update.enemies;
        fired.push(...update.attacks);
      }
      expect(fired).toEqual([]);
      const active = updateEnemyBrains(foes, map, player, 0.05);
      fired.push(...active.attacks);
      expect(active.enemies[0].state).toBe('ATTACK_ACTIVE');
      return fired;
    };
    expect(run()).toEqual([enemy().id]);
    expect(run()).toEqual(run());

    const wallMap = openMap();
    wallMap[1][3] = TileType.WALL;
    expect(hasLineOfSight(wallMap, 4.5, 1.5, 2.5, 1.5, 0.15)).toBe(false);
    const sweep = ENEMY_ATTACK_SETS.gatekeeper.find(attack => attack.id === 'gatekeeper_sweep')!;
    expect(enemyAttackContainsPoint(sweep, { x: 4.5, y: 0, z: 1.5 }, Math.PI, { x: 2.5, y: 0, z: 1.5 })).toBe(true);
  });

  it('breaks pilot poise once, applies recovery immunity, and increases two-hand impact without changing skill usability', () => {
    const rat = initializeEnemyPoise(enemy());
    expect(rat.maxPoise).toBe(38);
    const first = applyEnemyPoiseDamage(rat, 30);
    expect(first.broken).toBe(false);
    expect(first.enemy.poise).toBe(8);
    const broken = applyEnemyPoiseDamage(first.enemy, 12);
    expect(broken.broken).toBe(true);
    expect(broken.enemy.state).toBe('STAGGER');
    const immune = applyEnemyPoiseDamage(tickEnemyPoise(broken.enemy, 0.1), 100);
    expect(immune.broken).toBe(false);
    expect(immune.applied).toBe(0);
    const recovered = tickEnemyPoise({ ...broken.enemy, poiseBreakRecoverySeconds: 0, staggerImmunitySeconds: 0, poiseRecoveryDelaySeconds: 0 }, 0.1);
    expect(recovered.poise).toBeGreaterThan(0);

    const barbarian = createPlayerCharacter('BARBARIAN');
    const heavy = getAbility('barbarian_heavy_strike')!;
    expect(abilityStaminaCost(heavy, barbarian, 'mainHand')).toBeCloseTo(21.2);
    expect(abilityPoiseDamage(heavy, barbarian, 'mainHand')).toBeGreaterThan(abilityPoiseDamage(heavy, barbarian, 'offHand'));
    const kopis = createItemInstance({ ...getItemBase('kopis')!, quantity: 1 }, 'r6c_kopis');
    const dual = { ...barbarian, equipment: { ...barbarian.equipment, mainHand: kopis, offHand: { ...kopis, instanceId: 'r6c_kopis_off' } } };
    expect(abilityStaminaCost(heavy, dual, 'offHand')).toBeCloseTo(15.8);
    expect(abilityPoiseDamage(heavy, dual, 'offHand')).toBeLessThan(abilityPoiseDamage(heavy, barbarian, 'mainHand'));
    expect(calculateDerivedStats(barbarian).maxStamina).toBe(100);

    const started = new PlayerCombat().start(barbarian, heavy.id);
    const restore = new PlayerCombat();
    restore.restore(new PlayerCombat().snapshot());
    expect(started.player.stats.stamina).toBeLessThan(barbarian.stats.stamina!);
  });

  it('parries only shielded marked attacks, rewards only a real perfect dodge, and exposes offscreen windups', () => {
    const runtime = new FPSGameRuntime('PALADIN');
    const world = { ...runtime.world, map: openMap() };
    runtime.world = world;
    runtime.player = { ...createPlayerCharacter('PALADIN', { x: 1.5, y: 0, z: 1.5 }), rotation: { yaw: 0, pitch: 0 } };
    runtime.enemies = [enemy({ id: 'gatekeeper', definitionId: 'guardian_bronze_gatekeeper', name: 'Bronze Gatekeeper', attackSetId: 'gatekeeper', isBoss: true, state: 'ATTACK_WINDUP', stateTimer: 0.01, attackRange: 1.8, attackTelegraphSeconds: 0.72, activeAttackId: 'gatekeeper_shield_bash', facingYaw: Math.PI })];
    const hp = runtime.player.stats.hp;
    runtime.update(0.05, input({ parryPressed: true }));
    expect(runtime.player.stats.hp).toBe(hp);
    expect(runtime.enemies[0].poise).toBeLessThan(runtime.enemies[0].maxPoise!);
    expect(runtime.getSnapshot().parryWindowSeconds).toBe(0);

    const unmarkedRuntime = new FPSGameRuntime('PALADIN');
    unmarkedRuntime.world = { ...unmarkedRuntime.world, map: openMap() };
    unmarkedRuntime.player = { ...createPlayerCharacter('PALADIN', { x: 1.5, y: 0, z: 1.5 }), rotation: { yaw: 0, pitch: 0 } };
    unmarkedRuntime.enemies = [enemy({ id: 'enforcer', definitionId: 'bull_cult_enforcer', name: 'Bull-Cult Enforcer', attackSetId: 'bull_enforcer', state: 'ATTACK_WINDUP', stateTimer: 0.01, attackRange: 2.1, attackTelegraphSeconds: 0.8, activeAttackId: 'enforcer_heavy_cleave', facingYaw: Math.PI })];
    const unmarkedHp = unmarkedRuntime.player.stats.hp;
    unmarkedRuntime.update(0.05, input({ parryPressed: true }));
    expect(unmarkedRuntime.player.stats.hp).toBeLessThan(unmarkedHp);

    const dodgeRuntime = new FPSGameRuntime('BARBARIAN');
    dodgeRuntime.world = { ...dodgeRuntime.world, map: openMap() };
    dodgeRuntime.player = { ...createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 }), rotation: { yaw: 0, pitch: 0 } };
    dodgeRuntime.enemies = [enemy({ state: 'ATTACK_WINDUP', stateTimer: 0.01, activeAttackId: 'rat_bite', facingYaw: Math.PI })];
    dodgeRuntime.update(0.05, input({ dodgePressed: true }));
    expect(dodgeRuntime.player.statusEffects.some(status => status.statusId === 'COUNTER')).toBe(true);
    expect(dodgeRuntime.player.stats.hp).toBe(dodgeRuntime.player.stats.maxHp);

    const offscreen = enemy({ position: { x: 2.5, y: 0, z: 1.5 }, state: 'ATTACK_WINDUP', stateTimer: 0.4, activeAttackId: 'rat_bite' });
    dodgeRuntime.player = { ...dodgeRuntime.player, position: { x: 3.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 } };
    dodgeRuntime.enemies = [offscreen];
    expect(dodgeRuntime.getSnapshot().incomingAttacks[0]).toMatchObject({ name: 'Bite', direction: 'BEHIND', parryable: true });
  });

  it('restores optional v5 stamina and poise defaults and rejects out-of-range combat saves', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const stored = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as Record<string, any>;
    expect(isMazeRunSave(stored)).toBe(true);
    const legacyV5 = structuredClone(stored);
    delete legacyV5.player.stats.baseMaxStamina;
    delete legacyV5.player.stats.stamina;
    delete legacyV5.player.stats.staminaRegenDelaySeconds;
    for (const foe of legacyV5.enemies) {
      delete foe.poise;
      delete foe.maxPoise;
      delete foe.poiseRecoveryDelaySeconds;
      delete foe.poiseBreakRecoverySeconds;
      delete foe.staggerImmunitySeconds;
      delete foe.phaseTransitionLockSeconds;
    }
    expect(isMazeRunSave(legacyV5)).toBe(true);
    const loaded = new FPSGameRuntime('BARBARIAN', legacyV5 as any);
    expect(loaded.player.stats.stamina).toBe(calculateDerivedStats(loaded.player).maxStamina);
    expect(loaded.enemies.find(foe => foe.attackSetId === 'rat')?.poise).toBe(38);
    expect(isMazeRunSave({ ...stored, player: { ...stored.player, stats: { ...stored.player.stats, stamina: -1 } } })).toBe(false);
    const badEnemy = stored.enemies.find((foe: WorldEnemy) => getEnemyPoiseProfile(foe));
    if (badEnemy) {
      badEnemy.poise = badEnemy.maxPoise + 1;
      expect(isMazeRunSave(stored)).toBe(false);
    }
  });

  it('locks a transitioning boss out of stagger and does not replay a saved active strike', () => {
    const phaseRuntime = new FPSGameRuntime('BARBARIAN');
    phaseRuntime.world = { ...phaseRuntime.world, map: openMap() };
    const warden = enemy({ id: 'warden', definitionId: 'guardian_threadbound_warden', name: 'Threadbound Warden', attackSetId: 'threadbound_warden', isBoss: true, health: 40, maxHealth: 100, position: { x: 3.5, y: 0, z: 1.5 }, state: 'IDLE' });
    phaseRuntime.enemies = [warden];
    phaseRuntime.update(0.05, input());
    const transitioned = phaseRuntime.enemies[0];
    expect(transitioned.phase).toBe(2);
    expect(transitioned.phaseTransitioned).toBe(true);
    expect(transitioned.phaseTransitionLockSeconds).toBe(0.72);
    const damaged = applyEnemyDamage(transitioned, 10).enemy;
    expect(damaged.state).toBe('RECOVER');
    const duringLock = updateEnemyBrains([damaged], phaseRuntime.world.map, phaseRuntime.player, 0.05);
    expect(duringLock.attacks).toEqual([]);
    expect(duringLock.enemies[0].state).toBe('RECOVER');

    const runtime = new FPSGameRuntime('BARBARIAN');
    const storage = new MemoryStorage();
    const guardianId = runtime.world.floor.guardianId;
    const guardian = runtime.enemies.find(foe => foe.definitionId === guardianId)!;
    runtime.enemies = runtime.enemies.map(foe => foe.id === guardian.id
      ? { ...foe, state: 'ATTACK_ACTIVE', stateTimer: 0.08, attackSetId: 'gatekeeper', activeAttackId: 'gatekeeper_shield_bash', attackTelegraphSeconds: 0.72 }
      : { ...foe, health: 0, state: 'DEAD', rewardGranted: true });
    expect(runtime.save(storage)).toBe(true);
    const loadedSave = loadMazeGame(storage).save!;
    const loaded = new FPSGameRuntime('BARBARIAN', loadedSave);
    const hp = loaded.player.stats.hp;
    loaded.update(0.05, input());
    expect(loaded.player.stats.hp).toBe(hp);
    expect(loaded.enemies.find(foe => foe.id === guardian.id)?.state).toBe('ATTACK_ACTIVE');
    loaded.update(0.05, input());
    expect(loaded.player.stats.hp).toBe(hp);
    expect(loaded.enemies.find(foe => foe.id === guardian.id)?.state).toBe('RECOVER');
  });

  it('does not spend a captured action cost a second time when combat is restored', () => {
    const combat = new PlayerCombat();
    const player: PlayerCharacter = createPlayerCharacter('BARBARIAN');
    const start = combat.start(player, 'barbarian_heavy_strike');
    expect(start.error).toBeUndefined();
    const savedPlayer = start.player;
    const restored = new PlayerCombat();
    restored.restore(combat.snapshot());
    const secondStart = restored.start(savedPlayer, 'barbarian_heavy_strike');
    expect(secondStart.error).toBe('Recovering from the current action.');
    expect(secondStart.player.stats.stamina).toBe(savedPlayer.stats.stamina);
  });
});
