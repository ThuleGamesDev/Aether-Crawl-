import { describe, expect, it } from 'vitest';
import {
  combatAudioCategory,
  getWorldCuePitchScale,
  shouldPlayCombatCue,
} from '../services/combatAudioPolicy';

describe('combat audio gating', () => {
  it('gates crowded impacts and boss telegraphs by category using audio time', () => {
    const last = new Map([['impact', 1] as const, ['telegraph', 1] as const]);
    expect(combatAudioCategory('stoneImpact')).toBe('impact');
    expect(combatAudioCategory('bossTelegraph')).toBe('telegraph');
    expect(shouldPlayCombatCue('enemyHit', 1.03, last)).toBe(false);
    expect(shouldPlayCombatCue('bronzeImpact', 1.07, last)).toBe(true);
    expect(shouldPlayCombatCue('bossTelegraph', 1.2, last)).toBe(false);
    expect(shouldPlayCombatCue('bossTelegraph', 1.25, last)).toBe(true);
    expect(shouldPlayCombatCue('playerHit', Number.NaN, last)).toBe(false);
  });

  it('adds deterministic, subtle pitch variation from the world position', () => {
    const first = getWorldCuePitchScale({ x: 2.25, z: 4.5 });
    expect(getWorldCuePitchScale({ x: 2.25, z: 4.5 })).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0.99);
    expect(first).toBeLessThanOrEqual(1.01);
    expect(getWorldCuePitchScale()).toBe(1);
  });
});
