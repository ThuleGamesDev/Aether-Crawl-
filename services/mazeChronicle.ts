import { enemyDefinitions } from '../data/enemies';
import { getFloorGuardianDefinition } from '../data/mazeContent';
import { isMazeLawSynergyId } from '../data/lawSynergies';
import { isMazeLawId } from '../data/mazeLaws';
import type { DungeonRoomType, MazeChronicle, MazeChronicleEvent, MazeLawId, MazeLawSynergyId } from '../types';

export const MAZE_CHRONICLE_VERSION = 1;
export const MAX_MAZE_CHRONICLE_EVENTS = 64;
const ROOM_FAMILY_IDS = new Set<DungeonRoomType>(['COMBAT', 'ELITE', 'TREASURE', 'SHRINE', 'TRAP', 'SECRET', 'REST', 'LOCKED', 'EVENT', 'BOSS_ANTECHAMBER', 'BOSS']);
const ENEMY_FAMILY_IDS = new Set([
  ...enemyDefinitions.map(enemy => enemy.id),
  ...Array.from({ length: 5 }, (_, index) => getFloorGuardianDefinition(index + 1).id),
]);

export type MazeChronicleEventInput = MazeChronicleEvent extends infer Event
  ? Event extends MazeChronicleEvent ? Omit<Event, 'id' | 'sequence'> : never
  : never;

export function createMazeChronicle(): MazeChronicle {
  return { version: MAZE_CHRONICLE_VERSION, nextSequence: 1, events: [] };
}

export function recordMazeChronicleEvent(chronicle: MazeChronicle | undefined, input: MazeChronicleEventInput): MazeChronicle {
  const current = chronicle ?? createMazeChronicle();
  if (!validateMazeChronicle(current)) return createMazeChronicle();
  const key = identity(input);
  if (current.events.some(event => identity(event) === key)) return current;
  if (current.nextSequence >= Number.MAX_SAFE_INTEGER) return current;
  const sequence = current.nextSequence;
  const event = { ...input, id: `chronicle_${sequence.toString(36)}`, sequence } as MazeChronicleEvent;
  return { version: MAZE_CHRONICLE_VERSION, nextSequence: sequence + 1, events: [...current.events, event].slice(-MAX_MAZE_CHRONICLE_EVENTS) };
}

export function validateMazeChronicle(value: unknown): value is MazeChronicle {
  if (!value || typeof value !== 'object') return false;
  const chronicle = value as MazeChronicle;
  if (chronicle.version !== MAZE_CHRONICLE_VERSION || !Number.isSafeInteger(chronicle.nextSequence) || chronicle.nextSequence < 1
    || !Array.isArray(chronicle.events) || chronicle.events.length > MAX_MAZE_CHRONICLE_EVENTS) return false;
  let previous = 0;
  for (const event of chronicle.events) {
    if (!event || typeof event !== 'object' || !Number.isSafeInteger(event.sequence) || event.sequence <= previous
      || event.sequence >= chronicle.nextSequence || event.id !== `chronicle_${event.sequence.toString(36)}`
      || !Number.isInteger(event.floor) || event.floor < 1 || event.floor > 10_000) return false;
    previous = event.sequence;
    if (event.kind === 'LAW_CHOSEN') {
      if (!isMazeLawId(event.lawId) || typeof event.offerId !== 'string' || event.offerId.length < 1 || event.offerId.length > 160
        || event.replacedLawId !== undefined && !isMazeLawId(event.replacedLawId)) return false;
    } else if (event.kind === 'LAW_MANIFESTED') {
      if (!isMazeLawId(event.lawId)) return false;
    } else if (event.kind === 'SYNERGY_MANIFESTED') {
      if (!isMazeLawSynergyId(event.synergyId)) return false;
    } else if (event.kind === 'THREAD_WOVEN') {
      if (typeof event.junctionId !== 'string' || event.junctionId.length < 1 || event.junctionId.length > 120
        || typeof event.routeId !== 'string' || event.routeId.length < 1 || event.routeId.length > 160
        || !['REVEAL_PASSAGE', 'SEAL_PASSAGE'].includes(event.action)
        || !Number.isInteger(event.chargeCost) || event.chargeCost < 0 || event.chargeCost > 3
        || !Number.isInteger(event.healthCost) || event.healthCost < 0 || event.healthCost > 100_000) return false;
    } else if (event.kind === 'ROOM_FAMILY_DISCOVERED') {
      if (!ROOM_FAMILY_IDS.has(event.familyId)) return false;
    } else if (event.kind === 'ENEMY_FAMILY_DISCOVERED') {
      if (typeof event.familyId !== 'string' || !ENEMY_FAMILY_IDS.has(event.familyId)) return false;
    } else return false;
  }
  return true;
}

function identity(event: MazeChronicleEventInput | MazeChronicleEvent): string {
  switch (event.kind) {
    case 'LAW_CHOSEN': return `${event.kind}|${event.offerId}`;
    case 'LAW_MANIFESTED': return `${event.kind}|${event.floor}|${event.lawId}`;
    case 'SYNERGY_MANIFESTED': return `${event.kind}|${event.floor}|${event.synergyId}`;
    case 'THREAD_WOVEN': return `${event.kind}|${event.floor}|${event.junctionId}`;
    case 'ROOM_FAMILY_DISCOVERED': return `${event.kind}|${event.familyId}`;
    case 'ENEMY_FAMILY_DISCOVERED': return `${event.kind}|${event.familyId}`;
  }
}

export function isMazeRoomFamilyId(value: unknown): value is DungeonRoomType {
  return typeof value === 'string' && ROOM_FAMILY_IDS.has(value as DungeonRoomType);
}

export function isMazeEnemyFamilyId(value: unknown): value is string {
  return typeof value === 'string' && ENEMY_FAMILY_IDS.has(value);
}

export function isMazeLawIdForChronicle(value: unknown): value is MazeLawId {
  return isMazeLawId(value);
}

export function isMazeSynergyIdForChronicle(value: unknown): value is MazeLawSynergyId {
  return isMazeLawSynergyId(value);
}
