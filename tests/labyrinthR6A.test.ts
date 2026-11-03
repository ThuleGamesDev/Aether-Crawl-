import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateProjectiles } from '../combat/ProjectileSystem';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { generateDungeon } from '../services/dungeonGenerator';
import { cellKey, reachableCells } from '../services/dungeonPlan';
import { fitMinimapLayout, worldToMinimapPoint } from '../services/minimapLayout';
import { isValidFloorState } from '../services/dungeonSave';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import type { KeyValueStorage } from '../services/fpsSave';
import { createDungeonWorld } from '../world/DungeonWorld';
import { spawnFloorEnemies } from '../world/EnemySpawner';
import { canOccupyWorldPosition, hasLineOfSight, isWorldSolid, raycastGrid } from '../world/CollisionWorld';
import { findWallMount } from '../world/architecture';
import { AssetManager } from '../presentation/AssetManager';
import { WorldGeometry } from '../world/WorldGeometry';
import { DungeonDecoration, TileType, type WorldProjectile } from '../types';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function architecturalDungeon(seed: number, level = 1) {
  return generateDungeon('dungeon', seed, level, { mapSize: 23, guardianArenaRadius: 3, topology: 'ARCHITECTURAL' });
}

function setCanvasDocumentMock(): void {
  const context = new Proxy({}, { get: () => () => undefined, set: () => true });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('R6A labyrinth architecture, rooms, and lighting', () => {
  it('reserves the center chamber only on floors with prepared Thread anchors', () => {
    for (let level = 2; level <= 5; level += 1) {
      const floor = architecturalDungeon(6600 + level, level).floor!;
      expect(floor.threadJunctions).toHaveLength(1);
      expect(floor.architectureRooms?.find(room => room.id.endsWith('_4'))?.combatSuitability).toBe('NONE');
    }
    const laterFloor = architecturalDungeon(6606, 6).floor!;
    expect(laterFloor.threadJunctions).toEqual([]);
    expect(laterFloor.architectureRooms?.find(room => room.id.endsWith('_4'))?.combatSuitability).toBe('SUITABLE');
  });

  it('builds deterministic, varied chamber layouts with two combat spaces and a controlled Guardian entrance', () => {
    let narrowPassages = 0;
    const observedShapes = new Set<string>();
    for (let seed = 0; seed < 80; seed += 1) {
      const first = architecturalDungeon(seed, 1);
      const repeated = architecturalDungeon(seed, 1);
      expect(first.map).toEqual(repeated.map);
      expect(first.decorations).toEqual(repeated.decorations);
      expect(first.floor).toEqual(repeated.floor);
      expect(first.map).toHaveLength(23);
      expect(first.map.every(row => row.length === 23)).toBe(true);
      const architecture = first.floor!.architectureRooms!;
      for (const room of architecture) observedShapes.add(room.roomShape);
      narrowPassages += architecture.filter(room => room.roomShape === 'NARROW_PASSAGE').length;
      expect(first.floor!.rooms.filter(room => room.type === 'COMBAT').length).toBeGreaterThanOrEqual(2);
      expect(architecture.some(room => room.roomShape === 'PILLARED_HALL')).toBe(true);
      expect(architecture.some(room => room.roomShape === 'GUARDIAN_ARENA')).toBe(true);
      expect(first.floor!.rooms.filter(room => room.type === 'COMBAT').every(room => room.cells.length >= 16)).toBe(true);
      expect(architecture.some(room => room.roomShape === 'WIDE_PASSAGE')).toBe(true);

      const arena = architecture.find(room => room.roomShape === 'GUARDIAN_ARENA')!;
      const arenaKeys = new Set(arena.cells.map(cellKey));
      const entranceSides = new Set<string>();
      for (const cell of arena.cells) for (const [dx, dy, side] of [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'S'], [0, -1, 'N']] as const) {
        const neighbor = { x: cell.x + dx, y: cell.y + dy };
        if (arenaKeys.has(cellKey(neighbor)) || ![TileType.EMPTY, TileType.EXIT].includes(first.map[neighbor.y]?.[neighbor.x] as TileType)) continue;
        entranceSides.add(side);
      }
      expect(arena.cells).toHaveLength(49);
      expect(entranceSides.size, `seed=${seed}; sides=${[...entranceSides].join(',')}`).toBe(1);
    }
    expect(observedShapes).toEqual(new Set(['ENTRY_HALL', 'HALL', 'GALLERY', 'CROSSROADS', 'PILLARED_HALL', 'ROTUNDA', 'GUARDIAN_ARENA', 'WIDE_PASSAGE', 'NARROW_PASSAGE']));
    expect(narrowPassages).toBeGreaterThan(0);
  });

  it('keeps the exit and all ordinary rooms reachable without carving through existing corridors', () => {
    for (let level = 1; level <= 5; level += 1) for (let seed = 0; seed < 25; seed += 1) {
      const dungeon = architecturalDungeon(seed * 811 + level * 1009, level);
      const reachable = new Set(reachableCells(dungeon.map).map(cellKey));
      const boss = dungeon.floor!.rooms.find(room => room.type === 'BOSS')!;
      expect(dungeon.map[boss.anchor.y][boss.anchor.x]).toBe(TileType.EXIT);
      expect(reachable.has(cellKey(boss.anchor))).toBe(true);
      const gatedPocketCells = new Set(dungeon.floor!.rooms.filter(room => room.type === 'LOCKED' || room.type === 'SECRET').flatMap(room => room.cells.map(cellKey)));
      const combatRooms = dungeon.floor!.rooms.filter(room => room.type === 'COMBAT');
      expect(combatRooms.length).toBeGreaterThanOrEqual(2);
      expect(combatRooms.every(room => room.cells.length >= 16)).toBe(true);
      dungeon.map.forEach((row, y) => row.forEach((tile, x) => {
        if ((tile === TileType.EMPTY || tile === TileType.EXIT) && !gatedPocketCells.has(`${x},${y}`)) expect(reachable.has(`${x},${y}`)).toBe(true);
      }));
      expect(combatRooms.every(room => reachable.has(cellKey(room.anchor)))).toBe(true);
      expect(dungeon.floor!.architectureRooms!.filter(room => room.roomShape === 'PILLARED_HALL').flatMap(room => room.cells).every(cell => !isWorldSolid(dungeon.map[cell.y]?.[cell.x]))).toBe(true);
      for (let y = 0; y < dungeon.map.length; y += 1) for (let x = 0; x < dungeon.map[y].length; x += 1) {
        if (dungeon.decorations[y][x] === DungeonDecoration.PILLAR) expect(dungeon.map[y][x]).toBe(TileType.WALL);
      }
    }
  });

  it('keeps pillars solid to movement, line of sight, raycasts, and projectiles', () => {
    const dungeon = architecturalDungeon(27);
    let pillar: { x: number; y: number } | undefined;
    dungeon.decorations.forEach((row, y) => row.forEach((decoration, x) => { if (decoration === DungeonDecoration.PILLAR) pillar = { x, y }; }));
    expect(pillar).toBeDefined();
    const cell = pillar!;
    expect(dungeon.map[cell.y][cell.x]).toBe(TileType.WALL);
    expect(isWorldSolid(dungeon.map[cell.y][cell.x])).toBe(true);
    expect(canOccupyWorldPosition(dungeon.map, cell.x + 0.5, cell.y + 0.5, 0.18)).toBe(false);
    const horizontal = dungeon.map[cell.y][cell.x - 1] === TileType.EMPTY && dungeon.map[cell.y][cell.x + 1] === TileType.EMPTY;
    const start = horizontal ? { x: cell.x - 0.5, z: cell.y + 0.5 } : { x: cell.x + 0.5, z: cell.y - 0.5 };
    const end = horizontal ? { x: cell.x + 1.5, z: cell.y + 0.5 } : { x: cell.x + 0.5, z: cell.y + 1.5 };
    const dx = horizontal ? 1 : 0, dz = horizontal ? 0 : 1;
    const rayHit = raycastGrid(dungeon.map, start.x, start.z, dx, dz, 4);
    expect(rayHit).toMatchObject({ x: cell.x, y: cell.y, tile: TileType.WALL });
    expect(hasLineOfSight(dungeon.map, start.x, start.z, end.x, end.z)).toBe(false);

    const projectile: WorldProjectile = {
      id: 9001,
      position: { x: start.x, y: 0.72, z: start.z },
      velocity: { x: dx * 20, y: 0, z: dz * 20 },
      radius: 0.1,
      damage: 8,
      remainingSeconds: 1,
      sourceAbilityId: 'r6a_pillar_probe',
      color: '#d3aa68',
      faction: 'PLAYER',
    };
    const result = updateProjectiles([projectile], [], dungeon.map, 0.05);
    expect(result.projectiles).toHaveLength(0);
    expect(result.impacts.some(impact => impact.kind === 'world')).toBe(true);
  });

  it('spawns enemies in dodgeable combat rooms and keeps Guardians inside the clear arena', () => {
    for (let level = 1; level <= 5; level += 1) for (let seed = 0; seed < 8; seed += 1) {
      const world = createDungeonWorld(level, 77000 + level * 100 + seed);
      const enemies = spawnFloorEnemies(world.map, world.floor);
      const bossRoom = world.floor.rooms.find(room => room.type === 'BOSS')!;
      const combatCells = new Set(world.floor.rooms.filter(room => room.type === 'COMBAT' || room.type === 'ELITE').flatMap(room => room.cells.map(cellKey)));
      const guardian = enemies.filter(enemy => enemy.isBoss);
      expect(guardian).toHaveLength(1);
      const guardianCell = { x: Math.floor(guardian[0].position.x), y: Math.floor(guardian[0].position.z) };
      expect(bossRoom.cells.map(cellKey)).toContain(cellKey(guardianCell));
      for (const enemy of enemies) {
        expect(canOccupyWorldPosition(world.map, enemy.position.x, enemy.position.z, enemy.collisionRadius ?? 0.28)).toBe(true);
        expect(Math.hypot(enemy.position.x - 1.5, enemy.position.z - 1.5)).toBeGreaterThan((enemy.collisionRadius ?? 0.28) + 0.45);
        if (!enemy.isBoss) expect(combatCells.has(`${Math.floor(enemy.position.x)},${Math.floor(enemy.position.z)}`)).toBe(true);
      }
      expect(new Set(enemies.map(enemy => enemy.id)).size).toBe(enemies.length);
    }
  });

  it('mounts torches on real wall faces, bounds and flickers local lights, and disposes geometry', () => {
    setCanvasDocumentMock();
    const world = createDungeonWorld(3, 88123);
    const assets = new AssetManager();
    const geometry = new WorldGeometry(world, assets);
    const internal = geometry as unknown as { ownedGeometries: THREE.BufferGeometry[]; ownedMaterials: THREE.Material[] };
    const torchMeshes = geometry.group.children.filter(child => child.name.startsWith('WallMounted_wallTorch')) as THREE.Mesh[];
    expect(torchMeshes.length).toBeGreaterThan(0);
    for (const mesh of torchMeshes) {
      const match = mesh.name.match(/_(\d+)_(\d+)$/)!;
      const x = Number(match[1]), z = Number(match[2]);
      const mount = findWallMount(world.map, x, z)!;
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation);
      expect(world.map[z][x]).toBe(TileType.WALL);
      expect(normal.x).toBeCloseTo(mount.normalX);
      expect(normal.z).toBeCloseTo(mount.normalZ);
      expect(mesh.position.y).toBeCloseTo(1.58);
    }
    expect(geometry.group.children.some(child => child.name === 'RedLimestonePillars')).toBe(true);
    const lights = geometry.group.children.filter(child => child instanceof THREE.PointLight) as THREE.PointLight[];
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.length).toBeLessThanOrEqual(6);
    const childCount = geometry.group.children.length;
    const firstLight = lights[0];
    const originalIntensity = firstLight.intensity;
    geometry.updateLighting(1.2);
    expect(firstLight).toBe(lights[0]);
    expect(firstLight.intensity).not.toBe(originalIntensity);
    expect(geometry.group.children).toHaveLength(childCount);

    const geometryDisposals = internal.ownedGeometries.map(resource => vi.spyOn(resource, 'dispose'));
    const materialDisposals = internal.ownedMaterials.map(resource => vi.spyOn(resource, 'dispose'));
    geometry.dispose();
    expect(geometry.group.children).toHaveLength(0);
    expect(geometryDisposals.every(dispose => dispose.mock.calls.length === 1)).toBe(true);
    expect(materialDisposals.every(dispose => dispose.mock.calls.length === 1)).toBe(true);
    assets.dispose();
  });

  it('accepts old R4 style saves without architecture metadata and loads the stored map unchanged', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const legacy = generateDungeon('dungeon', 90127, 1, { mapSize: 23, guardianArenaRadius: 3, topology: 'LEGACY' });
    const guardianId = runtime.world.floor.guardianId!;
    const floor = { ...legacy.floor!, guardianId, guardianState: 'NOT_DISCOVERED' as const };
    const world = {
      level: 1,
      seed: 90127,
      biome: 'dungeon' as const,
      map: legacy.map.map(row => [...row]),
      decorations: legacy.decorations.map(row => [...row]),
      floor,
      explored: legacy.map.map((row, y) => row.map((_tile, x) => x === 1 && y === 1)),
      worldRevision: 1,
      mazeChronicle: { version: 1 as const, nextSequence: 1, events: [] },
    };
    const enemies = spawnFloorEnemies(world.map, floor);
    const storage = new MemoryStorage();
    const originalMap = world.map.map(row => [...row]);
    const originalDecorations = world.decorations.map(row => [...row]);
    expect(floor.architectureRooms).toBeUndefined();
    expect(isValidFloorState(floor, world.map)).toBe(true);
    const architectural = architecturalDungeon(90128, 1);
    expect(isValidFloorState(architectural.floor, architectural.map)).toBe(true);
    const withBadTheme = {
      ...architectural.floor!,
      architectureRooms: architectural.floor!.architectureRooms!.map((room, index) => index === 0 ? { ...room, lightingTheme: 'MAGENTA' } : room),
    };
    expect(isValidFloorState(withBadTheme, architectural.map)).toBe(false);
    const withDuplicateCells = {
      ...architectural.floor!,
      architectureRooms: architectural.floor!.architectureRooms!.map((room, index) => index === 0 ? { ...room, cells: [...room.cells, room.cells[0]] } : room),
    };
    expect(isValidFloorState(withDuplicateCells, architectural.map)).toBe(false);
    expect(saveMazeGame({ player: runtime.player, world, enemies, loot: [] }, storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.world.map).toEqual(originalMap);
    expect(loaded.save?.world.decorations).toEqual(originalDecorations);
    expect(loaded.save?.world.floor.architectureRooms).toBeUndefined();
    expect(storage.getItem(MAZE_SAVE_KEY)).not.toBeNull();
  });

  it('fits legacy and 23 by 23 maps to the minimap using their own grid coordinates', () => {
    const legacyLayout = fitMinimapLayout(120, 120, 12, 12);
    expect(legacyLayout.tileSize).toBe(10);
    expect(worldToMinimapPoint(11.5, 11.5, legacyLayout)).toEqual({ x: 115, y: 115 });
    const fpsLayout = fitMinimapLayout(120, 120, 23, 23);
    expect(fpsLayout.tileSize).toBeCloseTo(120 / 23);
    expect(worldToMinimapPoint(22.5, 22.5, fpsLayout).x).toBeCloseTo(22.5 / 23 * 120);
    const rectangular = fitMinimapLayout(120, 120, 20, 10);
    expect(rectangular.offsetY).toBe(30);
    expect(worldToMinimapPoint(0.5, 0.5, rectangular)).toEqual({ x: 3, y: 33 });
  });
});
