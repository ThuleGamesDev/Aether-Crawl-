import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLASSES } from '../constants';
import { CLASS_ABILITY_LOADOUT, getAbility } from '../combat/AbilityRegistry';
import { updateProjectiles } from '../combat/ProjectileSystem';
import { ENEMY_ATTACK_SETS } from '../data/enemyAttacks';
import { enemyDefinitions } from '../data/enemies';
import { getLevelAssetPaths, enemyVisuals, collectAssetPaths } from '../data/assetRegistry';
import { FLOOR_GUARDIANS, LABYRINTH_THEMES, getFloorGuardianDefinition } from '../data/mazeContent';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { createItemInstance, createPlayerCharacter } from '../player/PlayerProgression';
import { xpToNextLevel } from '../player/PlayerProgression';
import { generateDungeon } from '../services/dungeonGenerator';
import { FPS_SAVE_KEY, saveFPSGame, type KeyValueStorage } from '../services/fpsSave';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import { getBiomeIdForLevel } from '../data/assetRegistry';
import { createDungeonWorld } from '../world/DungeonWorld';
import { reachableCells, cellKey } from '../services/dungeonPlan';
import { TileType, type LegacyPlayerCharacter, type WorldEnemy, type WorldProjectile } from '../types';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { spawnFloorEnemies } from '../world/EnemySpawner';

