
import { floorRandom } from './floorRandom';
import { buildFloorPlan } from './dungeonPlan';
import { decorateLabyrinthLayout, generateLabyrinthLayout } from './labyrinthLayout';
import { MAP_SIZE } from '../constants';
import { BiomeId, DungeonData, Position, TileType } from '../types';
import { createAriadneThreadProgress } from './ariadneThread';

export interface DungeonGenerationOptions {
  /** Used by the FPS runtime only; legacy callers keep their original 12x12 footprint. */
  mapSize?: number;
  guardianArenaRadius?: number;
  /** New spatial layout for newly generated FPS floors; legacy maps remain on the recursive backtracker. */
  topology?: 'LEGACY' | 'ARCHITECTURAL';
}

export const generateDungeon = (_biome: BiomeId = 'dungeon', seed = Math.floor(Math.random() * 4294967296), level = 1, options: DungeonGenerationOptions = {}): DungeonData => {
  const random = floorRandom(seed);
  const mapSize = options.mapSize ?? MAP_SIZE;
  const arenaRadius = Math.max(0, Math.floor(options.guardianArenaRadius ?? 0));
  if (!Number.isInteger(mapSize) || mapSize < 11 || mapSize > 64) throw new Error('Dungeon map size must be an integer from 11 to 64.');
  if (arenaRadius > 0 && (mapSize < arenaRadius * 2 + 7 || mapSize % 2 === 0)) throw new Error('Guardian arenas require an odd map with sufficient interior space.');

  if (options.topology === 'ARCHITECTURAL') {
    const layout = generateLabyrinthLayout(mapSize, seed, level, arenaRadius);
    const floor = buildFloorPlan(layout.map, layout.decorations, level, _biome, seed, true, arenaRadius, layout.architectureRooms, layout.threadJunctions);
    floor.threadJunctions = layout.threadJunctions;
    floor.threadProgress = createAriadneThreadProgress(layout.threadJunctions);
    decorateLabyrinthLayout(layout.map, layout.decorations, layout.architectureRooms, floor, seed);
    return { map: layout.map, decorations: layout.decorations, floor };
  }

  const map = Array(mapSize).fill(0).map(() => Array(mapSize).fill(TileType.WALL));
  const decorations = Array(mapSize).fill(0).map(() => Array(mapSize).fill(0));

  // Recursive Backtracker
  const stack: Position[] = [];
  const start: Position = { x: 1, y: 1 };
  
  map[start.y][start.x] = TileType.EMPTY;
  stack.push(start);

  const dirs = [
    { x: 0, y: -2 }, // N
    { x: 2, y: 0 },  // E
    { x: 0, y: 2 },  // S
    { x: -2, y: 0 }  // W
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors: Position[] = [];

    // Shuffle directions
    for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const d of dirs) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      
      if (nx > 0 && nx < mapSize - 1 && ny > 0 && ny < mapSize - 1 && map[ny][nx] === TileType.WALL) {
        neighbors.push({ x: nx, y: ny });
      }
    }

    if (neighbors.length > 0) {
      const next = neighbors[0];
      // Carve path
      map[next.y][next.x] = TileType.EMPTY;
      map[current.y + (next.y - current.y) / 2][current.x + (next.x - current.x) / 2] = TileType.EMPTY;
      stack.push(next);
    } else {
      stack.pop();
    }
  }

  // Find Exit (furthest empty tile)
  let bestDist = 0;
  let exitPos = { x: 1, y: 1 };
  
  for(let y=1; y<mapSize-1; y++) {
      for(let x=1; x<mapSize-1; x++) {
          if (map[y][x] === TileType.EMPTY) {
              if (arenaRadius > 0 && (x < arenaRadius + 1 || y < arenaRadius + 1 || x >= mapSize - arenaRadius - 1 || y >= mapSize - arenaRadius - 1)) continue;
              const dist = Math.abs(x - start.x) + Math.abs(y - start.y);
              if (dist > bestDist) {
                  bestDist = dist;
                  exitPos = { x, y };
              }
          }
      }
  }
  map[exitPos.y][exitPos.x] = TileType.EXIT;

  if (arenaRadius > 0) {
    for (let y = exitPos.y - arenaRadius; y <= exitPos.y + arenaRadius; y += 1) {
      for (let x = exitPos.x - arenaRadius; x <= exitPos.x + arenaRadius; x += 1) {
        if (x > 0 && y > 0 && x < mapSize - 1 && y < mapSize - 1) {
          map[y][x] = TileType.EMPTY;
          decorations[y][x] = 0;
        }
      }
    }
    map[exitPos.y][exitPos.x] = TileType.EXIT;
  }

  // Add Loops (remove some walls to make it less linear)
  for(let i=0; i<5; i++) {
      const rx = Math.floor(random() * (mapSize - 2)) + 1;
      const ry = Math.floor(random() * (mapSize - 2)) + 1;
      if (arenaRadius > 0 && Math.max(Math.abs(rx - exitPos.x), Math.abs(ry - exitPos.y)) <= arenaRadius + 1) continue;
      if (map[ry][rx] === TileType.WALL) {
          // check if it connects two empty spaces
          let connections = 0;
          if (map[ry+1][rx] !== TileType.WALL) connections++;
          if (map[ry-1][rx] !== TileType.WALL) connections++;
          if (map[ry][rx+1] !== TileType.WALL) connections++;
          if (map[ry][rx-1] !== TileType.WALL) connections++;
          
          if (connections >= 2) map[ry][rx] = TileType.DOOR;
      }
  }

  // DECORATIONS PASS
  // 1: Torch (Walls), 2: Barrel, 3: Crate, 4: Bones, 5-6: biome-specific props
  for(let y=1; y<mapSize-1; y++) {
      for(let x=1; x<mapSize-1; x++) {
          // Wall Decorations
          if (map[y][x] === TileType.WALL) {
              // Check if adjacent to floor
              const hasFloorNeighbor = 
                  map[y+1][x] === TileType.EMPTY || map[y-1][x] === TileType.EMPTY || 
                  map[y][x+1] === TileType.EMPTY || map[y][x-1] === TileType.EMPTY;
              
              if (hasFloorNeighbor && random() < 0.15) {
                  decorations[y][x] = 1; // Torch
              }
          }
          // Floor Decorations
          else if (map[y][x] === TileType.EMPTY) {
              // Don't block start or exit
              if ((x === start.x && y === start.y) || (x === exitPos.x && y === exitPos.y) || (arenaRadius > 0 && Math.max(Math.abs(x - exitPos.x), Math.abs(y - exitPos.y)) <= arenaRadius)) continue;

              const rand = random();
              if (rand < 0.05) decorations[y][x] = 2; // Barrel
              else if (rand < 0.1) decorations[y][x] = 3; // Crate
              else if (rand < 0.13) decorations[y][x] = 4; // Bones
              else if (rand < 0.15) decorations[y][x] = 5; // Biome prop A
              else if (rand < 0.17) decorations[y][x] = 6; // Biome prop B
          }
      }
  }

  const floor = buildFloorPlan(map, decorations, level, _biome, seed, true, arenaRadius);
  return { map, decorations, floor };
};
