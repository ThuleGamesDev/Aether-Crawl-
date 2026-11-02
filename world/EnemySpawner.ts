import { FLOOR_ENEMY_ROSTERS, getFloorGuardianDefinition } from '../data/mazeContent';
import { enemyDefinitions } from '../data/enemies';
import { TileType, type FloorState, type WorldEnemy } from '../types';
import { floorRandom } from '../services/floorRandom';
import { isWorldSolid } from './CollisionWorld';

export function spawnFloorEnemies(map: number[][], floor: FloorState): WorldEnemy[] {
  const definitions = new Map(enemyDefinitions.map(definition => [definition.id, definition]));
  const random = floorRandom(floor.seed ^ 0xE11E5);
  const occupied = new Set<string>();
  const enemies: WorldEnemy[] = [];
  const make = (definitionId: string, x: number, z: number, roomId?: string, guardian = false) => {
    const definition = definitions.get(guardian ? 'skeleton_warrior' : definitionId);
    if (!definition || isWorldSolid(map[z]?.[x])) return false;
    const cell = x + ',' + z;
    if (occupied.has(cell)) return false;
    occupied.add(cell);
    const guardianDefinition = guardian ? getFloorGuardianDefinition(floor.level) : undefined;
    const levelScale = Math.max(1, 1 + (floor.level - (definition.minLevel ?? 1)) * 0.12);
    const health = guardian ? guardianDefinition!.health : Math.round(definition.fpsHp * levelScale);
    const id = guardianDefinition?.id ?? definition.id;
    enemies.push({
      id: 'enemy_' + floor.level + '_' + (floor.seed >>> 0) + '_' + id,
      definitionId: id,
      name: guardianDefinition?.name ?? definition.fpsName,
      visualId: guardianDefinition?.visualId ?? definition.fpsVisualId,
      position: { x: x + 0.5, y: 0, z: z + 0.5 },
      collisionRadius: guardian ? 0.42 : definitionId === 'giant_rat' ? 0.22 : 0.28,
      health,
      maxHealth: health,
      damage: guardian ? guardianDefinition!.damage : Math.max(3, Math.round(definition.fpsDamage * Math.min(1.45, levelScale))),
      xpReward: guardian ? guardianDefinition!.xpReward : definition.fpsXp,
      state: 'IDLE',
      stateTimer: 0,
      attackCooldown: 0.35 + random() * 0.55,
      attackRange: guardian ? 4.2 : 1.45,
      attackTelegraphSeconds: guardian ? 0.82 : 0.65,
      attackSetId: guardian ? guardianDefinition!.attackSetId : definition.attackSetId,
      attackIndex: 0,
      behaviorRole: guardian ? (floor.level === 4 ? 'SKIRMISHER' : floor.level === 2 || floor.level === 5 ? 'CONTROLLER' : 'HEAVY') : definition.fpsRole ?? 'CHASER',
      statusEffects: [],
      phase: 1,
      phaseTransitioned: false,
      repositionCooldownSeconds: 0,
      pathRefreshSeconds: 0,
      rewardGranted: false,
      roomId: roomId ?? (guardian ? floor.rooms.find(room => room.type === 'BOSS')?.id : undefined),
      isBoss: guardian,
    });
    return true;
  };

  const combatRooms = floor.rooms.filter(room => room.type === 'COMBAT' || room.type === 'ELITE');
  const curated = FLOOR_ENEMY_ROSTERS[Math.min(floor.level, 5)] ?? FLOOR_ENEMY_ROSTERS[5];
  const eligible = curated.map(id => definitions.get(id)).filter((definition): definition is (typeof enemyDefinitions)[number] => Boolean(definition));
  for (let index = 0; index < combatRooms.length; index += 1) {
    const room = combatRooms[index];
    const definition = eligible[index % Math.max(1, eligible.length)];
    if (definition) make(definition.id, room.anchor.x, room.anchor.y, room.id);
  }

  const bossRoom = floor.rooms.find(room => room.type === 'BOSS');
  const guardian = getFloorGuardianDefinition(floor.level);
  if (bossRoom && floor.guardianState !== 'DEFEATED' && floor.guardianState !== 'DESCENT_UNLOCKED') {
    const start = { x: 1, y: 1 };
    const candidates = bossRoom.cells
      .filter(cell => !(cell.x === bossRoom.anchor.x && cell.y === bossRoom.anchor.y) && !isWorldSolid(map[cell.y]?.[cell.x]) && map[cell.y]?.[cell.x] !== TileType.EXIT && !occupied.has(cell.x + ',' + cell.y))
      .sort((a, b) => Math.hypot(b.x - start.x, b.y - start.y) - Math.hypot(a.x - start.x, a.y - start.y));
    const spawn = candidates[0] ?? (isWorldSolid(map[bossRoom.anchor.y]?.[bossRoom.anchor.x]) ? undefined : bossRoom.anchor);
    if (spawn) make(guardian.id, spawn.x, spawn.y, bossRoom.id, true);
  }

  const freeCells: Array<{ x: number; z: number; score: number }> = [];
  const start = { x: 1, z: 1 };
  for (let z = 1; z < map.length - 1; z += 1) for (let x = 1; x < map[z].length - 1; x += 1) {
    if (isWorldSolid(map[z][x]) || occupied.has(x + ',' + z) || floor.rooms.find(room => room.type === 'BOSS')?.cells.some(cell => cell.x === x && cell.y === z)) continue;
    const distanceFromStart = Math.hypot(x - start.x, z - start.z);
    if (distanceFromStart < 4) continue;
    freeCells.push({ x, z, score: distanceFromStart + random() * 2 });
  }
  freeCells.sort((a, b) => b.score - a.score);
  for (const cell of freeCells) {
    if (enemies.length >= Math.min(7, 3 + Math.floor(floor.level / 2))) break;
    const definition = eligible[Math.floor(random() * eligible.length)];
    if (definition) make(definition.id, cell.x, cell.z);
  }
  return enemies;
}
