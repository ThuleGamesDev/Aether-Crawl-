import { DungeonDecoration, TileType, type AriadneThreadJunction, type ArchitecturalRoom, type ArchitecturalRoomShape, type FloorState, type Position } from '../types';
import { floorRandom } from './floorRandom';
import { findWallMount } from '../world/architecture';

interface ChamberNode {
  row: number;
  column: number;
  centerX: number;
  centerZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  room: ArchitecturalRoom;
}

export interface LabyrinthLayout {
  map: number[][];
  decorations: number[][];
  exit: Position;
  architectureRooms: ArchitecturalRoom[];
  threadJunctions: AriadneThreadJunction[];
}

const PASSAGE_SHAPES = new Set<ArchitecturalRoomShape>(['WIDE_PASSAGE', 'NARROW_PASSAGE']);
const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Creates the new 23-cell FPS labyrinth while leaving legacy map callers on their original generator. */
export function generateLabyrinthLayout(mapSize: number, seed: number, level: number, guardianArenaRadius: number): LabyrinthLayout {
  if (mapSize < 23 || mapSize % 2 === 0 || guardianArenaRadius < 2 || guardianArenaRadius > 3) {
    throw new Error('Architectural labyrinths require an odd map of at least 23 cells and a Guardian arena radius from 2 to 3.');
  }
  const random = floorRandom((seed ^ 0x6A8F31D5) >>> 0);
  const map = Array.from({ length: mapSize }, () => Array<number>(mapSize).fill(TileType.WALL));
  const decorations = Array.from({ length: mapSize }, () => Array<number>(mapSize).fill(0));
  const centers = [3, Math.floor((mapSize - 1) / 2), mapSize - 5];
  const threadEnabled = level >= 2 && level <= 5;
  const innerShapes: ArchitecturalRoomShape[] = shuffle([
    'HALL', 'GALLERY', 'CROSSROADS', 'PILLARED_HALL', 'ROTUNDA', 'GALLERY', 'HALL',
  ], random);
  const nodes: ChamberNode[] = [];
  let shapeIndex = 0;

  for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
    const isEntry = row === 0 && column === 0;
    const isArena = row === 2 && column === 2;
    const roomShape: ArchitecturalRoomShape = isEntry ? 'ENTRY_HALL' : isArena ? 'GUARDIAN_ARENA' : innerShapes[shapeIndex++];
    let [width, depth] = dimensionsFor(roomShape, random, guardianArenaRadius);
    // Preserve a one-cell separator around the anchor chamber so each reserved Thread route owns real wall cells.
    if (threadEnabled && row === 1 && column === 1) { width = Math.min(width, 5); depth = Math.min(depth, 5); }
    // Keep a one-cell separator around all four anchor approaches, so each reserved route owns real wall cells.
    if (threadEnabled && ((row === 0 && column === 1) || (row === 2 && column === 1))) depth = Math.min(depth, 5);
    if (threadEnabled && ((row === 1 && column === 0) || (row === 1 && column === 2))) width = Math.min(width, 5);
    // Keep a solid limestone separator around the Guardian arena so its tree corridor is the only entrance.
    if (row === 1 && column === 2) depth = Math.min(depth, 5);
    if (row === 2 && column === 1) width = Math.min(width, 5);
    const centerX = centers[column], centerZ = centers[row];
    const minX = boundedStart(centerX, width, mapSize);
    const minZ = boundedStart(centerZ, depth, mapSize);
    const maxX = minX + width - 1, maxZ = minZ + depth - 1;
    const cells: Position[] = [];

    for (let z = minZ; z <= maxZ; z += 1) for (let x = minX; x <= maxX; x += 1) {
      if (!insideRoomShape(roomShape, x, z, centerX, centerZ, minX, maxX, minZ, maxZ)) continue;
      map[z][x] = TileType.EMPTY;
      cells.push({ x, y: z });
    }

    if (roomShape === 'PILLARED_HALL') {
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = centerX + dx, z = centerZ + dz;
        if (map[z]?.[x] === TileType.EMPTY) {
          map[z][x] = TileType.WALL;
          decorations[z][x] = DungeonDecoration.PILLAR;
        }
      }
    }

    const roomCells = cells.filter(cell => map[cell.y][cell.x] === TileType.EMPTY);
    const room: ArchitecturalRoom = {
      id: `arch_${level}_${seed >>> 0}_${nodes.length}`,
      cells: roomCells,
      roomShape,
      combatSuitability: isEntry ? 'LIMITED' : threadEnabled && row === 1 && column === 1 ? 'NONE' : 'SUITABLE',
      lightingTheme: lightingFor(roomShape, row, column),
      landmarkIds: landmarksFor(roomShape),
    };
    nodes.push({ row, column, centerX, centerZ, minX, maxX, minZ, maxZ, room });
  }

  const center = { row: 1, column: 1 };
  const treeEdges = buildSpanningTree(random, threadEnabled ? 2 : Number.POSITIVE_INFINITY);
  const treeKeys = new Set(treeEdges.map(edgeKey));
  const edges = [...treeEdges];
  let threadSealEdge: ReturnType<typeof centerEdges>[number] | undefined;
  let threadRevealEdge: ReturnType<typeof centerEdges>[number] | undefined;
  if (threadEnabled) {
    const uncarvedCenterEdges = centerEdges(center).filter(edge => !treeKeys.has(edgeKey(edge)));
    if (uncarvedCenterEdges.length < 2) throw new Error('The architectural center could not reserve two safe Thread routes.');
    threadSealEdge = uncarvedCenterEdges[0];
    threadRevealEdge = uncarvedCenterEdges[1];
    edges.push(threadSealEdge);
  }
  for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
    const from = { row, column };
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      const next = { row: row + dr, column: column + dc };
      if (next.row >= 3 || next.column >= 3) continue;
      const edge = [from, next] as const;
      const touchesGuardian = from.row === 2 && from.column === 2 || next.row === 2 && next.column === 2;
      if (!treeKeys.has(edgeKey(edge)) && !touchesGuardian && !edges.some(existing => edgeKey(existing) === edgeKey(edge))
        && edgeKey(edge) !== (threadRevealEdge && edgeKey(threadRevealEdge)) && random() < 0.38) edges.push(edge);
    }
  }

  const corridorRooms: ArchitecturalRoom[] = [];
  const corridorCellsUsed = new Set<string>();
  const passageCellsByEdge = new Map<string, Position[]>();
  for (const edge of edges) {
    const a = nodes[edge[0].row * 3 + edge[0].column];
    const b = nodes[edge[1].row * 3 + edge[1].column];
    const optionalLoop = !treeKeys.has(edgeKey(edge));
    const threadSeal = Boolean(threadSealEdge && edgeKey(edge) === edgeKey(threadSealEdge));
    const width = threadSeal ? 1 : optionalLoop && random() < 0.16 ? 1 : random() < 0.5 ? 2 : 3;
    const corridorCells = carveConnection(map, a, b, width);
    passageCellsByEdge.set(edgeKey(edge), corridorCells.map(cell => ({ ...cell })));
    const ownedCells = corridorCells.filter(cell => {
      const key = cell.x + ',' + cell.y;
      if (corridorCellsUsed.has(key)) return false;
      corridorCellsUsed.add(key);
      return true;
    });
    if (ownedCells.length) corridorRooms.push({
      id: `arch_${level}_${seed >>> 0}_passage_${corridorRooms.length}`,
      cells: ownedCells,
      roomShape: width === 1 ? 'NARROW_PASSAGE' : 'WIDE_PASSAGE',
      combatSuitability: 'NONE',
      lightingTheme: 'NEUTRAL',
      landmarkIds: [],
    });
  }

  const threadJunctions: AriadneThreadJunction[] = [];
  if (threadEnabled && threadSealEdge && threadRevealEdge) {
    const anchorRoom = nodes[4].room;
    const anchorPosition = anchorRoom.cells.filter(cell => map[cell.y]?.[cell.x] === TileType.EMPTY)
      .sort((a, b) => Math.hypot(a.x - nodes[4].centerX, a.y - nodes[4].centerZ) - Math.hypot(b.x - nodes[4].centerX, b.y - nodes[4].centerZ)
        || a.y - b.y || a.x - b.x)[0];
    const revealOther = otherEndpoint(threadRevealEdge, center);
    const revealMap = map.map(row => [...row]);
    const revealRouteCells = carveConnection(revealMap, nodes[4], nodes[revealOther.row * 3 + revealOther.column], 1);
    const sealRouteCells = passageCellsByEdge.get(edgeKey(threadSealEdge)) ?? [];
    if (!anchorPosition || !revealRouteCells.length || !sealRouteCells.length) throw new Error('The architectural center did not produce two editable Thread passages (anchor=' + Boolean(anchorPosition) + ', reveal=' + revealRouteCells.length + ', seal=' + sealRouteCells.length + ').');
    const junctionId = `thread_${level}_${seed >>> 0}_0`;
    anchorRoom.threadJunctionId = junctionId;
    const directionFor = (edge: ReturnType<typeof centerEdges>[number]): AriadneThreadJunction['revealRoute']['direction'] => {
      const other = otherEndpoint(edge, center);
      return other.row < center.row ? 'NORTH' : other.row > center.row ? 'SOUTH' : other.column < center.column ? 'WEST' : 'EAST';
    };
    const route = (edge: ReturnType<typeof centerEdges>[number], action: 'REVEAL_PASSAGE' | 'SEAL_PASSAGE', cells: Position[]) => {
      const other = otherEndpoint(edge, center);
      return {
        id: `thread_route_${level}_${seed >>> 0}_0_${action.toLowerCase()}`,
        action,
        direction: directionFor(edge),
        fromRoomId: anchorRoom.id,
        toRoomId: nodes[other.row * 3 + other.column].room.id,
        cells: cells.map(cell => ({ ...cell })),
      };
    };
    threadJunctions.push({
      id: junctionId,
      anchorRoomId: anchorRoom.id,
      anchorPosition: { ...anchorPosition },
      revealRoute: route(threadRevealEdge, 'REVEAL_PASSAGE', revealRouteCells),
      sealRoute: route(threadSealEdge, 'SEAL_PASSAGE', sealRouteCells),
    });
  }

  const start: Position = { x: 1, y: 1 };
  const exit = { x: centers[2], y: centers[2] };
  map[start.y][start.x] = TileType.EMPTY;
  map[exit.y][exit.x] = TileType.EXIT;
  return { map, decorations, exit, architectureRooms: [...nodes.map(node => node.room), ...corridorRooms], threadJunctions };
}

