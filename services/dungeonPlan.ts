import { TileType, type BiomeId, type DungeonRoom, type DungeonRoomType, type FloorState, type Position } from '../types';
import { floorRandom } from './floorRandom';
export const cellKey = (p: Position) => `${p.x},${p.y}`;
export const isClosedTile = (tile: number) => tile === TileType.WALL || tile === TileType.LOCKED || tile === TileType.SECRET;
const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function reachableCells(map: number[][], start: Position = { x: 1, y: 1 }): Position[] {
  const queue = [start], seen = new Set([cellKey(start)]);
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of directions) {
    const p = { x: queue[i].x + dx, y: queue[i].y + dy };
    if (map[p.y]?.[p.x] === undefined || isClosedTile(map[p.y][p.x]) || seen.has(cellKey(p))) continue;
    seen.add(cellKey(p)); queue.push(p);
  }
  return queue;
}
function pathToExit(map: number[][]): Position[] {
  const queue: Position[][] = [[{ x: 1, y: 1 }]], seen = new Set(['1,1']);
  for (const path of queue) {
    const last = path[path.length - 1]; if (map[last.y][last.x] === TileType.EXIT) return path;
    for (const [dx, dy] of directions) {
      const p = { x: last.x + dx, y: last.y + dy };
      if (map[p.y]?.[p.x] === undefined || isClosedTile(map[p.y][p.x]) || seen.has(cellKey(p))) continue;
      seen.add(cellKey(p)); queue.push([...path, p]);
    }
  }
  return [];
}
const hazardFor: Record<BiomeId, string> = { dungeon: 'trap_corridor', moss: 'toxic_spores', catacombs: 'mana_mist', frost: 'frostbound_draft', gilded: 'trap_corridor', obsidian: 'arcane_surge' };
/** Adds bounded gameplay anchors to the existing maze. Gates only replace previously solid side pockets. */
export function buildFloorPlan(map: number[][], decorations: number[][], level: number, biome: BiomeId, seed: number, carve = true): FloorState {
  const random = floorRandom(seed ^ 0xAEC20), rooms: DungeonRoom[] = [];
  const main = pathToExit(map), reachable = reachableCells(map), mainKeys = new Set(main.map(cellKey)), used = new Set<string>(['1,1']);
  const add = (type: DungeonRoomType, anchor: Position, cells: Position[] = [anchor], gate?: Position) => {
    const room: DungeonRoom = { id: `floor_${level}_${seed >>> 0}_${rooms.length}`, type, anchor: { ...anchor }, cells, ...(gate ? { gate } : {}), discovered: false, visited: false, resolved: false };
    rooms.push(room); used.add(cellKey(anchor)); if (gate) used.add(cellKey(gate)); decorations[anchor.y][anchor.x] = 0;
    return room;
  };
  if (!main.length) return { version: 1, seed: seed >>> 0, level, biome, rooms, visitedCells: [], keys: 0, pendingEncounterId: null, pendingEffects: [] };
  const boss = main[main.length - 1]; add('BOSS', boss);
  const ante = main[Math.max(1, main.length - 2)]; if (!used.has(cellKey(ante))) add('BOSS_ANTECHAMBER', ante, main.slice(-4, -1));
  const rest = main[Math.max(1, main.length - 4)]; if (!used.has(cellKey(rest))) { add('REST', rest); decorations[rest.y][rest.x] = 2; }
  const candidates = reachable.filter(p => !used.has(cellKey(p)) && p.x + p.y > 3).map(p => ({ p, score: (mainKeys.has(cellKey(p)) ? 0 : 100) + Math.min(...main.map(m => Math.abs(m.x - p.x) + Math.abs(m.y - p.y))) * 5 + random() }));
  candidates.sort((a, b) => b.score - a.score);
  const place = (type: DungeonRoomType) => { const candidate = candidates.find(c => !used.has(cellKey(c.p))); return candidate ? add(type, candidate.p) : undefined; };
  const treasure = place('TREASURE'); if (treasure) decorations[treasure.anchor.y][treasure.anchor.x] = 3;
  for (const fraction of [0.32, 0.62]) {
    const anchor = main[Math.floor(main.length * fraction)]; if (anchor && !used.has(cellKey(anchor)) && anchor.x + anchor.y > 3) add('COMBAT', anchor);
  }
  if (level >= 2) { const shrine = place('SHRINE'); if (shrine) { shrine.shrine = level % 3 === 2 ? 'blood' : level % 3 === 0 ? 'aether' : 'fortune'; decorations[shrine.anchor.y][shrine.anchor.x] = 5; } }
  if (level >= 3) { const elite = place('ELITE'); if (elite) decorations[elite.anchor.y][elite.anchor.x] = 6; }
  if (level % 2 === 0) { const trap = place('TRAP'); if (trap) trap.hazardId = hazardFor[biome]; }
  if (level % 2 === 1) { const event = place('EVENT'); if (event) decorations[event.anchor.y][event.anchor.x] = 4; }
  // Two-cell chambers are carved only from walls with a single connection to the already reachable maze.
  const pocket = (type: 'LOCKED' | 'SECRET') => {
    if (!carve) return;
    for (const entry of reachable) for (const [dx, dy] of directions) {
      const gate = { x: entry.x + dx, y: entry.y + dy };
      if (used.has(cellKey(entry)) || gate.x <= 0 || gate.y <= 0 || gate.x >= map[0].length - 1 || gate.y >= map.length - 1 || map[gate.y][gate.x] !== TileType.WALL) continue;
      const openNeighbors = (p: Position) => directions.filter(([ax, ay]) => map[p.y + ay]?.[p.x + ax] !== undefined && !isClosedTile(map[p.y + ay][p.x + ax])).length;
      if (openNeighbors(gate) !== 1) continue;
      for (const [cx, cy] of directions) {
        const inside = { x: gate.x + cx, y: gate.y + cy };
        if (inside.x <= 0 || inside.y <= 0 || inside.x >= map[0].length - 1 || inside.y >= map.length - 1 || map[inside.y][inside.x] !== TileType.WALL || openNeighbors(inside) !== 0 || used.has(cellKey(inside))) continue;
        map[gate.y][gate.x] = type === 'LOCKED' ? TileType.LOCKED : TileType.SECRET; map[inside.y][inside.x] = TileType.EMPTY;
        const room = add(type, inside, [gate, inside], gate); decorations[gate.y][gate.x] = 0; decorations[inside.y][inside.x] = 3; return room;
      }
    }
    // A one-cell sealed alcove is a safe fallback on dense mazes: carve a previously solid leaf,
    // never replace a corridor. Its approach and sealed niche are one logical area.
    for (const entry of reachable) for (const [dx, dy] of directions) {
      const gate = { x: entry.x + dx, y: entry.y + dy };
      if (gate.x <= 0 || gate.y <= 0 || gate.x >= map[0].length - 1 || gate.y >= map.length - 1 || map[gate.y][gate.x] !== TileType.WALL || used.has(cellKey(gate))) continue;
      const neighbors = directions.filter(([ax, ay]) => map[gate.y + ay]?.[gate.x + ax] !== undefined && !isClosedTile(map[gate.y + ay][gate.x + ax]));
      if (neighbors.length !== 1) continue;
      map[gate.y][gate.x] = type === 'LOCKED' ? TileType.LOCKED : TileType.SECRET;
      const room = add(type, gate, [entry, gate], gate); decorations[gate.y][gate.x] = 0; return room;
    }
  };
  pocket('LOCKED');
  if (level >= 3) pocket('SECRET');
  // Remaining walkable cells form small logical route areas, not one Room object per tile.
  const covered = new Set(rooms.flatMap(r => r.cells.map(cellKey)));
  let remaining = reachable.filter(p => !covered.has(cellKey(p)));
  while (remaining.length) {
    const cells = [remaining.shift()!];
    for (let i = 0; i < cells.length && cells.length < 8; i++) for (const [dx, dy] of directions) {
      const index = remaining.findIndex(p => p.x === cells[i].x + dx && p.y === cells[i].y + dy);
      if (index >= 0 && cells.length < 8) cells.push(...remaining.splice(index, 1));
    }
    add('NORMAL', cells[0], cells);
  }
  return { version: 1, seed: seed >>> 0, level, biome, rooms, visitedCells: [], keys: 0, pendingEncounterId: null, pendingEffects: [] };
}
/** Old saves keep their exact map and cleared path; no gates or new combat are inserted into a saved run. */
export function migrateFloor(map: number[][], decorations: number[][], level: number, biome: BiomeId): FloorState {
  const floor = buildFloorPlan(map.map(r => [...r]), decorations.map(r => [...r]), level, biome, 0xAEC000 + level, false);
  floor.rooms = floor.rooms.filter(r => r.type !== 'COMBAT');
  return floor;
}
