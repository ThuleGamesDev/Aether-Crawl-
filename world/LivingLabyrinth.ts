import { DungeonDecoration, TileType, type AriadneThreadJunction, type DungeonRoom, type MazeLawHazard, type MazeLawId, type MazeLawSpawn, type MazeLawProgress, type MazeLawSynergyId } from '../types';
import type { DungeonWorldState } from './DungeonWorld';
import { getMazeLaw } from '../data/mazeLaws';
import { isMazeLawSynergyId, resolveMazeLawSynergies } from '../data/lawSynergies';
import { reachableCells } from '../services/dungeonPlan';

const MAX_LAW_SPAWNS = 5;
const MAX_LAW_HAZARDS = 1;
const MAX_ACTIVE_LAWS = 3;

/** Applies bounded, deterministic edits to the authored floor plan and its spawn metadata. */
export function applyLivingLabyrinth(world: DungeonWorldState, progress: MazeLawProgress): DungeonWorldState {
  const active = [...progress.activeLaws].sort((a, b) => a.acquiredOrder - b.acquiredOrder).slice(0, MAX_ACTIVE_LAWS);
  if (!active.length) return { ...world, floor: { ...world.floor, lawProgress: progress, lawSpawns: [], lawHazards: [], manifestedLawIds: [], manifestedSynergyIds: [] } };
  const map = world.map.map(row => [...row]);
  const decorations = world.decorations.map(row => [...row]);
  let rooms = [...world.floor.rooms];
  let architectureRooms = world.floor.architectureRooms?.map(room => ({ ...room, cells: room.cells.map(cell => ({ ...cell })), landmarkIds: [...room.landmarkIds] }));
  const lawSpawns: MazeLawSpawn[] = [];
  const lawHazards: MazeLawHazard[] = [];
  const manifestedLawIds: MazeLawId[] = [];
  const pickRoom = (eligible: DungeonRoom[], key: string) => eligible.slice().sort((a, b) => stableHash(`${world.seed}|${key}|${a.id}`) - stableHash(`${world.seed}|${key}|${b.id}`))[0];
  const combatRooms = () => rooms.filter(room => room.type === 'COMBAT' || room.type === 'ELITE');
  const synergies = resolveMazeLawSynergies(active.map(law => law.lawId));
  const synergyRooms = new Map(synergies.map(synergy => [synergy.synergyId, pickRoom(combatRooms(), 'synergy_' + synergy.synergyId)]));
  const synergyByLaw = new Map<MazeLawId, MazeLawSynergyId>();
  for (const synergy of synergies) for (const lawId of synergy.requiredLawIds) synergyByLaw.set(lawId, synergy.synergyId);
  const roomForLaw = (lawId: MazeLawId) => {
    const synergyId = synergyByLaw.get(lawId);
    return (synergyId ? synergyRooms.get(synergyId) : undefined) ?? pickRoom(combatRooms(), lawId);
  };
  const attachSpawn = (lawId: MazeLawId, room: DungeonRoom | undefined, definitionId: string, count: number, displayName?: string, rewardBaseId?: string) => {
    if (!room || lawSpawns.length >= MAX_LAW_SPAWNS) return;
    lawSpawns.push({ lawId, roomId: room.id, definitionId, count: Math.max(1, Math.min(2, count)), ...(displayName ? { displayName } : {}), ...(rewardBaseId ? { rewardBaseId } : {}) });
  };
  const markRoom = (lawId: MazeLawId, room: DungeonRoom | undefined, update: Partial<DungeonRoom> = {}) => {
    if (!room) return;
    rooms = rooms.map(candidate => candidate.id === room.id ? {
      ...candidate, ...update, lawId,
      lawIds: [...new Set([...(candidate.lawIds ?? (candidate.lawId ? [candidate.lawId] : [])), lawId])],
    } : candidate);
  };

  for (const law of active) {
    const lawId = law.lawId;
    let applied = false;
    if (lawId === 'hall_of_echoes') {
      const room = roomForLaw(lawId);
      markRoom(lawId, room, { type: 'ELITE' });
      attachSpawn(lawId, room, 'specter', 1, 'Echo Remnant', 'kopis');
      applied = Boolean(room);
    } else if (lawId === 'vault_of_tyche') {
      const room = rooms.find(room => room.type === 'LOCKED');
      markRoom(lawId, room);
      applied = Boolean(room);
    } else if (lawId === 'pillars_of_daedalus') {
      const room = roomForLaw(lawId);
      markRoom(lawId, room);
      addBlockingPillar(map, decorations, room, world.floor.rooms);
      if (architectureRooms && room) {
        const cells = new Set(room.cells.map(cell => cell.x + ',' + cell.y));
        let target = architectureRooms.find(entry => entry.cells.some(cell => cells.has(cell.x + ',' + cell.y)));
        if (!target) target = architectureRooms.slice().sort((a, b) => a.cells.length - b.cells.length)[0];
        if (target) architectureRooms = architectureRooms.map(entry => entry.id === target!.id
          ? { ...entry, roomShape: 'PILLARED_HALL', lightingTheme: 'COOL', roomArchetype: 'PILLARED_HALL', landmarkIds: [...new Set([...entry.landmarkIds, 'daedalus_pillars'])] }
          : entry);
      }
      attachSpawn(lawId, room, 'skeleton_warrior', 1, 'Daedalus Guard', 'bronze_cuirass');
      applied = Boolean(room);
    } else if (lawId === 'bronze_hounds') {
      const room = roomForLaw(lawId);
      attachSpawn(lawId, room, 'giant_rat', 2, 'Bronze Hound', 'bronze_hound_tooth');
      applied = Boolean(room);
    } else if (lawId === 'arachnes_kin') {
      const room = roomForLaw(lawId);
      attachSpawn(lawId, room, 'acid_spider', 2, undefined, synergyByLaw.get(lawId) === 'venom_nest' ? undefined : 'antidote_flask');
      applied = Boolean(room);
    } else if (lawId === 'shades_of_styx') {
      const room = roomForLaw(lawId);
      attachSpawn(lawId, room, 'specter', 1, 'Stygian Shade', 'styx_soul_essence');
      applied = Boolean(room);
    } else if (lawId === 'oath_of_ares') {
      const room = roomForLaw(lawId);
      markRoom(lawId, room);
      if (architectureRooms && room) {
        const cells = new Set(room.cells.map(cell => cell.x + ',' + cell.y));
        const target = architectureRooms.find(entry => entry.cells.some(cell => cells.has(cell.x + ',' + cell.y)));
        if (target) architectureRooms = architectureRooms.map(entry => entry.id === target.id
          ? { ...entry, lightingTheme: 'CHTHONIC', roomArchetype: 'ARES_SIGIL_CHAMBER', landmarkIds: [...new Set([...entry.landmarkIds, 'ares_red_sigil'])] }
          : entry);
      }
      applied = Boolean(room);
    } else if (lawId === 'serpents_bargain') {
      const room = roomForLaw(lawId);
      if (room && lawHazards.length < MAX_LAW_HAZARDS) {
        const point = room.cells.slice().sort((a, b) => stableHash(`${world.seed}|${lawId}|${a.x},${a.y}`) - stableHash(`${world.seed}|${lawId}|${b.x},${b.y}`)).find(cell => map[cell.y]?.[cell.x] === TileType.EMPTY && Math.hypot(cell.x + 0.5 - room.anchor.x - 0.5, cell.y + 0.5 - room.anchor.y - 0.5) >= 1.5);
        const chosen = point ?? room.anchor;
        const synergyId = synergyByLaw.get(lawId);
        lawHazards.push({ id: `law_hazard_${world.floor.level}_${lawId}`, lawId, x: chosen.x + 0.5, z: chosen.y + 0.5, radius: 1.45, damage: 2, cooldownSeconds: 4, cooldownRemaining: 0, rewardBaseId: 'antidote_flask', roomId: room.id, ...(synergyId ? { synergyId } : {}) });
        applied = true;
      }
    } else if (lawId === 'broken_thread') {
      let secret = rooms.find(room => room.type === 'SECRET');
      if (!secret) {
        const added = addSecretBranch(map, decorations, rooms, world.floor.level, world.floor.seed, world.floor.threadJunctions ?? []);
        if (added) { secret = added; rooms = [...rooms, added]; }
      }
      if (secret) markRoom(lawId, secret);
      applied = Boolean(secret);
    }
    if (applied && (lawSpawns.some(spawn => spawn.lawId === lawId) || lawHazards.some(hazard => hazard.lawId === lawId)
      || rooms.some(room => room.lawIds?.includes(lawId) || room.lawId === lawId) || lawId === 'oath_of_ares')) manifestedLawIds.push(lawId);
  }

  const manifestedSynergyIds: MazeLawSynergyId[] = [];
  for (const synergy of synergies) {
    const room = synergyRooms.get(synergy.synergyId);
    const lawSpawnCount = lawSpawns.filter(spawn => spawn.roomId === room?.id).reduce((sum, spawn) => sum + spawn.count, 0);
    const hazardCount = lawHazards.filter(hazard => hazard.roomId === room?.id).length;
    if (!room || !synergy.requiredLawIds.every(lawId => manifestedLawIds.includes(lawId))
      || lawSpawnCount > synergy.encounterBudget.enemies || hazardCount > synergy.encounterBudget.hazards) continue;
    manifestedSynergyIds.push(synergy.synergyId);
    rooms = rooms.map(candidate => candidate.id === room.id ? {
      ...candidate,
      synergyId: synergy.synergyId,
      lawIds: [...new Set([...(candidate.lawIds ?? (candidate.lawId ? [candidate.lawId] : [])), ...synergy.requiredLawIds])],
    } : candidate);
    const cells = new Set(room.cells.map(cell => `${cell.x},${cell.y}`));
    const architectureRoom = architectureRooms?.find(entry => entry.cells.some(cell => cells.has(`${cell.x},${cell.y}`)));
    if (architectureRoom && architectureRooms) architectureRooms = architectureRooms.map(entry => entry.id === architectureRoom.id
      ? {
        ...entry,
        roomArchetype: synergy.roomArchetype,
        synergyId: synergy.synergyId,
        lightingTheme: synergy.synergyId === 'venom_nest' ? 'COOL' : synergy.synergyId === 'ares_pillar_arena' ? 'CHTHONIC' : entry.lightingTheme,
        landmarkIds: [...new Set([...entry.landmarkIds, synergy.visualCueId.toLowerCase(), ...(synergy.synergyId === 'ares_pillar_arena' ? ['daedalus_pillars', 'ares_red_sigil'] : [])])],
      }
      : entry);
    if (synergy.synergyId === 'venom_nest') lawHazards.forEach((hazard, index) => {
      if (hazard.roomId === room.id) lawHazards[index] = { ...hazard, synergyId: synergy.synergyId };
    });
  }

  const updatedProgress: MazeLawProgress = {
    ...progress,
    activeLaws: active.map(law => manifestedLawIds.includes(law.lawId) ? {
      ...law,
      firstManifestedFloor: law.firstManifestedFloor ?? world.level,
      lastManifestedFloor: world.level,
      manifestationCount: Math.min(9999, law.manifestationCount + 1),
    } : law),
  };
  return {
    ...world,
    map,
    decorations,
    floor: { ...world.floor, rooms, architectureRooms, lawProgress: updatedProgress, lawSpawns: lawSpawns.slice(0, MAX_LAW_SPAWNS), lawHazards: lawHazards.slice(0, MAX_LAW_HAZARDS), manifestedLawIds, manifestedSynergyIds },
  };
}

