import { describe, expect, it } from 'vitest';
import { MAZE_LAWS } from '../data/mazeLaws';
import { MAZE_LAW_SYNERGIES, resolveMazeLawSynergies, validateMazeLawSynergyRegistry } from '../data/lawSynergies';
import { createMinotaurInheritancePlan, isMinotaurInheritancePlan } from '../data/minotaurLawContract';
import { createMazeChronicle, MAX_MAZE_CHRONICLE_EVENTS, recordMazeChronicleEvent, validateMazeChronicle } from '../services/mazeChronicle';
import { buildThreadAnchorOffer, createAriadneThreadProgress, openThreadAnchor } from '../services/ariadneThread';
import { isValidFloorState } from '../services/dungeonSave';
import { createLawDraft } from '../services/lawDraft';
import { loadMazeGame, MAZE_SAVE_KEY, saveMazeGame } from '../services/mazeSave';
import type { ActiveMazeLaw, MazeLawId, MazeLawProgress } from '../types';
import type { KeyValueStorage } from '../services/fpsSave';
import { applyLivingLabyrinth } from '../world/LivingLabyrinth';
import { createDungeonWorld } from '../world/DungeonWorld';
import { spawnFloorEnemies } from '../world/EnemySpawner';
import { TileType } from '../types';
import { FPSGameRuntime } from '../engine/FPSGameRuntime';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function activeLaw(lawId: MazeLawId, acquiredOrder: number): ActiveMazeLaw {
  return { lawId, selectedAtFloor: acquiredOrder, acquiredOrder, firstManifestedFloor: null, lastManifestedFloor: null, manifestationCount: 0 };
}

function applyPair(first: MazeLawId, second: MazeLawId, seed = 77231) {
  const world = createDungeonWorld(2, seed);
  const progress: MazeLawProgress = {
    version: 1,
    activeLaws: [activeLaw(first, 1), activeLaw(second, 2)],
    choiceHistory: [],
  };
  return applyLivingLabyrinth(world, progress);
}