/** Adds semantic room metadata to legacy-independent spatial areas for gameplay and rendering consumers. */
export function isArchitecturalChamber(room: ArchitecturalRoom): boolean {
  return !PASSAGE_SHAPES.has(room.roomShape);
}

/** Places registered landmarks and floor dressing only after special gates and room anchors have been finalized. */
export function decorateLabyrinthLayout(map: number[][], decorations: number[][], architectureRooms: ArchitecturalRoom[], floor: FloorState, seed: number): void {
  const random = floorRandom((seed ^ 0xD3C0A7E) >>> 0);
  const combatCells = new Set<string>();
  const reservedCells = new Set<string>();
  for (const room of floor.rooms) {
    if (room.type === 'COMBAT' || room.type === 'ELITE') for (const cell of room.cells) combatCells.add(cell.x + ',' + cell.y);
    if (room.type === 'BOSS' || room.type === 'BOSS_ANTECHAMBER') for (const cell of room.cells) reservedCells.add(cell.x + ',' + cell.y);
    if (room.type !== 'NORMAL') {
      reservedCells.add(room.anchor.x + ',' + room.anchor.y);
      if (room.gate) reservedCells.add(room.gate.x + ',' + room.gate.y);
    }
  }

  for (const room of architectureRooms.filter(isArchitecturalChamber)) {
    if (room.landmarkIds.includes('fresco_panel')) placeRoomWallLandmark(map, decorations, room, DungeonDecoration.FRESCO_PANEL);
    if (room.landmarkIds.includes('bull_relief')) placeRoomWallLandmark(map, decorations, room, DungeonDecoration.BULL_RELIEF);
    if (room.landmarkIds.includes('wall_sconce')) placeRoomWallLandmark(map, decorations, room, DungeonDecoration.WALL_TORCH);
    if (room.landmarkIds.includes('oil_bowl')) placeRoomOilBowl(map, decorations, room, reservedCells, combatCells);
  }

  for (let z = 1; z < map.length - 1; z += 1) for (let x = 1; x < map[z].length - 1; x += 1) {
    if (map[z][x] !== TileType.WALL || decorations[z][x] !== 0 || !findWallMount(map, x, z)) continue;
    if (random() < 0.075) decorations[z][x] = DungeonDecoration.WALL_TORCH;
  }

  for (let z = 1; z < map.length - 1; z += 1) for (let x = 1; x < map[z].length - 1; x += 1) {
    if (map[z][x] !== TileType.EMPTY || decorations[z][x] !== 0) continue;
    const key = x + ',' + z;
    if (reservedCells.has(key) || combatCells.has(key) || Math.hypot(x - 1, z - 1) < 3.5) continue;
    const chamber = architectureRooms.find(candidate => candidate.combatSuitability === 'SUITABLE' && candidate.cells.some(cell => cell.x === x && cell.y === z));
    if (chamber) continue;
    const roll = random();
    if (roll < 0.014) decorations[z][x] = DungeonDecoration.AMPHORA;
    else if (roll < 0.028) decorations[z][x] = DungeonDecoration.BROKEN_AMPHORA;
    else if (roll < 0.038) decorations[z][x] = DungeonDecoration.LABYRINTH_TABLET;
    else if (roll < 0.045) decorations[z][x] = DungeonDecoration.OFFERING_ALTAR;
    else if (roll < 0.058) decorations[z][x] = DungeonDecoration.COLUMN_FRAGMENT;
    else if (roll < 0.072) decorations[z][x] = DungeonDecoration.OIL_BOWL;
  }
}