export function validateLawProgress(value: unknown): value is MazeLawProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as MazeLawProgress;
  if (progress.version !== 1 || !Array.isArray(progress.activeLaws) || progress.activeLaws.length > MAX_ACTIVE_LAWS || !Array.isArray(progress.choiceHistory) || progress.choiceHistory.length > 32) return false;
  const ids = new Set<string>();
  for (const law of progress.activeLaws) {
    if (!law || !getMazeLaw(law.lawId) || ids.has(law.lawId) || !Number.isInteger(law.selectedAtFloor) || law.selectedAtFloor < 1 || !Number.isInteger(law.acquiredOrder) || law.acquiredOrder < 1
      || !(law.firstManifestedFloor === null || Number.isInteger(law.firstManifestedFloor) && law.firstManifestedFloor >= law.selectedAtFloor)
      || !(law.lastManifestedFloor === null || Number.isInteger(law.lastManifestedFloor) && law.lastManifestedFloor >= (law.firstManifestedFloor ?? law.selectedAtFloor))
      || !Number.isInteger(law.manifestationCount) || law.manifestationCount < 0 || law.manifestationCount > 9999) return false;
    ids.add(law.lawId);
  }
  if (new Set(progress.activeLaws.map(law => law.acquiredOrder)).size !== progress.activeLaws.length) return false;
  if (!progress.choiceHistory.every(record => record && typeof record.offerId === 'string' && getMazeLaw(record.lawId) && Number.isInteger(record.floorLevel) && record.floorLevel > 0 && (record.replacedLawId === undefined || getMazeLaw(record.replacedLawId)))) return false;
  if (progress.draft && !validateDraft(progress.draft)) return false;
  return true;
}

