import { describe, expect, it } from 'vitest';
import { getUnlockedMazeLawPool, MAZE_LAW_META_SAVE_KEY, MAZE_LAWS } from '../data/mazeLaws';
import { createMinotaurLawModifierContract, isMinotaurLawModifierContract } from '../data/minotaurLawContract';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';
import { createLawDraft, createEmptyMazeLawProgress, selectMazeLaw } from '../services/lawDraft';
import { cellKey, reachableCells } from '../services/dungeonPlan';
import { loadMazeGame, MAZE_SAVE_KEY } from '../services/mazeSave';
import { isValidFloorState } from '../services/dungeonSave';
import type { KeyValueStorage } from '../services/fpsSave';
import type { ActiveMazeLaw, MazeLawId, MazeLawProgress } from '../types';
import { applyLivingLabyrinth } from '../world/LivingLabyrinth';
import { createDungeonWorld } from '../world/DungeonWorld';
import { spawnFloorEnemies } from '../world/EnemySpawner';
import { shouldReleasePointerLockForUi } from '../services/uiInputPolicy';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const makeActive = (lawId: MazeLawId, order = 1, floor = 1): ActiveMazeLaw => ({
  lawId, selectedAtFloor: floor, acquiredOrder: order, firstManifestedFloor: null, lastManifestedFloor: null, manifestationCount: 0,
});

const emptyInput = (pausePressed = false) => ({
  movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
  primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
  skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
  inventoryPressed: false, mapPressed: false, pausePressed,
});

function positionAtExit(runtime: FPSGameRuntime): void {
  const exit = runtime.world.floor.rooms.find(room => room.type === 'BOSS')!.anchor;
  const adjacent = [{ x: exit.x + 1, y: exit.y }, { x: exit.x - 1, y: exit.y }, { x: exit.x, y: exit.y + 1 }, { x: exit.x, y: exit.y - 1 }]
    .find(cell => runtime.world.map[cell.y]?.[cell.x] === 0)!;
  runtime.player = { ...runtime.player, position: { x: adjacent.x + 0.5, y: 0, z: adjacent.y + 0.5 }, rotation: { yaw: Math.atan2(exit.y - adjacent.y, exit.x - adjacent.x), pitch: 0 } };
}

