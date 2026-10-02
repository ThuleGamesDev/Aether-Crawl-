import { Direction, PlayerTransform, TileType } from '../types';

export interface MovementInput {
  /** Forward is positive; backward is negative. */
  forward: number;
  /** Right strafe is positive; left strafe is negative. */
  strafe: number;
  /** Clockwise keyboard turn, independent from movement. */
  turn: number;
}

export type InteractionTarget =
  | { kind: 'door' | 'exit'; x: number; y: number }
  | { kind: 'prop'; x: number; y: number; decorationType: number };

export const PLAYER_RADIUS = 0.18;
export const PLAYER_MOVE_SPEED = 2.8;
export const PLAYER_TURN_SPEED = 2.2;
export const DEFAULT_MOUSE_SENSITIVITY = 0.0025;
const TAU = Math.PI * 2;

export const normalizeAngle = (angle: number): number =>
  ((angle % TAU) + TAU) % TAU;

export const directionToAngle = (direction: Direction): number => {
  switch (direction) {
    case 'N': return Math.PI * 1.5;
    case 'S': return Math.PI * 0.5;
    case 'W': return Math.PI;
    case 'E':
    default: return 0;
  }
};

export const angleToDirection = (angle: number): Direction => {
  const normalized = normalizeAngle(angle);
  const index = Math.round(normalized / (Math.PI / 2)) % 4;
  return (['E', 'S', 'W', 'N'] as const)[index];
};

/** Migrates the old integer tile position to the center of that tile. */
export const normalizePlayerTransform = (
  transform: PlayerTransform | null | undefined,
  position: { x: number; y: number } | null | undefined,
  direction: Direction | null | undefined,
): PlayerTransform => {
  if (
    transform &&
    Number.isFinite(transform.x) &&
    Number.isFinite(transform.y) &&
    Number.isFinite(transform.angle)
  ) {
    return { x: transform.x, y: transform.y, angle: normalizeAngle(transform.angle) };
  }

  const legacyPosition = position ?? { x: 1, y: 1 };
  return {
    x: (Number.isFinite(legacyPosition.x) ? legacyPosition.x : 1) + 0.5,
    y: (Number.isFinite(legacyPosition.y) ? legacyPosition.y : 1) + 0.5,
    angle: directionToAngle(direction ?? 'E'),
  };
};

export const normalizeMovementInput = (input: MovementInput): MovementInput => {
  let forward = Math.max(-1, Math.min(1, Number.isFinite(input.forward) ? input.forward : 0));
  let strafe = Math.max(-1, Math.min(1, Number.isFinite(input.strafe) ? input.strafe : 0));
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  return {
    forward,
    strafe,
    turn: Math.max(-1, Math.min(1, Number.isFinite(input.turn) ? input.turn : 0)),
  };
};

export const getTileCell = (transform: Pick<PlayerTransform, 'x' | 'y'>) => ({
  x: Math.floor(transform.x),
  y: Math.floor(transform.y),
});

export const hasEnteredNewTile = (
  previous: { x: number; y: number } | null | undefined,
  current: { x: number; y: number },
): boolean => !previous || previous.x !== current.x || previous.y !== current.y;

const isSolid = (map: number[][], x: number, y: number): boolean =>
  y < 0 || y >= map.length || x < 0 || x >= (map[y]?.length ?? 0) || map[y][x] === TileType.WALL;

/** Circle-versus-grid collision, including the dungeon boundary. */
export const canOccupyPosition = (
  map: number[][],
  x: number,
  y: number,
  radius = PLAYER_RADIUS,
): boolean => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);

  for (let tileY = minY; tileY <= maxY; tileY += 1) {
    for (let tileX = minX; tileX <= maxX; tileX += 1) {
      if (!isSolid(map, tileX, tileY)) continue;
      const nearestX = Math.max(tileX, Math.min(x, tileX + 1));
      const nearestY = Math.max(tileY, Math.min(y, tileY + 1));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return false;
    }
  }

  return true;
};

export interface MovementResult {
  transform: PlayerTransform;
  distance: number;
}

export const moveFirstPerson = (
  map: number[][],
  transform: PlayerTransform,
  rawInput: MovementInput,
  deltaSeconds: number,
  speed = PLAYER_MOVE_SPEED,
  radius = PLAYER_RADIUS,
): MovementResult => {
  const input = normalizeMovementInput(rawInput);
  const dt = Math.max(0, Math.min(0.05, Number.isFinite(deltaSeconds) ? deltaSeconds : 0));
  const angle = normalizeAngle(transform.angle + input.turn * PLAYER_TURN_SPEED * dt);
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const distanceX = (forwardX * input.forward + rightX * input.strafe) * speed * dt;
  const distanceY = (forwardY * input.forward + rightY * input.strafe) * speed * dt;

  let x = transform.x;
  let y = transform.y;
  if (canOccupyPosition(map, x + distanceX, y, radius)) x += distanceX;
  if (canOccupyPosition(map, x, y + distanceY, radius)) y += distanceY;

  return {
    transform: { x, y, angle },
    distance: Math.hypot(x - transform.x, y - transform.y),
  };
};

/** Finds the first usable door, exit, or floor prop within the look ray. */
export const getLookInteraction = (
  map: number[][],
  decorations: number[][],
  transform: PlayerTransform,
  maxDistance = 1.5,
): InteractionTarget | null => {
  const directionX = Math.cos(transform.angle);
  const directionY = Math.sin(transform.angle);
  const start = getTileCell(transform);
  const currentTile = map[start.y]?.[start.x];
  if (currentTile === TileType.DOOR) return { kind: 'door', x: start.x, y: start.y };
  if (currentTile === TileType.EXIT) return { kind: 'exit', x: start.x, y: start.y };
  const currentDecoration = decorations[start.y]?.[start.x] ?? 0;
  if (currentDecoration > 1) return { kind: 'prop', x: start.x, y: start.y, decorationType: currentDecoration };

  for (let distance = 0.08; distance <= maxDistance; distance += 0.04) {
    const x = Math.floor(transform.x + directionX * distance);
    const y = Math.floor(transform.y + directionY * distance);
    if (x === start.x && y === start.y) continue;
    if (y < 0 || y >= map.length || x < 0 || x >= (map[y]?.length ?? 0)) return null;

    const tile = map[y][x];
    if (tile === TileType.WALL) return null;
    if (tile === TileType.DOOR) return { kind: 'door', x, y };
    if (tile === TileType.EXIT) return { kind: 'exit', x, y };

    const decorationType = decorations[y]?.[x] ?? 0;
    if (decorationType > 1) return { kind: 'prop', x, y, decorationType };
  }

  return null;
};