export function validateLawSpawn(value: unknown, roomIds: ReadonlySet<string>): value is MazeLawSpawn {
  if (!value || typeof value !== 'object') return false;
  const spawn = value as MazeLawSpawn;
  return Boolean(getMazeLaw(spawn.lawId)) && roomIds.has(spawn.roomId) && typeof spawn.definitionId === 'string' && spawn.definitionId.length <= 64
    && Number.isInteger(spawn.count) && spawn.count >= 1 && spawn.count <= 2
    && (spawn.displayName === undefined || typeof spawn.displayName === 'string' && spawn.displayName.length <= 64)
    && (spawn.rewardBaseId === undefined || typeof spawn.rewardBaseId === 'string' && spawn.rewardBaseId.length <= 64);
}

export function validateLawHazard(value: unknown, roomIds?: ReadonlySet<string>): value is MazeLawHazard {
  if (!value || typeof value !== 'object') return false;
  const hazard = value as MazeLawHazard;
  return typeof hazard.id === 'string' && hazard.id.length <= 80 && Boolean(getMazeLaw(hazard.lawId)) && Number.isFinite(hazard.x) && Number.isFinite(hazard.z)
    && Number.isFinite(hazard.radius) && hazard.radius > 0 && hazard.radius <= 3 && Number.isFinite(hazard.damage) && hazard.damage >= 0 && hazard.damage <= 10
    && Number.isFinite(hazard.cooldownSeconds) && hazard.cooldownSeconds >= 1 && hazard.cooldownSeconds <= 20
    && Number.isFinite(hazard.cooldownRemaining) && hazard.cooldownRemaining >= 0 && hazard.cooldownRemaining <= hazard.cooldownSeconds
    && (hazard.rewardBaseId === undefined || typeof hazard.rewardBaseId === 'string' && hazard.rewardBaseId.length <= 64)
    && (hazard.roomId === undefined || typeof hazard.roomId === 'string' && hazard.roomId.length <= 120 && (!roomIds || roomIds.has(hazard.roomId)))
    && (hazard.synergyId === undefined || isMazeLawSynergyId(hazard.synergyId));
}