describe('R6D1 deterministic Law draft and Living Labyrinth', () => {
  it('offers one stable, distinct Law from every category and supports small unlock pools', () => {
    const first = createLawDraft(98123, 'guardian_bronze_gatekeeper', 1);
    expect(createLawDraft(98123, 'guardian_bronze_gatekeeper', 1)).toEqual(first);
    expect(MAZE_LAWS).toHaveLength(9);
    expect(MAZE_LAW_META_SAVE_KEY).not.toBe(MAZE_SAVE_KEY);
    expect(getUnlockedMazeLawPool()).toHaveLength(9);
    const futureBossContract = createMinotaurLawModifierContract(MAZE_LAWS.map(law => law.lawId));
    expect(futureBossContract.modifierIds).toHaveLength(3);
    expect(isMinotaurLawModifierContract(futureBossContract)).toBe(true);
    expect(isMinotaurLawModifierContract({ version: 1, modifierIds: first.lawIds.concat(first.lawIds[0]) })).toBe(false);
    expect(first.lawIds).toHaveLength(3);
    expect(new Set(first.lawIds).size).toBe(3);
    expect(first.lawIds.map(id => MAZE_LAWS.find(law => law.lawId === id)?.category)).toEqual(['ROOM', 'CREATURE', 'CURSE']);
    expect(createLawDraft(1, 'guardian_bronze_gatekeeper', 1, ['vault_of_tyche', 'shades_of_styx', 'oath_of_ares']).lawIds)
      .toEqual(['vault_of_tyche', 'shades_of_styx', 'oath_of_ares']);
  });

  it('requires explicit replacement at capacity and never stacks the same Law', () => {
    const draft = { ...createLawDraft(72, 'guardian_bronze_gatekeeper', 4), lawIds: ['hall_of_echoes', 'arachnes_kin', 'oath_of_ares'] as [MazeLawId, MazeLawId, MazeLawId], open: true };
    const progress: MazeLawProgress = { version: 1, activeLaws: [makeActive('vault_of_tyche', 1), makeActive('bronze_hounds', 2), makeActive('serpents_bargain', 3)], choiceHistory: [], draft };
    expect(selectMazeLaw(progress, 'hall_of_echoes')).toBeNull();
    const selected = selectMazeLaw(progress, 'hall_of_echoes', 'vault_of_tyche')!;
    expect(selected.activeLaws).toHaveLength(3);
    expect(selected.activeLaws.map(law => law.lawId)).toEqual(['bronze_hounds', 'serpents_bargain', 'hall_of_echoes']);
    expect(selected.choiceHistory[0]).toMatchObject({ replacedLawId: 'vault_of_tyche', lawId: 'hall_of_echoes' });
    expect(selectMazeLaw(selected, 'arachnes_kin')).toBeNull();
  });

  it('manifests each of the nine Laws in a real next-floor room, spawn, hazard, reward, or combat rule', () => {
    for (const [index, definition] of MAZE_LAWS.entries()) {
      const world = createDungeonWorld(2, 51000 + index);
      const progress: MazeLawProgress = { ...createEmptyMazeLawProgress(), activeLaws: [makeActive(definition.lawId)] };
      const changed = applyLivingLabyrinth(world, progress);
      expect(changed.floor.manifestedLawIds).toContain(definition.lawId);
      expect(changed.floor.lawProgress?.activeLaws[0]).toMatchObject({ firstManifestedFloor: 2, lastManifestedFloor: 2, manifestationCount: 1 });
      if (definition.lawId === 'hall_of_echoes') {
        expect(changed.floor.rooms.some(room => room.lawId === definition.lawId && room.type === 'ELITE')).toBe(true);
        expect(changed.floor.lawSpawns?.some(spawn => spawn.lawId === definition.lawId && spawn.rewardBaseId === 'kopis')).toBe(true);
      } else if (definition.lawId === 'vault_of_tyche') {
        expect(changed.floor.rooms.some(room => room.lawId === definition.lawId && room.type === 'LOCKED')).toBe(true);
      } else if (definition.lawId === 'pillars_of_daedalus') {
        expect(changed.floor.architectureRooms?.some(room => room.roomArchetype === 'PILLARED_HALL' && room.landmarkIds.includes('daedalus_pillars'))).toBe(true);
        expect(changed.floor.lawSpawns?.some(spawn => spawn.lawId === definition.lawId)).toBe(true);
        expect(changed.map).not.toEqual(world.map);
      } else if (definition.lawId === 'bronze_hounds' || definition.lawId === 'arachnes_kin') {
        const spawn = changed.floor.lawSpawns?.find(entry => entry.lawId === definition.lawId);
        expect(spawn?.count).toBe(2);
        expect(spawn?.rewardBaseId).toBe(definition.lawId === 'bronze_hounds' ? 'bronze_hound_tooth' : 'antidote_flask');
        expect(spawnFloorEnemies(changed.map, changed.floor).filter(enemy => enemy.lawId === definition.lawId)).toHaveLength(2);
      } else if (definition.lawId === 'shades_of_styx') {
        expect(spawnFloorEnemies(changed.map, changed.floor).some(enemy => enemy.lawId === definition.lawId && enemy.lawRewardBaseId === 'styx_soul_essence')).toBe(true);
      } else if (definition.lawId === 'oath_of_ares') {
        expect(spawnFloorEnemies(changed.map, changed.floor).filter(enemy => !enemy.isBoss).every(enemy => enemy.attackCooldownMultiplier === 0.82)).toBe(true);
        expect(changed.floor.rooms.some(room => room.lawId === definition.lawId)).toBe(true);
      } else if (definition.lawId === 'serpents_bargain') {
        expect(changed.floor.lawHazards).toHaveLength(1);
        expect(changed.floor.lawHazards?.[0]).toMatchObject({ lawId: definition.lawId, rewardBaseId: 'antidote_flask' });
      } else {
        const secret = changed.floor.rooms.find(room => room.lawId === definition.lawId && room.type === 'SECRET');
        expect(secret).toBeTruthy();
        expect(changed.map[secret!.gate!.y][secret!.gate!.x]).toBe(5);
        expect(changed.map[secret!.anchor.y][secret!.anchor.x]).toBe(0);
      }
      const reachable = new Set(reachableCells(changed.map).map(cellKey));
      const boss = changed.floor.rooms.find(room => room.type === 'BOSS')!;
      expect(reachable.has(cellKey(boss.anchor))).toBe(true);
      expect(isValidFloorState(changed.floor, changed.map)).toBe(true);
    }
  });

  it('keeps every Law bounded and the Guardian route reachable across seeded R6A floors', () => {
    for (const [lawIndex, law] of MAZE_LAWS.entries()) for (let seed = 0; seed < 12; seed += 1) {
      const world = createDungeonWorld(2, 140000 + lawIndex * 101 + seed);
      const progress: MazeLawProgress = { ...createEmptyMazeLawProgress(), activeLaws: [makeActive(law.lawId)] };
      const changed = applyLivingLabyrinth(world, progress);
      const reachable = new Set(reachableCells(changed.map).map(cellKey));
      const guardianRoom = changed.floor.rooms.find(room => room.type === 'BOSS')!;
      expect(changed.floor.manifestedLawIds).toContain(law.lawId);
      expect(reachable.has(cellKey(guardianRoom.anchor))).toBe(true);
      expect(changed.map.flat().filter(tile => tile === 3)).toHaveLength(1);
      expect(changed.floor.lawSpawns?.reduce((sum, spawn) => sum + spawn.count, 0) ?? 0).toBeLessThanOrEqual(5);
      expect(changed.floor.lawHazards?.length ?? 0).toBeLessThanOrEqual(1);
      expect(isValidFloorState(changed.floor, changed.map)).toBe(true);
    }
  });

  it('keeps the exit open until selection, preserves a canceled draft, and manifests the selected Law after descending', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    positionAtExit(runtime);
    const guardianId = runtime.world.floor.guardianId!;
    runtime.world = { ...runtime.world, floor: { ...runtime.world.floor, guardianState: 'DESCENT_UNLOCKED' } };
    runtime.enemies = runtime.enemies.map(enemy => enemy.definitionId === guardianId ? { ...enemy, health: 0, rewardGranted: true, state: 'DEAD' } : enemy);
    runtime.interact();
    const firstOffer = runtime.getSnapshot().lawOffer!;
    expect(firstOffer.lawIds).toHaveLength(3);
    expect(runtime.world.level).toBe(1);
    const storage = new MemoryStorage();
    expect(runtime.save(storage)).toBe(true);
    const resumed = new FPSGameRuntime('BARBARIAN', loadMazeGame(storage).save!);
    expect(resumed.getSnapshot().lawOffer?.lawIds).toEqual(firstOffer.lawIds);
    resumed.update(0.016, emptyInput(true));
    expect(resumed.getSnapshot().lawOffer).toBeNull();
    expect(resumed.world.floor.lawProgress?.draft?.lawIds).toEqual(firstOffer.lawIds);
    resumed.interact();
    const lawId = resumed.getSnapshot().lawOffer!.lawIds[0];
    expect(resumed.selectLaw(lawId)).toBe(true);
    expect(resumed.selectLaw(lawId)).toBe(false);
    expect(resumed.world.level).toBe(1);
    expect(resumed.save(storage)).toBe(true);
    const chosen = loadMazeGame(storage).save!;
    expect(chosen.world.floor.lawProgress?.draft?.selectedLawId).toBe(lawId);
    expect(chosen.world.floor.lawProgress?.activeLaws).toHaveLength(1);
    resumed.interact();
    expect(resumed.world.level).toBe(2);
    expect(resumed.world.floor.lawProgress?.activeLaws.map(law => law.lawId)).toEqual([lawId]);
    expect(resumed.world.floor.manifestedLawIds).toContain(lawId);
    expect(resumed.save(storage)).toBe(true);
    expect(loadMazeGame(storage).save?.world.floor.manifestedLawIds).toContain(lawId);
    expect(shouldReleasePointerLockForUi({ inventoryOpen: false, mapOpen: false, paused: false, levelUpOpen: false, roomOfferOpen: false, lawOfferOpen: true, gameOver: false })).toBe(true);
  });

  it('migrates an R6C v5 save to v7 without losing items or rerolling a defeated Guardian draft', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const storage = new MemoryStorage();
    const guardianId = runtime.world.floor.guardianId!;
    const draft = createLawDraft(runtime.world.floor.seed, guardianId, runtime.world.level);
    runtime.world = { ...runtime.world, floor: { ...runtime.world.floor, guardianState: 'DESCENT_UNLOCKED', lawProgress: { ...createEmptyMazeLawProgress(), draft } } };
    runtime.enemies = runtime.enemies.map(enemy => enemy.definitionId === guardianId ? { ...enemy, health: 0, rewardGranted: true, state: 'DEAD' } : enemy);
    expect(runtime.save(storage)).toBe(true);
    const v6 = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!);
    const itemIds = [...v6.player.inventory, ...Object.values(v6.player.equipment).filter(Boolean), ...v6.loot.map((drop: { item: { instanceId: string } }) => drop.item)].map((item: { instanceId: string }) => item.instanceId).sort();
    const v5 = { ...v6, version: 5, world: { ...v6.world, floor: { ...v6.world.floor } } };
    delete v5.world.floor.lawProgress;
    delete v5.world.floor.lawSpawns;
    delete v5.world.floor.lawHazards;
    delete v5.world.floor.manifestedLawIds;
    storage.setItem(MAZE_SAVE_KEY, JSON.stringify(v5));
    const result = loadMazeGame(storage);
    expect(result.invalid).toBe(false);
    expect(result.migratedFromR6C).toBe(true);
    expect(result.save?.version).toBe(7);
    expect(result.save?.world.floor.lawProgress?.draft?.lawIds).toEqual(draft.lawIds);
    const migratedIds = [...result.save!.player.inventory, ...Object.values(result.save!.player.equipment).filter(Boolean), ...result.save!.loot.map(drop => drop.item)].map(item => item!.instanceId).sort();
    expect(migratedIds).toEqual(itemIds);
  });
});