function placeRoomWallLandmark(map: number[][], decorations: number[][], room: ArchitecturalRoom, decoration: number): void {
  const interior = new Set(room.cells.map(cell => cell.x + ',' + cell.y));
  const centerX = room.cells.reduce((sum, cell) => sum + cell.x, 0) / Math.max(1, room.cells.length);
  const centerZ = room.cells.reduce((sum, cell) => sum + cell.y, 0) / Math.max(1, room.cells.length);
  const candidates: Array<{ x: number; z: number; distance: number }> = [];
  for (let z = 1; z < map.length - 1; z += 1) for (let x = 1; x < map[z].length - 1; x += 1) {
    if (decorations[z][x] !== 0) continue;
    const mount = findWallMount(map, x, z);
    if (!mount || !interior.has((x + mount.normalX) + ',' + (z + mount.normalZ))) continue;
    candidates.push({ x, z, distance: Math.hypot(x + 0.5 - centerX, z + 0.5 - centerZ) });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.z - b.z || a.x - b.x);
  const candidate = candidates[0];
  if (candidate) decorations[candidate.z][candidate.x] = decoration;
}

function placeRoomOilBowl(map: number[][], decorations: number[][], room: ArchitecturalRoom, reserved: Set<string>, combat: Set<string>): void {
  const centerX = room.cells.reduce((sum, cell) => sum + cell.x, 0) / Math.max(1, room.cells.length);
  const centerZ = room.cells.reduce((sum, cell) => sum + cell.y, 0) / Math.max(1, room.cells.length);
  const candidate = room.cells
    .filter(cell => map[cell.y]?.[cell.x] === TileType.EMPTY && decorations[cell.y]?.[cell.x] === 0
      && !reserved.has(cell.x + ',' + cell.y) && !combat.has(cell.x + ',' + cell.y))
    .sort((a, b) => Math.hypot(a.x - centerX, a.y - centerZ) - Math.hypot(b.x - centerX, b.y - centerZ))[0];
  if (candidate) decorations[candidate.y][candidate.x] = DungeonDecoration.OIL_BOWL;
}

