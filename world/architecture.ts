import { TileType } from '../types';

export interface WallMount {
  /** Outward-facing surface normal pointing from the wall into its walkable neighbor. */
  normalX: -1 | 0 | 1;
  normalZ: -1 | 0 | 1;
  x: number;
  z: number;
}

const MOUNT_DIRECTIONS: ReadonlyArray<{ x: -1 | 0 | 1; z: -1 | 0 | 1 }> = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
];

/** Selects an actual wall face with open space in front of it; closed doors and gates are never mount surfaces. */
export function findWallMount(map: number[][], x: number, z: number): WallMount | null {
  if (map[z]?.[x] !== TileType.WALL) return null;
  for (const direction of MOUNT_DIRECTIONS) {
    const neighbor = map[z + direction.z]?.[x + direction.x];
    if (neighbor !== TileType.EMPTY && neighbor !== TileType.EXIT) continue;
    return {
      normalX: direction.x,
      normalZ: direction.z,
      x: x + 0.5 + direction.x * 0.5,
      z: z + 0.5 + direction.z * 0.5,
    };
  }
  return null;
}