class MemoryStorage implements KeyValueStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const EXPECTED_CLASSES = {
  BARBARIAN: 'Myrmidon', PALADIN: 'Hoplite', SORCERER: 'Oracle', ROGUE: 'Trickster',
  RANGER: 'Hunter', CLERIC: 'Asclepiad', MONK: 'Pankratiast', NECROMANCER: 'Shadebinder',
} as const;
const localAssetExists = (url: string) => existsSync(resolve(process.cwd(), 'public', url.replace(/^\//, '')));

function oldR1Fixture(seed = 43109): { player: LegacyPlayerCharacter; world: DungeonWorldState; enemies: WorldEnemy[]; loot: []; combat: undefined } {
  const generated = generateDungeon('dungeon', seed, 3);
  const world: DungeonWorldState = {
    level: 3, seed, biome: 'dungeon', map: generated.map, decorations: generated.decorations,
    floor: generated.floor!, explored: generated.map.map(row => row.map(() => false)), worldRevision: 2,
    mazeChronicle: { version: 1, nextSequence: 1, events: [] },
  };
  world.explored[1][1] = true;
  const activePlayer = createPlayerCharacter('BARBARIAN', { x: 1.5, y: 0, z: 1.5 });
  const player: LegacyPlayerCharacter = {
    ...activePlayer,
    equipment: { weapon: activePlayer.equipment.mainHand, armor: null, offhand: activePlayer.equipment.offHand, accessory: null },
  };
  player.name = 'Barbarian';
  player.stats.level = 7;
  player.stats.xp = 13;
  const oldPotion = createItemInstance({ id: 'old-health', name: 'Health Potion', description: 'A potion from an older expedition.', type: 'POTION', value: 35, quantity: 1 }, 'legacy-potion-instance', 2);
  player.inventory.push(oldPotion);
  const exit = world.floor.rooms.find(room => room.type === 'BOSS')!.anchor;
  const enemies: WorldEnemy[] = [{
    id: 'old-floor-boss-instance', definitionId: 'skeleton_warrior', name: 'Bone Sentinel', visualId: 'skeleton_warrior',
    position: { x: exit.x + 0.5, y: 0, z: exit.y + 0.5 }, health: 0, maxHealth: 40, damage: 9, xpReward: 80,
    state: 'DEAD', stateTimer: 0, attackCooldown: 0, attackRange: 1.5, attackTelegraphSeconds: 0.7,
    rewardGranted: true, roomId: world.floor.rooms.find(room => room.type === 'BOSS')!.id, isBoss: true,
  }];
  return { player, world, enemies, loot: [], combat: undefined };
}

describe('FPS-R2A Greek rebrand and Guardian progression', () => {
  it('keeps all eight technical class IDs while exposing Greek class names, equipment, and actions', () => {
    expect(Object.keys(CLASSES).sort()).toEqual(Object.keys(EXPECTED_CLASSES).sort());
    for (const [classId, visibleName] of Object.entries(EXPECTED_CLASSES)) {
      expect(CLASSES[classId].name).toBe(visibleName);
      const player = createPlayerCharacter(classId as keyof typeof EXPECTED_CLASSES);
      expect(player.name).toBe(visibleName);
      expect('party' in player).toBe(false);
      expect(CLASSES[classId].startItems.length).toBeGreaterThan(0);
      const loadout = CLASS_ABILITY_LOADOUT[classId as keyof typeof CLASS_ABILITY_LOADOUT];
      expect(getAbility(loadout.primary)?.name).toBeTruthy();
      expect(getAbility(loadout.secondary)?.name).toBeTruthy();
      expect(getAbility(loadout.skill)?.name).toBeTruthy();
    }
    expect(CLASSES.BARBARIAN.startItems[0].name).toBe('Labrys');
    expect(CLASSES.PALADIN.startItems.map(item => item.name)).toEqual(['Dory Spear', 'Aspis']);
    expect(getAbility(CLASS_ABILITY_LOADOUT.BARBARIAN.primary)?.name).toBe('Bronze Cleave');
    expect(getAbility(CLASS_ABILITY_LOADOUT.BARBARIAN.secondary)?.name).toBe('Heroic Strike');
    expect(getAbility(CLASS_ABILITY_LOADOUT.BARBARIAN.skill)?.name).toBe('Ares’ Quake');
    expect(getAbility(CLASS_ABILITY_LOADOUT.SORCERER.primary)?.name).toBe('Oracle’s Spark');
    expect(getAbility(CLASS_ABILITY_LOADOUT.SORCERER.secondary)?.name).toBe('Fatebound Bolt');
    expect(getAbility(CLASS_ABILITY_LOADOUT.SORCERER.skill)?.name).toBe('Promethean Flame');
  });

  it('uses mythic active enemy identities and local static art without a generic spawn fallback', () => {
    expect(enemyDefinitions).toHaveLength(28);
    for (const enemy of enemyDefinitions) {
      expect(enemy.fpsName.trim()).not.toBe('');
      expect(enemy.fpsDescription.trim()).not.toBe('');
      expect(enemy.fpsVisualId.trim()).not.toBe('');
      expect(enemy.attackSetId in ENEMY_ATTACK_SETS).toBe(true);
      expect(enemyVisuals[enemy.fpsVisualId]?.sprite).toBeDefined();
      expect(localAssetExists(enemyVisuals[enemy.fpsVisualId].sprite)).toBe(true);
    }
    for (const path of collectAssetPaths()) expect(localAssetExists(path), path).toBe(true);
    for (let level = 1; level <= 5; level += 1) {
      expect(getLevelAssetPaths(level)).toContain(enemyVisuals[getFloorGuardianDefinition(level).visualId].sprite);
    }
    expect(LABYRINTH_THEMES.dungeon.name).toBe('Palace Foundations');
    expect(LABYRINTH_THEMES.moss.name).toBe('Serpent Galleries');
  });

  it('creates seeded, reachable 23x23 Guardian arenas across varied floor seeds', () => {
    for (let level = 1; level <= 5; level += 1) for (let seed = 0; seed < 40; seed += 1) {
      const dungeon = generateDungeon(getBiomeIdForLevel(level), (seed * 7919 + level * 104729) >>> 0, level, { mapSize: 23, guardianArenaRadius: 3 });
      const bossRoom = dungeon.floor!.rooms.find(room => room.type === 'BOSS')!;
      const exit = bossRoom.anchor;
      const reachable = new Set(reachableCells(dungeon.map).map(cellKey));
      expect(dungeon.map).toHaveLength(23);
      expect(dungeon.map[0]).toHaveLength(23);
      expect(dungeon.map[exit.y][exit.x]).toBe(TileType.EXIT);
      expect(reachable.has(cellKey(exit))).toBe(true);
      expect(bossRoom.cells).toHaveLength(49);
      expect(bossRoom.cells.every(cell => dungeon.map[cell.y][cell.x] !== TileType.WALL)).toBe(true);
      const repeated = generateDungeon(getBiomeIdForLevel(level), (seed * 7919 + level * 104729) >>> 0, level, { mapSize: 23, guardianArenaRadius: 3 });
      expect(repeated.map).toEqual(dungeon.map);
    }
  });

  it('spawns one canonical, reachable, floor-specific Guardian with at least two distinct attacks', () => {
    for (let level = 1; level <= 10; level += 1) for (let seed = 0; seed < 6; seed += 1) {
      const world = createDungeonWorld(level, 32000 + level * 100 + seed);
      const guardian = getFloorGuardianDefinition(level);
      const enemies = spawnFloorEnemies(world.map, world.floor);
      const matches = enemies.filter(enemy => enemy.definitionId === guardian.id);
      expect(world.floor.guardianId).toBe(guardian.id);
      expect(world.floor.guardianState).toBe('NOT_DISCOVERED');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({ name: guardian.name, visualId: guardian.visualId, isBoss: true, attackSetId: guardian.attackSetId, behaviorRole: guardian.behaviorRole });
      expect(reachableCells(world.map).some(cell => cellKey(cell) === `${Math.floor(matches[0].position.x)},${Math.floor(matches[0].position.z)}`)).toBe(true);
      const bossRoom = world.floor.rooms.find(room => room.type === 'BOSS')!;
      expect(`${Math.floor(matches[0].position.x)},${Math.floor(matches[0].position.z)}`).not.toBe(cellKey(bossRoom.anchor));
      expect(enemies.filter(enemy => !enemy.isBoss).every(enemy => enemyDefinitions.find(definition => definition.id === enemy.definitionId)?.fpsName === enemy.name)).toBe(true);
      const attacks = ENEMY_ATTACK_SETS[guardian.attackSetId];
      expect(attacks.length).toBeGreaterThanOrEqual(2);
      expect(new Set(attacks.map(attack => attack.id)).size).toBe(attacks.length);
    }
  });

  it('keeps descent locked until Guardian rewards resolve, persists the unlocked state once, and descends only on interaction', () => {
    const storage = new MemoryStorage();
    const runtime = new FPSGameRuntime('BARBARIAN');
    const floor = runtime.world.floor;
    const guardian = runtime.enemies.find(enemy => enemy.definitionId === floor.guardianId)!;
    const bossRoom = floor.rooms.find(room => room.type === 'BOSS')!;
    runtime.player = { ...runtime.player, position: { x: bossRoom.anchor.x + 0.5, y: 0, z: bossRoom.anchor.y + 0.5 }, rotation: { yaw: 0, pitch: 0 } };
    runtime.interact();
    expect(runtime.world.level).toBe(1);
    expect(runtime.world.floor.guardianState).not.toBe('DESCENT_UNLOCKED');
    let expectedXp = runtime.player.stats.xp + guardian.xpReward;
    let expectedLevel = runtime.player.stats.level;
    while (expectedXp >= xpToNextLevel(expectedLevel)) {
      expectedXp -= xpToNextLevel(expectedLevel);
      expectedLevel += 1;
    }
    runtime.enemies = runtime.enemies.map(enemy => enemy.id === guardian.id ? { ...enemy, health: 0, state: 'DEAD', stateTimer: 1.1 } : enemy);
    runtime.update(0.05, {
      movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
      primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
      skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
      inventoryPressed: false, mapPressed: false, pausePressed: false,
    });
    expect(runtime.world.floor.guardianState).toBe('DESCENT_UNLOCKED');
    expect(runtime.player.stats.level).toBe(expectedLevel);
    expect(runtime.player.stats.xp).toBe(expectedXp);
    expect(runtime.loot).toHaveLength(1);
    const xpAfterKill = runtime.player.stats.xp;
    runtime.update(0.05, {
      movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
      primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
      skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
      inventoryPressed: false, mapPressed: false, pausePressed: false,
    });
    expect(runtime.player.stats.xp).toBe(xpAfterKill);
    expect(runtime.loot).toHaveLength(1);
    expect(runtime.save(storage)).toBe(true);
    const saved = loadMazeGame(storage);
    expect(saved.invalid).toBe(false);
    const resumed = new FPSGameRuntime('BARBARIAN', saved.save!);
    expect(resumed.enemies.filter(enemy => enemy.definitionId === resumed.world.floor.guardianId)).toHaveLength(1);
    expect(resumed.world.floor.guardianState).toBe('DESCENT_UNLOCKED');
    expect(resumed.player.stats.xp).toBe(xpAfterKill);
    expect(resumed.loot).toHaveLength(1);
    resumed.interact();
    expect(resumed.world.level).toBe(1);
    const offer = resumed.getSnapshot().lawOffer!;
    expect(offer.lawIds).toHaveLength(3);
    expect(resumed.selectLaw(offer.lawIds[0])).toBe(true);
    expect(resumed.world.level).toBe(1);
    resumed.interact();
    expect(resumed.world.level).toBe(2);
    expect(resumed.world.floor.guardianId).toBe(FLOOR_GUARDIANS[1].id);
    expect(resumed.world.floor.guardianState).toBe('NOT_DISCOVERED');
  });

  it('collides enemy projectiles with walls and the player in world space', () => {
    const open = Array.from({ length: 8 }, (_, z) => Array.from({ length: 8 }, (_, x) => x === 0 || z === 0 || x === 7 || z === 7 ? TileType.WALL : TileType.EMPTY));
    const projectile: WorldProjectile = {
      id: 1, position: { x: 1.5, y: 1.15, z: 2.5 }, velocity: { x: 20, y: 0, z: 0 }, radius: 0.17,
      damage: 10, remainingSeconds: 1, sourceAbilityId: 'priestess_venom_orb', color: '#9bb34b', faction: 'ENEMY', ownerEnemyId: 'guardian',
    };
    const wallMap = open.map(row => [...row]);
    wallMap[2][2] = TileType.WALL;
    const wallHit = updateProjectiles([projectile], [], wallMap, 0.05, { x: 3.5, y: 0, z: 2.5 });
    expect(wallHit.projectiles).toHaveLength(0);
    expect(wallHit.impacts[0].playerHit).not.toBe(true);
    const playerHit = updateProjectiles([projectile], [], open, 0.05, { x: 2.5, y: 0, z: 2.5 });
    expect(playerHit.projectiles).toHaveLength(0);
    expect(playerHit.impacts.some(impact => impact.playerHit && impact.ownerEnemyId === 'guardian')).toBe(true);
  });

  it('migrates an R1 save without overwriting its old key and rejects malformed data in place', () => {
    const storage = new MemoryStorage();
    const fixture = oldR1Fixture();
    expect(saveFPSGame(fixture, storage)).toBe(true);
    const original = storage.getItem(FPS_SAVE_KEY);
    const migration = loadMazeGame(storage);
    expect(migration.invalid).toBe(false);
    expect(migration.migratedFromR1).toBe(true);
    expect(migration.save?.migratedFrom).toBe('FPS_R1');
    expect(migration.save?.world.level).toBe(3);
    expect(migration.save?.world.seed).toBe(fixture.world.seed);
    expect(migration.save?.world.map).toHaveLength(23);
    expect(migration.save?.player.position.x).toBe(fixture.player.position.x + 5);
    expect(migration.save?.player.stats.level).toBe(7);
    expect(migration.save?.player.stats.xp).toBe(13);
    expect(migration.save?.player.name).toBe('Myrmidon');
    expect(migration.save?.player.inventory[0].instanceId).toBe(fixture.player.inventory[0].instanceId);
    expect(migration.save?.player.inventory.at(-1)?.name).toBe('Healing Draught');
    expect(migration.save?.world.floor.guardianState).toBe('DESCENT_UNLOCKED');
    expect(migration.save?.enemies.filter(enemy => enemy.definitionId === migration.save?.world.floor.guardianId)).toHaveLength(1);
    const migratedGuardian = migration.save?.enemies.find(enemy => enemy.definitionId === migration.save?.world.floor.guardianId)!;
    const exit = migration.save!.world.floor.rooms.find(room => room.type === 'BOSS')!.anchor;
    expect(`${Math.floor(migratedGuardian.position.x)},${Math.floor(migratedGuardian.position.z)}`).not.toBe(cellKey(exit));
    expect(storage.getItem(FPS_SAVE_KEY)).toBe(original);
    expect(storage.getItem(MAZE_SAVE_KEY)).toBeNull();
    expect(saveMazeGame(migration.save!, storage)).toBe(true);
    expect(storage.getItem(FPS_SAVE_KEY)).toBe(original);
    expect(loadMazeGame(storage).save?.version).toBe(8);

    const invalid = new MemoryStorage();
    invalid.setItem(MAZE_SAVE_KEY, '{broken-json');
    invalid.setItem(FPS_SAVE_KEY, original!);
    const invalidResult = loadMazeGame(invalid);
    expect(invalidResult.invalid).toBe(true);
    expect(invalid.getItem(MAZE_SAVE_KEY)).toBe('{broken-json');
    expect(invalid.getItem(FPS_SAVE_KEY)).toBe(original);
  });

  it('does not turn an unclaimed R1 boss death into a permanently locked empty floor', () => {
    const storage = new MemoryStorage();
    const fixture = oldR1Fixture();
    fixture.enemies[0] = { ...fixture.enemies[0], health: 0, rewardGranted: false, state: 'DEAD' };
    expect(saveFPSGame(fixture, storage)).toBe(true);
    const migrated = loadMazeGame(storage).save!;
    const guardian = migrated.enemies.find(enemy => enemy.definitionId === migrated.world.floor.guardianId)!;
    expect(guardian.health).toBe(1);
    expect(guardian.state).toBe('IDLE');
    expect(guardian.rewardGranted).toBe(false);
    expect(migrated.world.floor.guardianState).toBe('NOT_DISCOVERED');
  });
});
