import { describe, expect, it } from 'vitest';
import { MAP_SIZE } from '../constants';
import { generateDungeon } from '../services/dungeonGenerator';
import { TileType } from '../types';

describe('generateDungeon', () => {
  it('creates a bounded map with one reachable exit', () => {
    for (let run = 0; run < 12; run += 1) {
      const { map } = generateDungeon();
      expect(map).toHaveLength(MAP_SIZE);
      expect(map.every(row => row.length === MAP_SIZE)).toBe(true);
      expect(map[1][1]).toBe(TileType.EMPTY);

      const exits: Array<{ x: number; y: number }> = [];
      map.forEach((row, y) => row.forEach((tile, x) => { if (tile === TileType.EXIT) exits.push({ x, y }); }));
      expect(exits).toHaveLength(1);

      const visited = new Set(['1,1']);
      const queue = [{ x: 1, y: 1 }];
      while (queue.length) {
        const current = queue.shift()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = current.x + dx;
          const y = current.y + dy;
          const key = `${x},${y}`;
          if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE || visited.has(key)) continue;
          if (map[y][x] === TileType.WALL) continue;
          visited.add(key);
          queue.push({ x, y });
        }
      }
      expect(visited.has(`${exits[0].x},${exits[0].y}`)).toBe(true);
    }
  });
});