export function validLawId(value: unknown): value is MazeLawId { return typeof value === 'string' && Boolean(getMazeLaw(value)); }

function validateDraft(draft: MazeLawProgress['draft']): boolean {
  if (!draft || draft.version !== 1 || typeof draft.offerId !== 'string' || draft.offerId.length > 160 || typeof draft.guardianId !== 'string' || !Number.isInteger(draft.floorLevel) || draft.floorLevel < 1 || !Number.isInteger(draft.poolVersion) || draft.poolVersion < 1 || draft.poolVersion > 255 || typeof draft.open !== 'boolean' || !Array.isArray(draft.lawIds) || draft.lawIds.length !== 3 || new Set(draft.lawIds).size !== 3 || !draft.lawIds.every(validLawId)) return false;
  if (new Set(draft.lawIds.map(id => getMazeLaw(id)?.category)).size !== 3) return false;
  return [draft.selectedLawId, draft.pendingLawId, draft.replacedLawId].every(id => id === undefined || validLawId(id)) && (draft.pendingLawId === undefined || draft.open) && (draft.selectedLawId === undefined || draft.lawIds.includes(draft.selectedLawId) && !draft.open);
}

function addBlockingPillar(map: number[][], decorations: number[][], room: DungeonRoom | undefined, originalRooms: readonly DungeonRoom[]): void {
  if (!room) return;
  const protectedCells = new Set(originalRooms.filter(entry => entry.type === 'BOSS' || entry.type === 'BOSS_ANTECHAMBER').flatMap(entry => entry.cells.map(cell => `${cell.x},${cell.y}`)));
  const candidates = room.cells.filter(cell => map[cell.y]?.[cell.x] === TileType.EMPTY && !protectedCells.has(`${cell.x},${cell.y}`)
    && !(room.gate?.x === cell.x && room.gate.y === cell.y)
    && neighbors(map, cell.x, cell.y).filter(point => map[point.y]?.[point.x] === TileType.EMPTY).length >= 3)
    .sort((a, b) => stableHash(`${room.id}|${a.x},${a.y}`) - stableHash(`${room.id}|${b.x},${b.y}`));
  for (const cell of candidates) {
    map[cell.y][cell.x] = TileType.WALL;
    if (preservesMainRoute(map, originalRooms)) { decorations[cell.y][cell.x] = DungeonDecoration.PILLAR; return; }
    map[cell.y][cell.x] = TileType.EMPTY;
  }
}

