import { DungeonDecoration, TileType, type ArchitecturalRoom, type BiomeId, type DungeonRoom, type DungeonRoomType, type FloorState, type Position } from '../types';
import { floorRandom } from './floorRandom';
export const cellKey = (p: Position) => `${p.x},${p.y}`;
export const isClosedTile = (tile: number) => tile === TileType.WALL || tile === TileType.DOOR || tile === TileType.LOCKED || tile === TileType.SECRET;
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
export function buildFloorPlan(map: number[][], decorations: number[][], level: number, biome: BiomeId, seed: number, carve = true, guardianArenaRadius = 0, architectureRooms: ArchitecturalRoom[] = []): FloorState {
  const random = floorRandom(seed ^ 0xAEC20), rooms: DungeonRoom[] = [];
  const main = pathToExit(map), reachable = reachableCells(map), mainKeys = new Set(main.map(cellKey)), used = new Set<string>(['1,1']);
  const add = (type: DungeonRoomType, anchor: Position, cells: Position[] = [anchor], gate?: Position) => {
    const room: DungeonRoom = { id: `floor_${level}_${seed >>> 0}_${rooms.length}`, type, anchor: { ...anchor }, cells, ...(gate ? { gate } : {}), discovered: false, visited: false, resolved: false };
    rooms.push(room);
    if ((type === 'BOSS' && guardianArenaRadius > 0) || architectureRooms.length > 0) for (const cell of cells) used.add(cellKey(cell));
    used.add(cellKey(anchor)); if (gate) used.add(cellKey(gate)); decorations[anchor.y][anchor.x] = 0;
    return room;
  };
  if (!main.length) return { version: 1, seed: seed >>> 0, level, biome, rooms, ...(architectureRooms.length ? { architectureRooms } : {}), visitedCells: [], keys: 0, pendingEncounterId: null, pendingEffects: [] };
  const boss = main[main.length - 1];
  const bossCells: Position[] = [];
  if (guardianArenaRadius > 0) {
    for (let y = boss.y - guardianArenaRadius; y <= boss.y + guardianArenaRadius; y += 1) {
      for (let x = boss.x - guardianArenaRadius; x <= boss.x + guardianArenaRadius; x += 1) {
        if (map[y]?.[x] !== undefined && !isClosedTile(map[y][x])) bossCells.push({ x, y });
      }
    }
  }
  add('BOSS', boss, bossCells.length ? bossCells : [boss]);
  const architectural = architectureRooms.length > 0;
  const bossLayout = architectureRooms.find(room => room.roomShape === 'GUARDIAN_ARENA');
  const bossCellKeys = new Set((bossLayout?.cells ?? []).map(cellKey));
  const firstArenaIndex = architectural ? main.findIndex(cell => bossCellKeys.has(cellKey(cell))) : -1;
  let anteIndex = architectural ? Math.max(1, firstArenaIndex - 1) : Math.max(1, main.length - 2);
  while (architectural && anteIndex > 1 && used.has(cellKey(main[anteIndex]))) anteIndex -= 1;
  const ante = main[anteIndex];
  const anteCells = architectural
    ? main.slice(Math.max(1, anteIndex - 2), anteIndex + 1).filter(cell => !used.has(cellKey(cell)))
    : main.slice(-4, -1);
  if (ante && !used.has(cellKey(ante))) add('BOSS_ANTECHAMBER', ante, anteCells.length ? anteCells : [ante]);

  const candidates = reachable.filter(p => !used.has(cellKey(p)) && p.x + p.y > 3).map(p => ({ p, score: (mainKeys.has(cellKey(p)) ? 0 : 100) + Math.min(...main.map(m => Math.abs(m.x - p.x) + Math.abs(m.y - p.y))) * 5 + random() }));
  candidates.sort((a, b) => b.score - a.score);
  const availableLayouts = () => architectureRooms.filter(room => !['WIDE_PASSAGE', 'NARROW_PASSAGE', 'ENTRY_HALL', 'GUARDIAN_ARENA'].includes(room.roomShape)
    && room.combatSuitability !== 'NONE' && room.cells.length >= 16 && !room.cells.some(cell => used.has(cellKey(cell))));
  const layoutDistanceToTarget = (room: ArchitecturalRoom, target: Position) => {
    const centerX = room.cells.reduce((sum, cell) => sum + cell.x, 0) / Math.max(1, room.cells.length);
    const centerY = room.cells.reduce((sum, cell) => sum + cell.y, 0) / Math.max(1, room.cells.length);
    return Math.hypot(centerX - target.x, centerY - target.y);
  };
  const layoutPathDistance = (room: ArchitecturalRoom) => Math.min(...room.cells.flatMap(cell => main.map(pathCell => Math.abs(cell.x - pathCell.x) + Math.abs(cell.y - pathCell.y))));
  const layoutAnchor = (room: ArchitecturalRoom, target?: Position): Position | undefined => {
    const centerX = room.cells.reduce((sum, cell) => sum + cell.x, 0) / Math.max(1, room.cells.length);
    const centerY = room.cells.reduce((sum, cell) => sum + cell.y, 0) / Math.max(1, room.cells.length);
    return room.cells.filter(cell => !used.has(cellKey(cell)) && !isClosedTile(map[cell.y]?.[cell.x]))
      .sort((a, b) => {
        const targetPenaltyA = target ? Math.hypot(a.x - target.x, a.y - target.y) * 0.15 : 0;
        const targetPenaltyB = target ? Math.hypot(b.x - target.x, b.y - target.y) * 0.15 : 0;
        return Math.hypot(a.x - centerX, a.y - centerY) + targetPenaltyA - Math.hypot(b.x - centerX, b.y - centerY) - targetPenaltyB;
      })[0];
  };
  const place = (type: DungeonRoomType) => {
    if (architectural) {
      const layout = availableLayouts().sort((a, b) => layoutPathDistance(b) - layoutPathDistance(a) || a.id.localeCompare(b.id))[0];
      if (layout) {
        const anchor = layoutAnchor(layout);
        if (anchor) return add(type, anchor, layout.cells);
      }
    }
    const candidate = candidates.find(c => !used.has(cellKey(c.p)));
    return candidate ? add(type, candidate.p) : undefined;
  };

  if (architectural) {
    for (const fraction of [0.32, 0.62]) {
      const target = main[Math.floor(main.length * fraction)];
      const layouts = availableLayouts().sort((a, b) => layoutDistanceToTarget(a, target) - layoutDistanceToTarget(b, target) || a.id.localeCompare(b.id));
      const selected = layouts[0];
      const anchor = selected ? layoutAnchor(selected, target) : undefined;
      if (selected && anchor) add('COMBAT', anchor, selected.cells);
    }
  }

  if (architectural) {
    const rest = place('REST');
    if (rest) decorations[rest.anchor.y][rest.anchor.x] = DungeonDecoration.AMPHORA;
  } else {
    const rest = main[Math.max(1, main.length - 4)];
    if (rest && !used.has(cellKey(rest))) {
      add('REST', rest);
      decorations[rest.y][rest.x] = DungeonDecoration.AMPHORA;
    }
  }
  const treasure = place('TREASURE'); if (treasure) decorations[treasure.anchor.y][treasure.anchor.x] = DungeonDecoration.BROKEN_AMPHORA;
  if (!architectural) {
    for (const fraction of [0.32, 0.62]) {
      const anchor = main[Math.floor(main.length * fraction)]; if (anchor && !used.has(cellKey(anchor)) && anchor.x + anchor.y > 3) add('COMBAT', anchor);
    }
  }
  if (level >= 2) { const shrine = place('SHRINE'); if (shrine) { shrine.shrine = level % 3 === 2 ? 'blood' : level % 3 === 0 ? 'aether' : 'fortune'; decorations[shrine.anchor.y][shrine.anchor.x] = DungeonDecoration.OFFERING_ALTAR; } }
  if (level >= 3) { const elite = place('ELITE'); if (elite) decorations[elite.anchor.y][elite.anchor.x] = DungeonDecoration.COLUMN_FRAGMENT; }
  if (level % 2 === 0) { const trap = place('TRAP'); if (trap) trap.hazardId = hazardFor[biome]; }
  if (level % 2 === 1) { const event = place('EVENT'); if (event) decorations[event.anchor.y][event.anchor.x] = DungeonDecoration.LABYRINTH_TABLET; }
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
  return { version: 1, seed: seed >>> 0, level, biome, rooms, ...(architectureRooms.length ? { architectureRooms } : {}), visitedCells: [], keys: 0, pendingEncounterId: null, pendingEffects: [] };
}
/** Old saves keep their exact map and cleared path; no gates or new combat are inserted into a saved run. */
export function migrateFloor(map: number[][], decorations: number[][], level: number, biome: BiomeId): FloorState {
  const floor = buildFloorPlan(map.map(r => [...r]), decorations.map(r => [...r]), level, biome, 0xAEC000 + level, false);
  floor.rooms = floor.rooms.filter(r => r.type !== 'COMBAT');
  return floor;
}
