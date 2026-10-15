import { describe, expect, it } from 'vitest';
import { planeRow } from '../services/dungeonRender';

describe('perspective floor projection', () => {
  it('follows the world camera and keeps horizon samples finite', () => {
    const at = { x: 1.5, y: 1.5, angle: 0 };
    const row = planeRow(320, 200, 150, at);
    expect(row.distance).toBe(2); expect(row.x).toBe(3.5); expect(row.stepY).toBeGreaterThan(0);
    const moved = planeRow(320, 200, 150, { ...at, x: 2.5 });
    expect(moved.x - row.x).toBe(1);
    expect(Object.values(planeRow(320, 200, 100, at)).every(Number.isFinite)).toBe(true);
  });
  it('rotates floor sampling with the view rather than sliding a flat background', () => {
    const row = planeRow(320, 200, 150, { x: 1.5, y: 1.5, angle: Math.PI / 2 });
    expect(row.y).toBeCloseTo(3.5); expect(row.stepX).toBeLessThan(0);
  });
});