function preservesMainRoute(map: number[][], rooms: readonly DungeonRoom[]): boolean {
  const start = { x: 1, y: 1 };
  const reachable = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) for (const point of neighbors(map, queue[index].x, queue[index].y)) {
    if (![TileType.EMPTY, TileType.EXIT, TileType.DOOR].includes(map[point.y]?.[point.x] as TileType)) continue;
    const key = `${point.x},${point.y}`;
    if (!reachable.has(key)) { reachable.add(key); queue.push(point); }
  }
  const exit = map.flatMap((row, y) => row.map((tile, x) => tile === TileType.EXIT ? `${x},${y}` : '')).find(Boolean);
  const anchors = rooms.filter(room => room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER').map(room => `${room.anchor.x},${room.anchor.y}`);
  return Boolean(exit && reachable.has(exit)) && anchors.every(key => reachable.has(key));
}

function addSecretBranch(map: number[][], decorations: number[][], rooms: readonly DungeonRoom[], level: number, seed: number, junctions: readonly AriadneThreadJunction[]): DungeonRoom | undefined {
  const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const protectedCells = new Set(rooms.filter(room => room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER').flatMap(room => room.cells.map(cell => `${cell.x},${cell.y}`)));
  for (const junction of junctions) for (const cell of [...junction.revealRoute.cells, ...junction.sealRoute.cells]) protectedCells.add(`${cell.x},${cell.y}`);
  const openNeighbors = (x: number, y: number) => neighbors(map, x, y).filter(point => [TileType.EMPTY, TileType.EXIT].includes(map[point.y][point.x] as TileType));
  const candidates = reachableCells(map).filter(entry => !protectedCells.has(`${entry.x},${entry.y}`))
    .sort((a, b) => stableHash(`${seed}|broken_thread|${a.x},${a.y}`) - stableHash(`${seed}|broken_thread|${b.x},${b.y}`));
  for (const entry of candidates) for (const direction of directions) {
    const gate = { x: entry.x + direction.x, y: entry.y + direction.y };
    const inside = { x: gate.x + direction.x, y: gate.y + direction.y };
    if (gate.x <= 0 || gate.y <= 0 || gate.y >= map.length - 1 || gate.x >= map[0].length - 1
      || inside.x <= 0 || inside.y <= 0 || inside.y >= map.length - 1 || inside.x >= map[0].length - 1
      || map[gate.y]?.[gate.x] !== TileType.WALL || map[inside.y]?.[inside.x] !== TileType.WALL
      || protectedCells.has(`${gate.x},${gate.y}`) || protectedCells.has(`${inside.x},${inside.y}`)
      || openNeighbors(gate.x, gate.y).length !== 1 || openNeighbors(inside.x, inside.y).length !== 0) continue;
    map[gate.y][gate.x] = TileType.SECRET;
    map[inside.y][inside.x] = TileType.EMPTY;
    decorations[inside.y][inside.x] = DungeonDecoration.LABYRINTH_TABLET;
    return { id: `law_secret_${level}_${seed >>> 0}`, type: 'SECRET', anchor: inside, cells: [gate, inside], gate, discovered: false, visited: false, resolved: false, lawId: 'broken_thread' };
  }
  return undefined;
}

function neighbors(map: number[][], x: number, y: number) { return [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }].filter(point => point.y >= 0 && point.y < map.length && point.x >= 0 && point.x < (map[point.y]?.length ?? 0)); }
function stableHash(value: string): number { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return hash >>> 0; }
