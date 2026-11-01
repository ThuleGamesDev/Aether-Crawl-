import { getBiomeIdForLevel } from '../data/assetRegistry';
import { generateDungeon } from '../services/dungeonGenerator';
import { floorRandom } from '../services/floorRandom';
import { TileType, type DungeonRoom, type FloorState, type PlayerCharacter } from '../types';
import { isWorldSolid } from './CollisionWorld';
import { spawnFloorEnemies } from './EnemySpawner';
import { getFloorGuardianDefinition } from '../data/mazeContent';

export interface DungeonWorldState {
  level: number;
  seed: number;
  biome: FloorState['biome'];
  map: number[][];
  decorations: number[][];
  floor: FloorState;
  explored: boolean[][];
  worldRevision: number;
}

export type LookTarget =
  | { kind: 'DOOR' | 'LOCKED' | 'SECRET' | 'EXIT'; x: number; z: number; room?: DungeonRoom }
  | { kind: 'ROOM'; room: DungeonRoom; x: number; z: number };

export interface RoomChoice {
  id: string;
  label: string;
  detail: string;
}

export interface RoomOffer {
  roomId: string;
  title: string;
  description: string;
  choices: RoomChoice[];
}

export function createDungeonWorld(level: number, seed = randomSeed()): DungeonWorldState {
  const biome = getBiomeIdForLevel(level);
  const generated = generateDungeon(biome, seed, level, { mapSize: 23, guardianArenaRadius: 3 });
  generated.floor!.guardianId = getFloorGuardianDefinition(level).id;
  generated.floor!.guardianState = 'NOT_DISCOVERED';
  const explored = generated.map.map(row => row.map(() => false));
  explored[1][1] = true;
  return { level, seed: seed >>> 0, biome, map: generated.map, decorations: generated.decorations, floor: generated.floor!, explored, worldRevision: 1 };
}

export function createFloorEnemies(world: DungeonWorldState) {
  return spawnFloorEnemies(world.map, world.floor);
}

export function markExplored(world: DungeonWorldState, x: number, z: number): DungeonWorldState {
  const cellX = Math.floor(x), cellZ = Math.floor(z);
  if (world.map[cellZ]?.[cellX] === undefined || world.explored[cellZ]?.[cellX]) return world;
  const explored = world.explored.map(row => [...row]);
  explored[cellZ][cellX] = true;
  const floor = { ...world.floor, visitedCells: world.floor.visitedCells.includes(cellX + ',' + cellZ) ? world.floor.visitedCells : [...world.floor.visitedCells, cellX + ',' + cellZ] };
  return { ...world, explored, floor };
}

export function findLookTarget(world: DungeonWorldState, player: PlayerCharacter, maxDistance = 1.7): LookTarget | null {
  const dx = Math.cos(player.rotation.yaw), dz = Math.sin(player.rotation.yaw);
  const seen = new Set<string>();
  for (let distance = 0; distance <= maxDistance; distance += 0.08) {
    const x = Math.floor(player.position.x + dx * distance);
    const z = Math.floor(player.position.z + dz * distance);
    const key = x + ',' + z;
    if (seen.has(key)) continue;
    seen.add(key);
    const tile = world.map[z]?.[x];
    if (tile === undefined) return null;
    const room = world.floor.rooms.find(candidate => !candidate.resolved && candidate.type !== 'NORMAL' && candidate.type !== 'BOSS' && (candidate.type !== 'LOCKED' || candidate.unlocked) && candidate.type !== 'SECRET' && (
      (candidate.gate && candidate.gate.x === x && candidate.gate.y === z) ||
      (!candidate.gate && candidate.anchor.x === x && candidate.anchor.y === z)
    ));
    if (room) return { kind: 'ROOM', room, x, z };
    if (tile === TileType.DOOR) return { kind: 'DOOR', x, z };
    if (tile === TileType.LOCKED) return { kind: 'LOCKED', x, z, room: world.floor.rooms.find(candidate => candidate.gate?.x === x && candidate.gate?.y === z) };
    if (tile === TileType.SECRET) return { kind: 'SECRET', x, z, room: world.floor.rooms.find(candidate => candidate.gate?.x === x && candidate.gate?.y === z) };
    if (tile === TileType.EXIT) return { kind: 'EXIT', x, z, room: world.floor.rooms.find(candidate => candidate.type === 'BOSS') };
    if (isWorldSolid(tile)) return null;
  }
  return null;
}

