import { TileType, type Position } from '../types';

export interface GridRayHit {
  x: number;
  y: number;
  tile: number;
  distance: number;
  side: 0 | 1;
}

export interface WorldCircleCollider {
  position: { x: number; z: number };
  radius: number;
}

export const isWorldSolid = (tile: number | undefined): boolean =>
  tile === undefined || tile === TileType.WALL || tile === TileType.DOOR || tile === TileType.LOCKED || tile === TileType.SECRET;

export function canOccupyWorldPosition(map: number[][], x: number, z: number, radius = 0.18): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const minX = Math.floor(x - radius), maxX = Math.floor(x + radius);
  const minZ = Math.floor(z - radius), maxZ = Math.floor(z + radius);
  for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      if (!isWorldSolid(map[cellZ]?.[cellX])) continue;
      const nearX = Math.max(cellX, Math.min(x, cellX + 1));
      const nearZ = Math.max(cellZ, Math.min(z, cellZ + 1));
      const dx = x - nearX, dz = z - nearZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
  }
  return true;
}

export function moveWithWallSlide(map: number[][], x: number, z: number, dx: number, dz: number, radius = 0.18): Position {
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 0.08));
  const stepX = dx / steps, stepZ = dz / steps;
  let nextX = x, nextZ = z;
  for (let i = 0; i < steps; i += 1) {
    if (canOccupyWorldPosition(map, nextX + stepX, nextZ, radius)) nextX += stepX;
    if (canOccupyWorldPosition(map, nextX, nextZ + stepZ, radius)) nextZ += stepZ;
  }
  return { x: nextX, y: nextZ };
}

export function moveWithEntitySlide(
  map: number[][],
  x: number,
  z: number,
  dx: number,
  dz: number,
  entities: readonly WorldCircleCollider[],
  radius = 0.18,
): Position {
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 0.08));
  const stepX = dx / steps, stepZ = dz / steps;
  let nextX = x, nextZ = z;
  const isClear = (candidateX: number, candidateZ: number) => canOccupyWorldPosition(map, candidateX, candidateZ, radius)
    && entities.every(entity => Math.hypot(candidateX - entity.position.x, candidateZ - entity.position.z) >= radius + entity.radius);
  for (let index = 0; index < steps; index += 1) {
    if (isClear(nextX + stepX, nextZ)) nextX += stepX;
    if (isClear(nextX, nextZ + stepZ)) nextZ += stepZ;
  }
  return { x: nextX, y: nextZ };
}

export function raycastGrid(map: number[][], x: number, z: number, directionX: number, directionZ: number, maxDistance = 20): GridRayHit | null {
  if (!Number.isFinite(x + z + directionX + directionZ) || Math.hypot(directionX, directionZ) < 0.0001) return null;
  const stepX = directionX < 0 ? -1 : 1;
  const stepZ = directionZ < 0 ? -1 : 1;
  let cellX = Math.floor(x), cellZ = Math.floor(z);
  const deltaX = directionX === 0 ? Infinity : Math.abs(1 / directionX);
  const deltaZ = directionZ === 0 ? Infinity : Math.abs(1 / directionZ);
  let sideX = directionX < 0 ? (x - cellX) * deltaX : (cellX + 1 - x) * deltaX;
  let sideZ = directionZ < 0 ? (z - cellZ) * deltaZ : (cellZ + 1 - z) * deltaZ;
  for (let i = 0; i < 512; i += 1) {
    let distance: number, side: 0 | 1;
    if (sideX < sideZ) { distance = sideX; sideX += deltaX; cellX += stepX; side = 0; }
    else { distance = sideZ; sideZ += deltaZ; cellZ += stepZ; side = 1; }
    if (distance > maxDistance) return null;
    const tile = map[cellZ]?.[cellX];
    if (isWorldSolid(tile)) return { x: cellX, y: cellZ, tile: tile ?? TileType.WALL, distance, side };
  }
  return null;
}

export function hasLineOfSight(map: number[][], fromX: number, fromZ: number, toX: number, toZ: number, padding = 0.12): boolean {
  const dx = toX - fromX, dz = toZ - fromZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= padding) return true;
  const hit = raycastGrid(map, fromX, fromZ, dx / distance, dz / distance, Math.max(0, distance - padding));
  return !hit;
}

export function nextGridStep(map: number[][], from: Position, to: Position): Position | null {
  const startKey = from.x + ',' + from.y;
  const targetKey = to.x + ',' + to.y;
  if (startKey === targetKey) return { ...from };
  const queue: Position[] = [{ ...from }];
  const previous = new Map<string, string | null>([[startKey, null]]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    for (const [dx, dz] of directions) {
      const next = { x: current.x + dx, y: current.y + dz };
      const key = next.x + ',' + next.y;
      if (previous.has(key) || isWorldSolid(map[next.y]?.[next.x])) continue;
      previous.set(key, current.x + ',' + current.y);
      if (key === targetKey) {
        let cursor = key, parent = previous.get(cursor);
        while (parent && parent !== startKey) { cursor = parent; parent = previous.get(cursor); }
        const [x, y] = cursor.split(',').map(Number);
        return { x, y };
      }
      queue.push(next);
    }
  }
  return null;
}