describe('R6D3 Law synergies and Minotaur inheritance contract', () => {
  it('keeps synergy IDs stable, unique, deterministic, and explicitly paired', () => {
    expect(MAZE_LAW_SYNERGIES).toHaveLength(3);
    expect(validateMazeLawSynergyRegistry()).toBe(true);
    expect(new Set(MAZE_LAW_SYNERGIES.map(synergy => synergy.synergyId)).size).toBe(MAZE_LAW_SYNERGIES.length);
    expect(resolveMazeLawSynergies(['hall_of_echoes', 'bronze_hounds']).map(synergy => synergy.synergyId)).toEqual(['echo_pack']);
    expect(resolveMazeLawSynergies(['oath_of_ares', 'pillars_of_daedalus']).map(synergy => synergy.synergyId)).toEqual(['ares_pillar_arena']);
    expect(resolveMazeLawSynergies(['serpents_bargain', 'arachnes_kin']).map(synergy => synergy.synergyId)).toEqual(['venom_nest']);
    expect(resolveMazeLawSynergies(['hall_of_echoes', 'bronze_hounds', 'shades_of_styx'])).toEqual([]);
    expect(resolveMazeLawSynergies(['hall_of_echoes', 'bronze_hounds', 'oath_of_ares', 'pillars_of_daedalus'])).toEqual([]);
    expect(resolveMazeLawSynergies(['hall_of_echoes', 'hall_of_echoes'])).toEqual([]);
    expect(resolveMazeLawSynergies(['hall_of_echoes', 'unknown_law'])).toEqual([]);
  });

  it('places Echo Remnant and Bronze Hounds together with three bounded spawns and distinct once-only rewards', () => {
    const first = applyPair('hall_of_echoes', 'bronze_hounds');
    const repeated = applyPair('hall_of_echoes', 'bronze_hounds');
    const room = first.floor.rooms.find(candidate => candidate.synergyId === 'echo_pack')!;
    const spawns = first.floor.lawSpawns!.filter(spawn => spawn.roomId === room.id);
    expect(first.floor).toEqual(repeated.floor);
    expect(first.floor.manifestedSynergyIds).toEqual(['echo_pack']);
    expect(room.lawIds).toEqual(expect.arrayContaining(['hall_of_echoes', 'bronze_hounds']));
    expect(spawns.reduce((sum, spawn) => sum + spawn.count, 0)).toBe(3);
    expect(new Set(spawns.map(spawn => spawn.rewardBaseId))).toEqual(new Set(['kopis', 'bronze_hound_tooth']));
    const enemies = spawnFloorEnemies(first.map, first.floor).filter(enemy => enemy.roomId === room.id && enemy.lawId);
    expect(enemies).toHaveLength(3);
    expect(enemies.filter(enemy => enemy.lawRewardBaseId)).toHaveLength(2);
    expect(first.floor.threadJunctions).toEqual(createDungeonWorld(2, 77231).floor.threadJunctions);
    expect(first.floor.threadProgress).toEqual(createAriadneThreadProgress(first.floor.threadJunctions ?? []));
    expect(isValidFloorState(first.floor, first.map)).toBe(true);
  });

  it('combines Ares cadence with Daedalus cover while retaining the existing parry reward and Thread routes', () => {
    const base = createDungeonWorld(2, 77501);
    const changed = applyPair('oath_of_ares', 'pillars_of_daedalus', 77501);
    const room = changed.floor.rooms.find(candidate => candidate.synergyId === 'ares_pillar_arena')!;
    const architecture = changed.floor.architectureRooms?.find(candidate => candidate.synergyId === 'ares_pillar_arena');
    const lawSpawn = changed.floor.lawSpawns?.find(spawn => spawn.roomId === room.id);
    expect(room.lawIds).toEqual(expect.arrayContaining(['oath_of_ares', 'pillars_of_daedalus']));
    expect(architecture?.roomArchetype).toBe('ARES_PILLAR_ARENA');
    expect(architecture?.landmarkIds).toEqual(expect.arrayContaining(['daedalus_pillars', 'ares_red_sigil']));
    expect(lawSpawn).toMatchObject({ lawId: 'pillars_of_daedalus', definitionId: 'skeleton_warrior', count: 1, rewardBaseId: 'bronze_cuirass' });
    expect(spawnFloorEnemies(changed.map, changed.floor).filter(enemy => !enemy.isBoss).every(enemy => enemy.attackCooldownMultiplier === 0.82)).toBe(true);
    expect(changed.floor.threadProgress).toEqual(base.floor.threadProgress);
    expect(changed.floor.threadJunctions).toEqual(base.floor.threadJunctions);
    expect(changed.floor.threadJunctions?.every(junction => [...junction.revealRoute.cells, ...junction.sealRoute.cells].every(cell => changed.map[cell.y][cell.x] === (junction.revealRoute.cells.some(routeCell => routeCell.x === cell.x && routeCell.y === cell.y) ? TileType.WALL : TileType.EMPTY)))).toBe(true);
    const junctionId = base.floor.threadJunctions![0].id;
    const openProgress = openThreadAnchor(base.floor.threadProgress!, junctionId)!;
    const threadFloor = { ...base.floor, threadProgress: openProgress };
    const offerBase = buildThreadAnchorOffer({ map: base.map, floor: threadFloor, junctionId, lawIds: [], player: { x: 11.5, z: 11.5, health: 100, maxHealth: 100 }, playerActionActive: false });
    const offerSynergy = buildThreadAnchorOffer({ map: base.map, floor: threadFloor, junctionId, lawIds: ['oath_of_ares', 'pillars_of_daedalus'], player: { x: 11.5, z: 11.5, health: 100, maxHealth: 100 }, playerActionActive: false });
    expect(offerSynergy?.choices.map(choice => [choice.cost, choice.healthCost])).toEqual(offerBase?.choices.map(choice => [choice.cost, choice.healthCost]));
    expect(isValidFloorState(changed.floor, changed.map)).toBe(true);
  });

  it('keeps the Venom Nest to one poison pool and one visible Antidote offer', () => {
    const changed = applyPair('serpents_bargain', 'arachnes_kin', 77903);
    const room = changed.floor.rooms.find(candidate => candidate.synergyId === 'venom_nest')!;
    const spawns = changed.floor.lawSpawns!.filter(spawn => spawn.roomId === room.id);
    expect(changed.floor.lawHazards).toHaveLength(1);
    expect(changed.floor.lawHazards?.[0]).toMatchObject({ lawId: 'serpents_bargain', roomId: room.id, synergyId: 'venom_nest', rewardBaseId: 'antidote_flask' });
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ lawId: 'arachnes_kin', count: 2 });
    expect(spawns[0].rewardBaseId).toBeUndefined();
    expect(spawnFloorEnemies(changed.map, changed.floor).filter(enemy => enemy.lawId === 'arachnes_kin' && enemy.lawRewardBaseId)).toHaveLength(0);
    expect(changed.floor.lawHazards?.filter(hazard => hazard.rewardBaseId === 'antidote_flask')).toHaveLength(1);
    expect(isValidFloorState(changed.floor, changed.map)).toBe(true);
  });

  it('builds a deterministic future Minotaur plan with a playable arena and collapsed venom proc risk', () => {
    const ids: MazeLawId[] = ['serpents_bargain', 'arachnes_kin', 'oath_of_ares'];
    const plan = createMinotaurInheritancePlan(ids);
    expect(plan).toEqual(createMinotaurInheritancePlan(ids));
    expect(plan.activeLawIds).toHaveLength(3);
    expect(plan.modifierIds).toHaveLength(2);
    expect(plan.arenaRuleIds).toEqual(expect.arrayContaining(['CLEAR_COMBAT_FLOOR', 'SINGLE_VISIBLE_ENTRY', 'NO_ROUTE_EDITS']));
    expect(plan.phaseOptions).toHaveLength(2);
    expect(plan.encounterBudget).toMatchObject({ maxConcurrentAdds: 0, maxHazards: 1, maxStatusProcsPerHit: 1 });
    expect(isMinotaurInheritancePlan(plan)).toBe(true);
    expect(isMinotaurInheritancePlan({ ...plan, arenaRuleIds: ['CLEAR_COMBAT_FLOOR'] })).toBe(false);
    expect(isMinotaurInheritancePlan({ ...plan, activeLawIds: ['oath_of_ares', 'oath_of_ares'] })).toBe(false);
    expect('enemyId' in plan).toBe(false);
    expect(MAZE_LAWS).toHaveLength(9);
    expect(() => createMinotaurInheritancePlan(['oath_of_ares', 'serpents_bargain', 'arachnes_kin', 'broken_thread'])).toThrow();
  });
});

