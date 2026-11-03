import { describe, expect, it } from 'vitest';
import type { ClassType, DungeonRoom, LegacyPlayerCharacter, PlayerCharacter, WorldEnemy, WorldProjectile } from '../types';
import { CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { calculatePlayerDamage, resolveMeleeAttack } from '../combat/DamageSystem';
import { updateProjectiles } from '../combat/ProjectileSystem';
import type { InputFrame } from '../engine/InputSystem';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { PlayerCombat } from '../player/PlayerCombat';
import { createItemInstance, createPlayerCharacter, equipItem, grantExperience, unequipItem } from '../player/PlayerProgression';
import { createDungeonWorld, createRoomOffer } from '../world/DungeonWorld';
import { canOccupyWorldPosition, hasLineOfSight, nextGridStep } from '../world/CollisionWorld';
import { updateEnemyBrains } from '../enemies/EnemyBrain';
import { FPS_SAVE_KEY, loadFPSGame, saveFPSGame, type KeyValueStorage } from '../services/fpsSave';
import { MAZE_SAVE_KEY, loadMazeGame } from '../services/mazeSave';
import { createPlayerControllerState, MAX_CAMERA_PITCH, updatePlayerController } from '../player/PlayerController';
import { GameLoop } from '../engine/GameLoop';
import { getPixelRenderSize } from '../engine/SceneRenderer';

function makeMap(width = 8, height = 8): number[][] {
  return Array.from({ length: height }, (_, z) => Array.from({ length: width }, (_, x) => x === 0 || z === 0 || x === width - 1 || z === height - 1 ? 1 : 0));
}

function makeEnemy(overrides: Partial<WorldEnemy> = {}): WorldEnemy {
  return {
    id: 'enemy_test', definitionId: 'giant_rat', name: 'Giant Rat', visualId: 'giant_rat',
    position: { x: 2.6, y: 0, z: 1.5 }, health: 15, maxHealth: 15, damage: 3, xpReward: 10,
    state: 'IDLE', stateTimer: 0, attackCooldown: 1, attackRange: 1.15, attackTelegraphSeconds: 0.48,
    rewardGranted: false, isBoss: false, ...overrides,
  };
}

function emptyInput(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
    primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
    skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
    inventoryPressed: false, mapPressed: false, pausePressed: false, ...overrides,
  };
}

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('FPS-R1 solo runtime', () => {
  it('creates one standalone player and valid actions for all eight classes', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    expect(runtime.player.classId).toBe('BARBARIAN');
    expect('party' in runtime.player).toBe(false);
    expect(runtime.enemies.length).toBeGreaterThan(0);
    for (const classId of Object.keys(CLASS_ABILITY_LOADOUT) as ClassType[]) {
      const loadout = CLASS_ABILITY_LOADOUT[classId];
      expect(getAbility(loadout.primary)?.id).toBe(loadout.primary);
      expect(getAbility(loadout.secondary)?.id).toBe(loadout.secondary);
      expect(getAbility(loadout.skill)?.id).toBe(loadout.skill);
    }
  });

  it('clamps vertical look and blocks forward motion against walls while allowing wall sliding', () => {
    const map = makeMap();
    map[1][2] = 1;
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const first = updatePlayerController(player, createPlayerControllerState(), emptyInput({ movement: { forward: 1, strafe: 1, turn: 0 } }), map, 0.05);
    expect(first.player.position.x).toBeLessThan(1.82);
    expect(first.player.position.z).toBeGreaterThan(1.5);
    const look = updatePlayerController(player, createPlayerControllerState(), emptyInput({ lookX: 0.2, lookY: 5 }), map, 0.05);
    expect(look.player.rotation.yaw).toBeCloseTo(0.2);
    expect(look.player.rotation.pitch).toBe(-MAX_CAMERA_PITCH);
  });

  it('blocks the player against a living enemy hitbox and releases the space when it dies', () => {
    const map = makeMap();
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const enemy = makeEnemy({ position: { x: 2.1, y: 0, z: 1.5 }, collisionRadius: 0.22 });
    let state = createPlayerControllerState();
    let movedPlayer = player;
    for (let index = 0; index < 12; index += 1) {
      const result = updatePlayerController(movedPlayer, state, emptyInput({ movement: { forward: 1, strafe: 0, turn: 0 } }), map, 0.05, [enemy]);
      movedPlayer = result.player;
      state = result.state;
    }
    expect(movedPlayer.position.x).toBeLessThanOrEqual(1.71);
    for (let index = 0; index < 8; index += 1) {
      const result = updatePlayerController(movedPlayer, state, emptyInput({ movement: { forward: 1, strafe: 0, turn: 0 } }), map, 0.05, [{ ...enemy, health: 0, state: 'DEAD' }]);
      movedPlayer = result.player;
      state = result.state;
    }
    expect(movedPlayer.position.x).toBeGreaterThan(1.71);
  });

  it('uses grid line of sight and returns a navigable step around walls', () => {
    const map = makeMap();
    map[2][3] = 1;
    expect(hasLineOfSight(map, 1.5, 2.5, 4.5, 2.5)).toBe(false);
    const step = nextGridStep(map, { x: 2, y: 2 }, { x: 4, y: 2 });
    expect(step).not.toBeNull();
    expect(Math.abs(step!.x - 2) + Math.abs(step!.y - 2)).toBe(1);
    expect(canOccupyWorldPosition(map, 2.85, 2.5)).toBe(false);
  });

  it('resolves melee range, attack arcs and wall blocking', () => {
    const player = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
    const ability = getAbility('barbarian_cleave')!;
    const open = makeMap();
    const enemy = makeEnemy({ position: { x: 2.7, y: 0, z: 1.5 }, health: 12, maxHealth: 12 });
    const hit = resolveMeleeAttack(open, player, [enemy], ability, calculatePlayerDamage(player, ability));
    expect(hit.hitEnemyIds).toEqual([enemy.id]);
    expect(hit.enemies[0].state).toBe('DEAD');
    const blocked = makeMap();
    blocked[1][2] = 1;
    const noHit = resolveMeleeAttack(blocked, player, [enemy], ability, 100);
    expect(noHit.hitEnemyIds).toEqual([]);
    expect(noHit.enemies[0].health).toBe(12);
  });

  it('applies room preparation as a temporary solo damage buff', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const ability = getAbility('barbarian_cleave')!;
    const normalDamage = calculatePlayerDamage(player, ability);
    const prepared = {
      ...player,
      statusEffects: [{ id: 'prepared', statusId: 'prepared_damage', durationSeconds: 20, magnitude: 4 }],
    };
    expect(calculatePlayerDamage(prepared, ability)).toBe(normalDamage + 4);
  });

  it('charges mana once and advances through windup, active, and recovery without turns', () => {
    const player = createPlayerCharacter('SORCERER');
    const combat = new PlayerCombat();
    const start = combat.start(player, 'sorcerer_fireburst');
    expect(start.error).toBeUndefined();
    expect(start.player.stats.mp).toBe(player.stats.mp - 18);
    expect(combat.start(start.player, 'sorcerer_fireburst').error).toBe('Recovering from the current action.');
    let phase = '';
    for (let i = 0; i < 25; i += 1) {
      const update = combat.update(0.05);
      if (update.action) phase = update.action.phase;
    }
    expect(phase).toBe('RECOVERY');
    const poor = { ...player, stats: { ...player.stats, mp: 0 } };
    expect(new PlayerCombat().start(poor, 'sorcerer_fireburst').error).toBe('Not enough mana.');
  });

  it('keeps a finished ability on its own cooldown', () => {
    const combat = new PlayerCombat();
    const player = createPlayerCharacter('BARBARIAN');
    expect(combat.start(player, 'barbarian_ground_slam').error).toBeUndefined();
    for (let index = 0; index < 30; index += 1) combat.update(0.05);
    expect(combat.action).toBeNull();
    expect(combat.getCooldown('barbarian_ground_slam')).toBeGreaterThan(0);
    expect(combat.start(player, 'barbarian_ground_slam').error).toBe('Ares’ Quake is not ready.');
  });

  it('moves enemies toward the hero through grid navigation and telegraphs attacks', () => {
    const map = makeMap();
    const player = createPlayerCharacter('BARBARIAN', { x: 4.5, y: 0, z: 1.5 });
    let enemy = makeEnemy({ position: { x: 1.5, y: 0, z: 1.5 }, attackCooldown: 0 });
    let sawTelegraph = false;
    for (let i = 0; i < 50; i += 1) {
      const update = updateEnemyBrains([enemy], map, player, 0.05);
      enemy = update.enemies[0];
      if (enemy.state === 'ATTACK_WINDUP') sawTelegraph = true;
    }
    expect(enemy.position.x).toBeGreaterThan(1.5);
    expect(sawTelegraph).toBe(true);
  });

  it('collides projectiles with enemies and walls', () => {
    const map = makeMap();
    const projectile: WorldProjectile = { id: 1, position: { x: 1.5, y: 0.72, z: 1.5 }, velocity: { x: 18, y: 0, z: 0 }, radius: 0.1, damage: 50, remainingSeconds: 2, sourceAbilityId: 'test_bolt', color: '#fff' };
    const enemy = makeEnemy({ position: { x: 3.2, y: 0, z: 1.5 }, health: 20, maxHealth: 20 });
    let result = updateProjectiles([projectile], [enemy], map, 0.05);
    expect(result.enemies[0].health).toBe(20);
    result = updateProjectiles(result.projectiles, result.enemies, map, 0.05);
    expect(result.enemies[0].health).toBe(0);
    expect(result.impacts.some(impact => impact.enemyId === enemy.id)).toBe(true);

    const wallMap = makeMap();
    wallMap[1][3] = 1;
    let wallResult = updateProjectiles([projectile], [], wallMap, 0.05);
    const wallImpacts = [...wallResult.impacts];
    wallResult = updateProjectiles(wallResult.projectiles, [], wallMap, 0.05);
    wallImpacts.push(...wallResult.impacts);
    wallResult = updateProjectiles(wallResult.projectiles, [], wallMap, 0.05);
    wallImpacts.push(...wallResult.impacts);
    expect(wallResult.projectiles).toHaveLength(0);
    expect(wallImpacts.length).toBeGreaterThan(0);
  });

  it('grants XP, levels up, and equips a solo inventory item', () => {
    const player = createPlayerCharacter('BARBARIAN');
    const gained = grantExperience(player, 40);
    expect(gained.levelsGained).toBe(1);
    expect(gained.player.stats.level).toBe(2);
    const armor = createItemInstance({ id: 'linothorax', name: 'Test Armor', description: 'Armor for a test.', type: 'ARMOR', value: 4, quantity: 1 }, 'instance_test_armor');
    const equipped = equipItem({ ...gained.player, inventory: [armor] }, armor.instanceId);
    expect(equipped.equipment.torso?.instanceId).toBe(armor.instanceId);
    expect(equipped.stats.armor).toBe(4);

    const charm = createItemInstance({ id: 'bronze_signet', name: 'Test Charm', description: 'Strength charm.', type: 'ACCESSORY', value: 5, statBonus: 'STR', quantity: 1 }, 'instance_test_charm');
    const withCharm = equipItem({ ...gained.player, inventory: [charm] }, charm.instanceId);
    const cleave = getAbility('barbarian_cleave')!;
    expect(calculatePlayerDamage(withCharm, cleave)).toBeGreaterThan(calculatePlayerDamage(gained.player, cleave));
    expect(unequipItem(withCharm, 'ring1').equipment.ring1).toBeNull();
  });

  it('pays an enemy reward once after a lethal projectile hit', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const enemy = makeEnemy({ position: { x: 2.2, y: 0, z: 1.5 }, health: 8, maxHealth: 8 });
    runtime.enemies = [enemy];
    runtime.projectiles = [{ id: 1, position: { x: 1.5, y: 0.72, z: 1.5 }, velocity: { x: 18, y: 0, z: 0 }, radius: 0.1, damage: 20, remainingSeconds: 1, sourceAbilityId: 'test_bolt', color: '#fff' }];
    const frame = emptyInput();
    runtime.update(0.05, frame);
    runtime.update(0.05, frame);
    const xpAfterReward = runtime.player.stats.xp;
    runtime.update(0.05, frame);
    expect(runtime.enemies[0].rewardGranted).toBe(true);
    expect(runtime.player.stats.xp).toBe(xpAfterReward);
    expect(runtime.loot.length).toBeLessThanOrEqual(1);
  });

  it('collects a world item with E and opens a closed dungeon door', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const loot = createItemInstance({ id: 'test_drop', name: 'Test Drop', description: 'A pickup.', type: 'WEAPON', value: 4, quantity: 1 }, 'pickup_test');
    runtime.loot = [{ id: loot.instanceId, position: { x: 2.1, y: 0, z: 1.5 }, item: loot }];
    runtime.player = { ...runtime.player, position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 } };
    const openMap = runtime.world.map.map(row => [...row]);
    openMap[1][2] = 0;
    runtime.world = { ...runtime.world, map: openMap };
    runtime.interact();
    expect(runtime.loot).toHaveLength(0);
    expect(runtime.player.inventory.some(item => item.instanceId === loot.instanceId)).toBe(true);

    const map = runtime.world.map.map(row => [...row]);
    map[1][2] = 2;
    runtime.world = { ...runtime.world, map, floor: { ...runtime.world.floor, rooms: [] } };
    runtime.interact();
    expect(runtime.world.map[1][2]).toBe(0);
  });

  it('carries an Iron Key from an event into a locked vault and claims its rare reward', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const event: DungeonRoom = { id: 'event_key', type: 'EVENT', anchor: { x: 4, y: 4 }, cells: [], discovered: true, visited: true, resolved: false };
    runtime.world = { ...runtime.world, floor: { ...runtime.world.floor, keys: 0, rooms: [event] } };
    runtime.roomOffer = createRoomOffer(event);
    runtime.resolveRoomChoice('key');
    expect(runtime.world.floor.keys).toBe(1);

    const vault: DungeonRoom = { id: 'vault_key', type: 'LOCKED', anchor: { x: 2, y: 1 }, gate: { x: 2, y: 1 }, cells: [], discovered: false, visited: false, resolved: false };
    const map = runtime.world.map.map(row => [...row]);
    map[1][2] = 4;
    runtime.world = { ...runtime.world, map, floor: { ...runtime.world.floor, rooms: [vault] } };
    runtime.player = { ...runtime.player, position: { x: 1.5, y: 0, z: 1.5 }, rotation: { yaw: 0, pitch: 0 } };
    runtime.interact();
    expect(runtime.world.floor.keys).toBe(0);
    expect(runtime.world.map[1][2]).toBe(0);
    expect(runtime.world.floor.rooms[0].unlocked).toBe(true);
    runtime.interact();
    expect(runtime.roomOffer?.title).toBe('Sealed Treasury');
    runtime.resolveRoomChoice('gear');
    expect(runtime.loot[0].item.rarity).toBe('RARE');
  });

  it('clears the active loop accumulator after a hidden tab and does not catch up', () => {
    const previousDocument = globalThis.document;
    let visibility: 'visible' | 'hidden' = 'visible';
    const listeners = new Map<string, EventListener>();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get visibilityState() { return visibility; },
        addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
        removeEventListener: (type: string) => listeners.delete(type),
      },
    });
    let frame: ((timestamp: number) => void) | null = null;
    const renderer = { setAnimationLoop: (callback: ((timestamp: number) => void) | null) => { frame = callback; } } as unknown as import('three').WebGLRenderer;
    const updates: number[] = [];
    const loop = new GameLoop(renderer, delta => updates.push(delta), () => undefined);
    try {
      loop.start();
      frame!(1000);
      frame!(1017);
      expect(updates.length).toBe(1);
      visibility = 'hidden';
      listeners.get('visibilitychange')?.(new Event('visibilitychange'));
      frame!(50_000);
      expect(updates.length).toBe(1);
      visibility = 'visible';
      listeners.get('visibilitychange')?.(new Event('visibilitychange'));
      frame!(80_000);
      frame!(80_017);
      expect(updates.length).toBe(2);
      loop.stop();
    } finally {
      if (previousDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
      else Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
    }
  });

  it('stores R1 saves in a new namespace and rejects invalid data without altering old saves', () => {
    const storage = new MemoryStorage();
    storage.setItem('aether_save', 'legacy-party-save');
    const world = createDungeonWorld(1, 1234);
    const activePlayer = createPlayerCharacter('PALADIN');
    const player: LegacyPlayerCharacter = {
      ...activePlayer,
      equipment: { weapon: activePlayer.equipment.mainHand, armor: null, offhand: activePlayer.equipment.offHand, accessory: null },
    };
    expect(saveFPSGame({ player, world, enemies: [], loot: [] }, storage)).toBe(true);
    const loaded = loadFPSGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.player.classId).toBe('PALADIN');
    expect(storage.getItem('aether_save')).toBe('legacy-party-save');
    expect(storage.getItem(FPS_SAVE_KEY)).not.toBeNull();
    const validRaw = storage.getItem(FPS_SAVE_KEY)!;
    storage.setItem(FPS_SAVE_KEY, '{broken');
    expect(loadFPSGame(storage)).toEqual({ save: null, invalid: true });
    const malformedStats = JSON.parse(validRaw) as Record<string, any>;
    malformedStats.player.stats.mp = 'invalid';
    storage.setItem(FPS_SAVE_KEY, JSON.stringify(malformedStats));
    expect(loadFPSGame(storage)).toEqual({ save: null, invalid: true });
    expect(storage.getItem('aether_save')).toBe('legacy-party-save');
  });

  it('restores player action timing and cooldowns from a solo save', () => {
    const storage = new MemoryStorage();
    const runtime = new FPSGameRuntime('BARBARIAN');
    runtime.update(0.05, emptyInput({ primaryPressed: true }));
    const before = runtime.getSnapshot();
    expect(before.action?.phase).toBe('WINDUP');
    expect(runtime.save(storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(storage.getItem(MAZE_SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(FPS_SAVE_KEY)).toBeNull();
    const resumed = new FPSGameRuntime('BARBARIAN', loaded.save!);
    expect(resumed.getSnapshot().action).toEqual(before.action);
    expect(resumed.getSnapshot().primaryCooldown).toBeCloseTo(before.primaryCooldown);
  });

  it('advances to a fresh floor and changes the world-geometry revision', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const bossRoom = runtime.world.floor.rooms.find(room => room.type === 'BOSS');
    expect(bossRoom).toBeDefined();
    const oldLevel = runtime.world.level;
    const oldRevision = runtime.world.worldRevision;
    runtime.player = {
      ...runtime.player,
      position: { x: bossRoom!.anchor.x + 0.5, y: 0, z: bossRoom!.anchor.y + 0.5 },
      rotation: { yaw: 0, pitch: 0 },
    };
    const guardian = runtime.enemies.find(enemy => enemy.definitionId === runtime.world.floor.guardianId)!;
    runtime.enemies = runtime.enemies.map(enemy => enemy.id === guardian.id ? { ...enemy, health: 0, state: 'DEAD', stateTimer: 1.1 } : enemy);
    runtime.update(0.05, emptyInput());
    runtime.interact();
    expect(runtime.world.level).toBe(oldLevel + 1);
    expect(runtime.world.worldRevision).toBeGreaterThan(oldRevision);
  });

  it('keeps low-resolution rendering at the viewport aspect ratio and scales mobile lower', () => {
    const mobile = getPixelRenderSize(390, 844, true);
    const desktop = getPixelRenderSize(1280, 800, false);
    expect(mobile.width / mobile.height).toBeCloseTo(390 / 844, 2);
    expect(desktop.width / desktop.height).toBeCloseTo(1280 / 800, 2);
    expect(mobile.scale).toBeLessThan(desktop.scale);
  });
});