export function createRoomOffer(room: DungeonRoom): RoomOffer | null {
  if (room.type === 'TREASURE') return { roomId: room.id, title: 'Forgotten Chamber', description: 'Choose what to carry onward through the Labyrinth.', choices: [
    { id: 'gear', label: 'Claim Equipment', detail: 'Take a piece of equipment.' },
    { id: 'supplies', label: 'Take Supplies', detail: 'Find healing supplies instead.' },
  ] };
  if (room.type === 'LOCKED' && room.unlocked && !room.resolved) return { roomId: room.id, title: 'Sealed Treasury', description: 'A votive cache lies behind the broken bronze gate.', choices: [
    { id: 'gear', label: 'Claim Rare Equipment', detail: 'Take one piece of rare equipment from the vault.' },
    { id: 'supplies', label: 'Take Supplies', detail: 'Take a Healing Draught and Nectar Flask instead.' },
  ] };
  if (room.type === 'REST' || room.type === 'BOSS_ANTECHAMBER') return { roomId: room.id, title: room.type === 'REST' ? 'Pilgrim’s Rest' : 'Guardian’s Gate', description: 'Take one moment before pressing deeper.', choices: [
    { id: 'rest', label: 'Rest', detail: 'Restore 25% of your health.' },
    { id: 'meditate', label: 'Meditate', detail: 'Restore 35% of your mana.' },
    { id: 'prepare', label: 'Prepare', detail: 'Gain a brief damage blessing.' },
  ] };
  if (room.type === 'SHRINE') return { roomId: room.id, title: room.shrine === 'blood' ? 'Altar of Ares' : room.shrine === 'aether' ? 'Oracle’s Shrine' : 'Offering to Tyche', description: 'A votive place offers a measured boon to the lone pilgrim.', choices: [
    { id: 'blood', label: 'Offer Blood to Ares', detail: 'Surrender health for a rare bronze charm.' },
    { id: 'aether', label: 'Read the Oracle', detail: 'Restore 40% of your mana.' },
    { id: 'fortune', label: 'Leave an Offering to Tyche', detail: 'Receive a modest piece of equipment.' },
  ] };
  if (room.type === 'TRAP') return { roomId: room.id, title: 'Labyrinth Trap', description: 'A pressure plate and a bronze counterweight guard the path.', choices: [
    { id: 'disarm', label: 'Disarm', detail: 'Use dexterity to safely disable the trap.' },
    { id: 'force', label: 'Force Through', detail: 'Take the hit and keep moving.' },
  ] };
  if (room.type === 'EVENT') return { roomId: room.id, title: 'Broken Labyrinth Tablet', description: 'A small cache is wedged beneath a tablet bearing the maze pattern.', choices: [
    { id: 'investigate', label: 'Investigate', detail: 'Search the cache for a useful item.' },
    { id: 'key', label: 'Take Ariadne’s Token', detail: 'Carry a token that can open a sealed side treasury. You can carry up to three.' },
    { id: 'leave', label: 'Leave It', detail: 'Move on without disturbing the room.' },
  ] };
  return null;
}

export function roomCheck(player: PlayerCharacter, seed: number, dc = 12): boolean {
  const rng = floorRandom((seed ^ Math.floor(player.stats.xp + player.stats.level * 7919)) >>> 0);
  const stat = Math.max(player.stats.str, player.stats.dex, player.stats.int);
  return Math.floor(rng() * 20) + 1 + Math.floor(stat / 3) >= dc;
}

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0];
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