describe('R6D3 bounded Maze Chronicle', () => {
  it('deduplicates, bounds, validates, and serializes run-local events', () => {
    let chronicle = createMazeChronicle();
    chronicle = recordMazeChronicleEvent(chronicle, { kind: 'LAW_CHOSEN', floor: 1, lawId: 'hall_of_echoes', offerId: 'loom_1_test' });
    const same = recordMazeChronicleEvent(chronicle, { kind: 'LAW_CHOSEN', floor: 1, lawId: 'hall_of_echoes', offerId: 'loom_1_test' });
    expect(same).toBe(chronicle);
    for (let floor = 1; floor <= 100; floor += 1) chronicle = recordMazeChronicleEvent(chronicle, { kind: 'LAW_MANIFESTED', floor, lawId: 'hall_of_echoes' });
    expect(chronicle.events).toHaveLength(MAX_MAZE_CHRONICLE_EVENTS);
    expect(validateMazeChronicle(chronicle)).toBe(true);
    expect(validateMazeChronicle(JSON.parse(JSON.stringify(chronicle)))).toBe(true);
    expect(validateMazeChronicle({ ...chronicle, events: [...chronicle.events, chronicle.events[0]] })).toBe(false);
  });

  it('preserves the Chronicle through save/load and migrates R6D2 version-7 saves without changing the floor', () => {
    const storage = new MemoryStorage();
    const runtime = new FPSGameRuntime('BARBARIAN');
    let chronicle = createMazeChronicle();
    chronicle = recordMazeChronicleEvent(chronicle, { kind: 'LAW_CHOSEN', floor: 1, lawId: 'hall_of_echoes', offerId: 'loom_1_test' });
    const world = { ...runtime.world, mazeChronicle: chronicle };
    expect(saveMazeGame({ player: runtime.player, world, enemies: runtime.enemies, loot: runtime.loot }, storage)).toBe(true);
    const loaded = loadMazeGame(storage);
    expect(loaded.save?.world.mazeChronicle).toEqual(chronicle);
    const saved = JSON.parse(storage.getItem(MAZE_SAVE_KEY)!) as Record<string, unknown>;
    const legacyWorld = { ...(saved.world as Record<string, unknown>) };
    delete legacyWorld.mazeChronicle;
    storage.setItem(MAZE_SAVE_KEY, JSON.stringify({ ...saved, version: 7, world: legacyWorld }));
    const migrated = loadMazeGame(storage);
    expect(migrated.migratedFromR6D2).toBe(true);
    expect(migrated.migrationRequired).toBe(true);
    expect(migrated.save?.version).toBe(8);
    expect(migrated.save?.world.map).toEqual(runtime.world.map);
    expect(migrated.save?.world.mazeChronicle.events).toEqual([]);
  });

  it('keeps only discoveries and consequences that the run actually recorded', () => {
    let chronicle = createMazeChronicle();
    expect(chronicle.events).toEqual([]);
    chronicle = recordMazeChronicleEvent(chronicle, { kind: 'ROOM_FAMILY_DISCOVERED', floor: 2, familyId: 'ELITE' });
    chronicle = recordMazeChronicleEvent(chronicle, { kind: 'SYNERGY_MANIFESTED', floor: 2, synergyId: 'echo_pack' });
    expect(chronicle.events.map(event => event.kind)).toEqual(['ROOM_FAMILY_DISCOVERED', 'SYNERGY_MANIFESTED']);
    expect(chronicle.events.some(event => event.kind === 'ROOM_FAMILY_DISCOVERED' && event.familyId === 'SECRET')).toBe(false);
  });

  it('records two Guardian Law choices and reveals their paired consequence only when encountered', () => {
    const runtime = new FPSGameRuntime('BARBARIAN');
    const pairPool: MazeLawId[] = ['hall_of_echoes', 'bronze_hounds', 'oath_of_ares'];
    const firstDraft = { ...createLawDraft(runtime.world.seed, runtime.world.floor.guardianId!, 1, pairPool), open: true };
    runtime.world = { ...runtime.world, floor: { ...runtime.world.floor, lawProgress: { version: 1, activeLaws: [], choiceHistory: [], draft: firstDraft } } };
    expect(runtime.selectLaw('hall_of_echoes')).toBe(true);

    const secondBase = createDungeonWorld(2, 78731);
    const secondDraft = { ...createLawDraft(secondBase.seed, secondBase.floor.guardianId!, 2, pairPool), open: true };
    runtime.world = { ...secondBase, floor: { ...secondBase.floor, lawProgress: { ...runtime.world.floor.lawProgress!, draft: secondDraft } }, mazeChronicle: runtime.world.mazeChronicle };
    expect(runtime.selectLaw('bronze_hounds')).toBe(true);
    const manifested = applyLivingLabyrinth(secondBase, runtime.world.floor.lawProgress!);
    runtime.world = { ...manifested, mazeChronicle: runtime.world.mazeChronicle };
    const room = runtime.world.floor.rooms.find(candidate => candidate.synergyId === 'echo_pack')!;
    const target = spawnFloorEnemies(runtime.world.map, runtime.world.floor).find(enemy => enemy.roomId === room.id && enemy.lawId);
    expect(target).toBeTruthy();
    runtime.player = { ...runtime.player, position: { ...target!.position } };
    runtime.enemies = spawnFloorEnemies(runtime.world.map, runtime.world.floor);
    runtime.update(0, {
      movement: { forward: 0, strafe: 0, turn: 0 }, lookX: 0, lookY: 0, sprint: false,
      primaryPressed: false, secondaryPressed: false, secondaryDown: false, secondaryReleased: false,
      skillPressed: false, skillSlot: null, dodgePressed: false, interactPressed: false,
      inventoryPressed: false, mapPressed: false, pausePressed: false,
    });

    expect(runtime.world.mazeChronicle.events.filter(event => event.kind === 'LAW_CHOSEN')).toHaveLength(2);
    expect(runtime.world.mazeChronicle.events).toContainEqual(expect.objectContaining({ kind: 'LAW_MANIFESTED', floor: 2, lawId: 'hall_of_echoes' }));
    expect(runtime.world.mazeChronicle.events).toContainEqual(expect.objectContaining({ kind: 'LAW_MANIFESTED', floor: 2, lawId: 'bronze_hounds' }));
    expect(runtime.world.mazeChronicle.events).toContainEqual(expect.objectContaining({ kind: 'SYNERGY_MANIFESTED', floor: 2, synergyId: 'echo_pack' }));
  });
});