function dimensionsFor(shape: ArchitecturalRoomShape, random: () => number, arenaRadius: number): [number, number] {
  if (shape === 'ENTRY_HALL') return [6, 6];
  if (shape === 'GUARDIAN_ARENA') {
    const width = Math.max(7, arenaRadius * 2 + 1);
    return [width, width];
  }
  if (shape === 'GALLERY') return random() < 0.5 ? [4 + Math.floor(random() * 2), 7] : [7, 4 + Math.floor(random() * 2)];
  if (shape === 'CROSSROADS') {
    const size = random() < 0.5 ? 5 : 6;
    return [size, size];
  }
  if (shape === 'PILLARED_HALL') {
    const size = random() < 0.5 ? 5 : 7;
    return [size, size];
  }
  if (shape === 'ROTUNDA') return [7, 7];
  return [5 + Math.floor(random() * 2), 5 + Math.floor(random() * 2)];
}

function boundedStart(center: number, size: number, mapSize: number): number {
  return Math.max(1, Math.min(center - Math.floor(size / 2), mapSize - 2 - size + 1));
}

function insideRoomShape(shape: ArchitecturalRoomShape, x: number, z: number, centerX: number, centerZ: number, minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  if (shape === 'CROSSROADS') return Math.abs(x - centerX) <= 1 || Math.abs(z - centerZ) <= 1;
  if (shape === 'ROTUNDA') {
    const radiusX = Math.max(1, (maxX - minX + 1) / 2);
    const radiusZ = Math.max(1, (maxZ - minZ + 1) / 2);
    const normalized = ((x - centerX) / radiusX) ** 2 + ((z - centerZ) / radiusZ) ** 2;
    return normalized <= 1.22;
  }
  return true;
}

