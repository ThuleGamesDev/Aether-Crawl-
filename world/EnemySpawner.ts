import { enemyDefinitions } from '../data/enemies';
import { TileType, type FloorState, type WorldEnemy } from '../types';
import { floorRandom } from '../services/floorRandom';
import { isWorldSolid } from './CollisionWorld';

export function spawnFloorEnemies(map: number[][], floor: FloorState): WorldEnemy[] {
  const definitions = new Map(enemyDefinitions.map(definition => [definition.id, definition]));
  const random = floorRandom(floor.seed ^ 0xE11E5);
  const occupied = new Set<string>();
  const enemies: WorldEnemy[] = [];
  const make = (definitionId: string, x: number, z: number, roomId?: string, isBoss = false) => {
    const definition = definitions.get(definitionId);
    if (!definition || isWorldSolid(map[z]?.[x])) return;
    const cell = x + ',' + z;
    if (occupied.has(cell)) return;
    occupied.add(cell);
    const levelScale = Math.max(1, 1 + (floor.level - (definition.minLevel ?? 1)) * 0.12);
    const baseHealth = floor.level === 1 && definitionId === 'skeleton_warrior' ? 38 : definition.hp;
    const health = Math.round(baseHealth * levelScale * (isBoss ? 1.8 : 1));
    enemies.push({
      id: 'enemy_' + floor.level + '_' + (floor.seed >>> 0) + '_' + enemies.length,
      definitionId,
      name: isBoss ? 'Bone Sentinel' : definition.name,
      visualId: definition.visualId,
      position: { x: x + 0.5, y: 0, z: z + 0.5 },
      collisionRadius: isBoss ? 0.38 : definitionId === 'giant_rat' ? 0.22 : 0.28,
      health,
      maxHealth: health,
      damage: Math.max(3, Math.round(definition.damage * Math.min(1.45, levelScale))),
      xpReward: isBoss ? Math.max(50, definition.xp * 2) : definition.xp,
      state: 'IDLE',
      stateTimer: 0,
      attackCooldown: 0.25 + random() * 0.4,
      attackRange: definitionId === 'giant_rat' ? 1.15 : 1.45,
      attackTelegraphSeconds: definitionId === 'giant_rat' ? 0.48 : 0.68,
      rewardGranted: false,
      roomId,
      isBoss,
    });
  };

  const combatRooms = floor.rooms.filter(room => room.type === 'COMBAT' || room.type === 'ELITE');
  if (floor.level === 1) {
    const first = combatRooms[0];
    const second = combatRooms[1];
    if (first) make('giant_rat', first.anchor.x, first.anchor.y, first.id);
    if (second) make('skeleton_warrior', second.anchor.x, second.anchor.y, second.id);
  } else {
    const eligible = enemyDefinitions.filter(definition => definition.category === 'normal' && (definition.minLevel ?? 1) <= floor.level);
    for (const room of combatRooms) {
      const definition = eligible[Math.floor(random() * eligible.length)] ?? enemyDefinitions[0];
      make(definition.id, room.anchor.x, room.anchor.y, room.id);
    }
  }

  const bossRoom = floor.rooms.find(room => room.type === 'BOSS');
  if (bossRoom) {
    const bossDefinition = floor.level === 1 ? 'skeleton_warrior' : floor.level >= 5 ? 'the_necromancer' : 'skeleton_warrior';
    make(bossDefinition, bossRoom.anchor.x, bossRoom.anchor.y, bossRoom.id, true);
    if (enemies.length && map[bossRoom.anchor.y]?.[bossRoom.anchor.x] === TileType.EXIT) {
      // The exit stays walkable; the guardian's collision and health gate the descent.
    }
  }

  const freeCells: Array<{ x: number; z: number; score: number }> = [];
  const start = { x: 1, z: 1 };
  for (let z = 1; z < map.length - 1; z += 1) for (let x = 1; x < map[z].length - 1; x += 1) {
    if (isWorldSolid(map[z][x]) || occupied.has(x + ',' + z)) continue;
    const distanceFromStart = Math.hypot(x - start.x, z - start.z);
    if (distanceFromStart < 4) continue;
    freeCells.push({ x, z, score: distanceFromStart + random() * 2 });
  }
  freeCells.sort((a, b) => b.score - a.score);
  for (const cell of freeCells) {
    if (enemies.length >= Math.min(5, 2 + Math.floor(floor.level / 2))) break;
    const id = floor.level === 1 ? (enemies.length % 2 === 0 ? 'giant_rat' : 'skeleton_warrior') : 'giant_rat';
    make(id, cell.x, cell.z);
  }
  return enemies;
}
