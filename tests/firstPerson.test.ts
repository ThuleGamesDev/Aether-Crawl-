import { describe, expect, it } from 'vitest';
import { TileType } from '../types';
import {
  angleToDirection,
  canOccupyPosition,
  directionToAngle,
  getLookInteraction,
  getTileCell,
  hasEnteredNewTile,
  moveFirstPerson,
  normalizeMovementInput,
  normalizePlayerTransform,
} from '../services/firstPerson';

const openMap = () => {
  const map = Array.from({ length: 5 }, () => Array(5).fill(TileType.EMPTY));
  for (let i = 0; i < 5; i += 1) {
    map[0][i] = TileType.WALL;
    map[4][i] = TileType.WALL;
    map[i][0] = TileType.WALL;
    map[i][4] = TileType.WALL;
  }
  return map;
};

describe('first-person exploration', () => {
  it('migrates old cardinal saves to centered continuous transforms', () => {
    const migrated = normalizePlayerTransform(undefined, { x: 4, y: 7 }, 'N');
    expect(migrated.x).toBe(4.5);
    expect(migrated.y).toBe(7.5);
    expect(migrated.angle).toBe(directionToAngle('N'));
    expect(angleToDirection(migrated.angle)).toBe('N');
  });

  it('keeps valid free angles and wraps them into one turn', () => {
    expect(normalizePlayerTransform({ x: 2.25, y: 3.75, angle: -0.5 }, { x: 1, y: 1 }, 'E'))
      .toEqual({ x: 2.25, y: 3.75, angle: Math.PI * 2 - 0.5 });
  });

  it('normalizes diagonal input without changing cardinal speed', () => {
    const input = normalizeMovementInput({ forward: 1, strafe: 1, turn: 0 });
    expect(Math.hypot(input.forward, input.strafe)).toBeCloseTo(1);
    expect(normalizeMovementInput({ forward: 0.25, strafe: -0.5, turn: 0.4 }))
      .toEqual({ forward: 0.25, strafe: -0.5, turn: 0.4 });
  });

  it('blocks circle collision at walls and lets the player slide along them', () => {
    const map = openMap();
    map[2][3] = TileType.WALL;
    expect(canOccupyPosition(map, 2.83, 2.5)).toBe(false);

    const moved = moveFirstPerson(
      map,
      { x: 2.75, y: 2.5, angle: 0 },
      { forward: 1, strafe: 0.5, turn: 0 },
      0.05,
    );
    expect(moved.transform.x).toBe(2.75);
    expect(moved.transform.y).toBeGreaterThan(2.5);
    expect(canOccupyPosition(map, moved.transform.x, moved.transform.y)).toBe(true);
  });

  it('strafes perpendicular to view without changing the angle', () => {
    const moved = moveFirstPerson(
      openMap(),
      { x: 2.5, y: 2.5, angle: 0 },
      { forward: 0, strafe: 1, turn: 0 },
      0.05,
    );
    expect(moved.transform.x).toBeCloseTo(2.5);
    expect(moved.transform.y).toBeGreaterThan(2.5);
    expect(moved.transform.angle).toBe(0);
  });

  it('reports tile changes once and keeps float positions mapped to grid cells', () => {
    const current = getTileCell({ x: 2.8, y: 3.1 });
    expect(current).toEqual({ x: 2, y: 3 });
    expect(hasEnteredNewTile(current, { x: 2.95, y: 3.9 })).toBe(false);
    expect(hasEnteredNewTile(current, { x: 3, y: 3 })).toBe(true);
  });

  it('finds interactions in front of the player and stops at walls', () => {
    const map = openMap();
    const decorations = Array.from({ length: 5 }, () => Array(5).fill(0));
    decorations[2][3] = 4;
    expect(getLookInteraction(map, decorations, { x: 2.5, y: 2.5, angle: 0 }))
      .toEqual({ kind: 'prop', x: 3, y: 2, decorationType: 4 });

    map[2][3] = TileType.WALL;
    expect(getLookInteraction(map, decorations, { x: 2.5, y: 2.5, angle: 0 })).toBeNull();
  });
});
