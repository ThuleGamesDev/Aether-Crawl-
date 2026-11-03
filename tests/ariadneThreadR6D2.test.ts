import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { generateDungeon } from '../services/dungeonGenerator';
import { reachableCells, cellKey } from '../services/dungeonPlan';
import { loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import { createAriadneThreadProgress, openThreadAnchor, planAriadneThreadEdit, validateAriadneThreadFloor } from '../services/ariadneThread';
import { shouldReleasePointerLockForUi } from '../services/uiInputPolicy';
import { AssetManager } from '../presentation/AssetManager';
import { WorldGeometry } from '../world/WorldGeometry';
import { createDungeonWorld, createFloorEnemies } from '../world/DungeonWorld';
import { hasLineOfSight, isWorldSolid } from '../world/CollisionWorld';
import { TileType, type AriadneThreadAction } from '../types';
import type { KeyValueStorage } from '../services/fpsSave';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function generatedFloor(seed: number, level = 2) {
  return generateDungeon('dungeon', seed, level, { mapSize: 23, guardianArenaRadius: 3, topology: 'ARCHITECTURAL' });
}

function contextFor(floor: NonNullable<ReturnType<typeof generatedFloor>['floor']>, map: number[][], action: AriadneThreadAction) {
  const junction = floor.threadJunctions![0];
  const progress = openThreadAnchor(floor.threadProgress ?? createAriadneThreadProgress(floor.threadJunctions ?? []), junction.id)!;
  const openedFloor = { ...floor, threadProgress: progress };
  return {
    context: {
      map,
      decorations: Array.from({ length: map.length }, () => Array<number>(map[0].length).fill(0)),
      floor: openedFloor,
      junctionId: junction.id,
      action,
      lawIds: [],
      player: { x: junction.anchorPosition.x + 0.5, z: junction.anchorPosition.y + 0.5, health: 100, maxHealth: 100 },
      enemies: [],
      projectiles: [],
      loot: [],
      playerActionActive: false,
    },
    junction,
  };
}

describe('R6D2 Ariadne Thread', () => {
  it('keeps prepared anchors within the floors 2–5 pilot', () => {
    expect(generatedFloor(917, 1).floor!.threadJunctions).toEqual([]);
    expect(generatedFloor(619, 6).floor!.threadJunctions).toEqual([]);
  });

  it('generates one deterministic, stable, two-route anchor on floors 2–5', () => {
    for (let level = 2; level <= 5; level += 1) for (let seed = 0; seed < 40; seed += 1) {
      const first = generatedFloor(seed * 7919 + level * 101, level);
      const second = generatedFloor(seed * 7919 + level * 101, level);
      const junctions = first.floor!.threadJunctions!;
      expect(junctions).toHaveLength(1);
      expect(junctions).toEqual(second.floor!.threadJunctions);
      expect(first.map).toEqual(second.map);
      const junction = junctions[0];
      expect(junction.id).toBe(`thread_${level}_${first.floor!.seed}_0`);
      expect(junction.revealRoute.id).toBe(junctions[0].revealRoute.id);
      expect(junction.revealRoute.direction).not.toBe(junction.sealRoute.direction);
      expect(junction.revealRoute.cells.length).toBeGreaterThan(0);
      expect(junction.sealRoute.cells.length).toBeGreaterThan(0);
      expect(junction.revealRoute.cells.every(cell => first.map[cell.y][cell.x] === TileType.WALL)).toBe(true);
      expect(junction.sealRoute.cells.every(cell => first.map[cell.y][cell.x] === TileType.EMPTY)).toBe(true);
      expect(first.floor!.architectureRooms!.find(room => room.id === junction.anchorRoomId)?.threadJunctionId).toBe(junction.id);
      expect(validateAriadneThreadFloor(junctions, first.floor!.threadProgress, first.map, first.floor!.architectureRooms, first.floor!.rooms)).toBe(true);
      for (const action of ['REVEAL_PASSAGE', 'SEAL_PASSAGE'] as const) {
        const { context } = contextFor(first.floor!, first.map, action);
        const plan = planAriadneThreadEdit(context);
        expect(plan.ok, `${action} on floor ${level}, seed ${first.floor!.seed}: ${plan.reason ?? 'unknown rejection'}`).toBe(true);
      }
    }
  });

  it.each(['REVEAL_PASSAGE', 'SEAL_PASSAGE'] as const)('%s preserves required reachability and applies only its prepared cells', action => {
    const generated = generatedFloor(action === 'REVEAL_PASSAGE' ? 7123 : 8819, 3);
    const { context, junction } = contextFor(generated.floor!, generated.map, action);
    const route = action === 'REVEAL_PASSAGE' ? junction.revealRoute : junction.sealRoute;
    const before = new Set(reachableCells(generated.map).map(cellKey));
    const plan = planAriadneThreadEdit(context);
    expect(plan.ok).toBe(true);
    expect(plan.map).toBeDefined();
    const after = new Set(reachableCells(plan.map!).map(cellKey));
    for (const cell of before) if (!route.cells.some(changed => cellKey(changed) === cell)) expect(after.has(cell)).toBe(true);
    expect(route.cells.every(cell => plan.map![cell.y][cell.x] === (action === 'REVEAL_PASSAGE' ? TileType.EMPTY : TileType.WALL))).toBe(true);
    expect(plan.progress?.charges).toBe(1);
    expect(plan.progress?.topologyRevision).toBe(1);
    expect(validateAriadneThreadFloor(context.floor.threadJunctions, plan.progress, plan.map!, context.floor.architectureRooms, context.floor.rooms)).toBe(true);
    for (const room of context.floor.rooms.filter(candidate => candidate.type === 'BOSS' || candidate.type === 'BOSS_ANTECHAMBER')) {
      expect(after.has(cellKey(room.anchor))).toBe(true);
    }
  });

  it('keeps charges and health unchanged on invalid routes, low charges, and nearby ground blockers', () => {
    const generated = generatedFloor(24017, 3);
    const { context, junction } = contextFor(generated.floor!, generated.map, 'SEAL_PASSAGE');
    const noCharges = { ...context, floor: { ...context.floor, threadProgress: { ...context.floor.threadProgress!, charges: 0 } } };
    const denied = planAriadneThreadEdit(noCharges);
    expect(denied.ok).toBe(false);
    expect(denied.progress).toBeUndefined();
    expect(noCharges.floor.threadProgress?.charges).toBe(0);
    const blockedCell = junction.sealRoute.cells[0];
    const groundItemBlocked = planAriadneThreadEdit({ ...context, loot: [{ x: blockedCell.x + 0.5, z: blockedCell.y + 0.5 }] });
    expect(groundItemBlocked.ok).toBe(false);
    expect(groundItemBlocked.reason).toContain('ground items');
    const corruptedMap = generated.map.map(row => [...row]);
    corruptedMap[blockedCell.y][blockedCell.x] = TileType.WALL;
    const staleRoute = planAriadneThreadEdit({ ...context, map: corruptedMap });
    expect(staleRoute.ok).toBe(false);
    expect(context.floor.threadProgress?.charges).toBe(2);
    const protectedCell = junction.sealRoute.cells[0];
    const protectedFloor = { ...context.floor, rooms: [...context.floor.rooms, {
      ...context.floor.rooms[0], id: 'thread-protected-secret', type: 'SECRET' as const,
      anchor: { ...protectedCell }, cells: [{ ...protectedCell }], gate: { ...protectedCell },
    }] };
    const protectedGate = planAriadneThreadEdit({ ...context, floor: protectedFloor });
    expect(protectedGate.ok).toBe(false);
    expect(protectedGate.reason).toContain('protected room');
    expect(context.floor.threadProgress?.charges).toBe(2);
  });

  it('uses Broken Thread law data for free reveal charges plus the declared health cost', () => {
    const generated = generatedFloor(4127, 3);
    const { context, junction } = contextFor(generated.floor!, generated.map, 'REVEAL_PASSAGE');
    const lawContext = { ...context, lawIds: ['broken_thread'] as const };
    const plan = planAriadneThreadEdit(lawContext);
    expect(plan.ok).toBe(true);
    expect(plan.chargeCost).toBe(0);
    expect(plan.healthCost).toBe(5);
    expect(plan.progress?.charges).toBe(2);
    expect(junction.revealRoute.cells.every(cell => plan.map![cell.y][cell.x] === TileType.EMPTY)).toBe(true);
  });

  it('reconciles collision, visibility, path caches, and the saved floor after an atomic runtime weave', () => {
    const runtime = new FPSGameRuntime('ROGUE');
    const world = createDungeonWorld(2, 36017);
    const junction = world.floor.threadJunctions![0];
    runtime.world = world;
    runtime.enemies = createFloorEnemies(world).map(enemy => ({ ...enemy, pathStep: { x: 4, y: 4 }, pathTargetCell: { x: 5, y: 5 }, pathRefreshSeconds: 4 }));
    runtime.projectiles = [];
    runtime.player = { ...runtime.player, position: { x: junction.anchorPosition.x + 0.5, y: 0, z: junction.anchorPosition.y + 0.5 }, stats: { ...runtime.player.stats, hp: 100 } };
    expect(runtime.openThreadAnchor(junction.id)).toBe(true);
    expect(runtime.getSnapshot().threadOffer?.choices.every(choice => choice.enabled)).toBe(true);
    const route = junction.revealRoute;
    const routeCell = route.cells[0];
    expect(isWorldSolid(world.map[routeCell.y][routeCell.x])).toBe(true);
    const start = { x: junction.anchorPosition.x + 0.5, z: junction.anchorPosition.y + 0.5 };
    const direction = route.direction === 'EAST' ? { x: 1, z: 0 } : route.direction === 'WEST' ? { x: -1, z: 0 } : route.direction === 'NORTH' ? { x: 0, z: -1 } : { x: 0, z: 1 };
    const orderedRoute = [...route.cells].sort((a, b) => route.direction === 'EAST' ? a.x - b.x : route.direction === 'WEST' ? b.x - a.x : route.direction === 'SOUTH' ? a.y - b.y : b.y - a.y);
    const first = orderedRoute[0], last = orderedRoute[orderedRoute.length - 1];
    const startPoint = { x: first.x - direction.x + 0.5, z: first.y - direction.z + 0.5 };
    const end = { x: last.x + direction.x + 0.5, z: last.y + direction.z + 0.5 };
    expect(isWorldSolid(world.map[Math.floor(startPoint.z)][Math.floor(startPoint.x)])).toBe(false);
    expect(isWorldSolid(world.map[Math.floor(end.z)][Math.floor(end.x)])).toBe(false);
    expect(hasLineOfSight(world.map, startPoint.x, startPoint.z, end.x, end.z)).toBe(false);
    const revision = world.worldRevision;
    expect(runtime.chooseThreadRoute('REVEAL_PASSAGE')).toBe(true);
    expect(runtime.world.worldRevision).toBe(revision + 1);
    expect(runtime.world.map[routeCell.y][routeCell.x]).toBe(TileType.EMPTY);
    expect(isWorldSolid(runtime.world.map[routeCell.y][routeCell.x])).toBe(false);
    expect(hasLineOfSight(runtime.world.map, startPoint.x, startPoint.z, end.x, end.z)).toBe(true);
    expect(runtime.enemies.every(enemy => enemy.pathStep === undefined && enemy.pathTargetCell === undefined && enemy.pathRefreshSeconds === 0)).toBe(true);
    expect(runtime.world.floor.threadProgress?.charges).toBe(1);
    expect(runtime.world.floor.threadProgress?.junctionChoices).toHaveLength(1);
    expect(runtime.getRenderState().events.some(event => event.kind === 'impact' && event.effectId === 'ariadne_thread')).toBe(true);

    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.invalid).toBe(false);
    expect(loaded.save?.world.map).toEqual(runtime.world.map);
    expect(loaded.save?.world.floor.threadProgress).toEqual(runtime.world.floor.threadProgress);
    expect(loaded.save?.world.floor.threadJunctions).toEqual(runtime.world.floor.threadJunctions);
  });

  it('migrates a version-6 save without changing its map or rerolling a floor', () => {
    const runtime = new FPSGameRuntime('ROGUE');
    const run = runtime.getSnapshot();
    const storage = new MemoryStorage();
    const freshStorage = new MemoryStorage();
    expect(runtime.save(freshStorage)).toBe(true);
    const v7 = JSON.parse(freshStorage.getItem(MAZE_SAVE_KEY)!);
    const oldMap = structuredClone(v7.world.map);
    v7.version = 6;
    delete v7.world.floor.threadJunctions;
    delete v7.world.floor.threadProgress;
    storage.setItem(MAZE_SAVE_KEY, JSON.stringify(v7));
    const migrated = loadMazeGame(storage);
    expect(migrated.migratedFromR6D1).toBe(true);
    expect(migrated.migrationRequired).toBe(true);
    expect(migrated.save?.version).toBe(7);
    expect(migrated.save?.world.map).toEqual(oldMap);
    expect(migrated.save?.world.floor.threadJunctions).toEqual([]);
    expect(migrated.save?.world.floor.threadProgress?.charges).toBe(2);
    expect(run.world.map).toEqual(oldMap);
  });

  it('releases pointer lock for the route choice overlay and disposes anchor geometry', () => {
    expect(shouldReleasePointerLockForUi({ inventoryOpen: false, mapOpen: false, paused: false, levelUpOpen: false, roomOfferOpen: false, threadOfferOpen: true, gameOver: false })).toBe(true);
    const context = new Proxy({}, { get: () => () => undefined, set: () => true });
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
    const world = createDungeonWorld(2, 8103);
    const geometry = new WorldGeometry(world, new AssetManager());
    const anchor = geometry.group.getObjectByName('ThreadAnchor_' + world.floor.threadJunctions![0].id) as THREE.Mesh;
    expect(anchor).toBeDefined();
    const owned = geometry as unknown as { ownedGeometries: THREE.BufferGeometry[]; ownedMaterials: THREE.Material[]; ownedTextures: THREE.Texture[] };
    const geometries = new Set(owned.ownedGeometries);
    const materials = new Set(owned.ownedMaterials);
    const textures = new Set(owned.ownedTextures);
    expect(geometries.has(anchor.geometry)).toBe(true);
    const geometrySpies = [...geometries].map(resource => vi.spyOn(resource, 'dispose'));
    const materialSpies = [...materials].map(resource => vi.spyOn(resource, 'dispose'));
    const textureSpies = [...textures].map(resource => vi.spyOn(resource, 'dispose'));
    geometry.dispose();
    expect(geometrySpies.length).toBeGreaterThan(0);
    expect(geometrySpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.length).toBeGreaterThan(0);
    expect(materialSpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
    expect(textureSpies.length).toBeGreaterThan(0);
    expect(textureSpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
    vi.unstubAllGlobals();
  });
});