function lightingFor(shape: ArchitecturalRoomShape, row: number, column: number): ArchitecturalRoom['lightingTheme'] {
  if (shape === 'GUARDIAN_ARENA') return 'CHTHONIC';
  if (row + column === 3) return 'CHTHONIC';
  if (shape === 'ROTUNDA') return 'COOL';
  if (shape === 'GALLERY' || (row + column) % 3 === 0) return 'AMBER';
  if (shape === 'PILLARED_HALL') return 'NEUTRAL';
  return 'AMBER';
}

function landmarksFor(shape: ArchitecturalRoomShape): string[] {
  if (shape === 'ENTRY_HALL') return ['wall_sconce', 'fresco_panel'];
  if (shape === 'GALLERY') return ['wall_sconce', 'fresco_panel'];
  if (shape === 'PILLARED_HALL') return ['column_array'];
  if (shape === 'ROTUNDA') return ['wall_sconce', 'oil_bowl'];
  if (shape === 'GUARDIAN_ARENA') return ['wall_sconce', 'bull_relief'];
  if (shape === 'CROSSROADS') return ['wall_sconce'];
  return [];
}

function buildSpanningTree(random: () => number, maxCenterDegree = Number.POSITIVE_INFINITY): Array<readonly [{ row: number; column: number }, { row: number; column: number }]> {
  const start = { row: 0, column: 0 };
  const visited = new Set([nodeKey(start)]);
  const stack = [start];
  const edges: Array<readonly [{ row: number; column: number }, { row: number; column: number }]> = [];
  let centerDegree = 0;
  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = CARDINALS
      .map(([dc, dr]) => ({ row: current.row + dr, column: current.column + dc }))
      .filter(next => next.row >= 0 && next.row < 3 && next.column >= 0 && next.column < 3
        && !(next.row === 2 && next.column === 2) && !visited.has(nodeKey(next))
        && (current.row !== 1 || current.column !== 1 || centerDegree < maxCenterDegree)
        && (next.row !== 1 || next.column !== 1 || centerDegree < maxCenterDegree));
    if (!neighbors.length) { stack.pop(); continue; }
    const next = neighbors[Math.floor(random() * neighbors.length)];
    visited.add(nodeKey(next));
    edges.push([current, next]);
    if (current.row === 1 && current.column === 1 || next.row === 1 && next.column === 1) centerDegree += 1;
    stack.push(next);
  }
  if (visited.size !== 8) throw new Error('The architectural spanning tree did not connect every chamber.');
  const guardianParents = [{ row: 1, column: 2 }, { row: 2, column: 1 }];
  const guardianParent = guardianParents[Math.floor(random() * guardianParents.length)];
  edges.push([guardianParent, { row: 2, column: 2 }]);
  return edges;
}

function centerEdges(center: { row: number; column: number }): Array<readonly [{ row: number; column: number }, { row: number; column: number }]> {
  return CARDINALS
    .map(([dc, dr]) => ({ row: center.row + dr, column: center.column + dc }))
    .filter(next => next.row >= 0 && next.row < 3 && next.column >= 0 && next.column < 3)
    .map(next => [center, next] as const);
}

function otherEndpoint(
  edge: readonly [{ row: number; column: number }, { row: number; column: number }],
  center: { row: number; column: number },
): { row: number; column: number } {
  return edge[0].row === center.row && edge[0].column === center.column ? edge[1] : edge[0];
}

function carveConnection(map: number[][], a: ChamberNode, b: ChamberNode, width: number): Position[] {
  const cells: Position[] = [];
  const low = -Math.floor((width - 1) / 2);
  const high = Math.ceil((width - 1) / 2);
  if (a.row === b.row) {
    const left = a.column < b.column ? a : b;
    const right = a.column < b.column ? b : a;
    for (let x = left.maxX; x <= right.minX; x += 1) for (let offset = low; offset <= high; offset += 1) {
      const z = left.centerZ + offset;
      if (map[z]?.[x] === TileType.WALL) { map[z][x] = TileType.EMPTY; cells.push({ x, y: z }); }
    }
  } else {
    const top = a.row < b.row ? a : b;
    const bottom = a.row < b.row ? b : a;
    for (let z = top.maxZ; z <= bottom.minZ; z += 1) for (let offset = low; offset <= high; offset += 1) {
      const x = top.centerX + offset;
      if (map[z]?.[x] === TileType.WALL) { map[z][x] = TileType.EMPTY; cells.push({ x, y: z }); }
    }
  }
  return cells;
}

function nodeKey(node: { row: number; column: number }): string { return node.row + ',' + node.column; }

function edgeKey(edge: readonly [{ row: number; column: number }, { row: number; column: number }]): string {
  return [nodeKey(edge[0]), nodeKey(edge[1])].sort().join('|');
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}
