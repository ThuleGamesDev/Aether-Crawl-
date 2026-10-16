import { describe, expect, it } from 'vitest';
import { handPresentation } from '../services/handPresentation';
import type { WeaponVisualType } from '../types';

describe('first-person hand ownership', () => {
  it('mirrors the right-hand empty source for the left offhand, but keeps a left-authored shield', () => {
    const bare = handPresentation('mace', false, 390, 844), shield = handPresentation('sword', true, 390, 844);
    expect(bare.weapon.side).toBe('right'); expect(bare.weapon.mirror).toBe(false);
    expect(bare.offhand?.side).toBe('left'); expect(bare.offhand?.mirror).toBe(true);
    expect(shield.offhand?.mirror).toBe(false); expect(shield.weapon.rotation).toBeLessThan(0);
  });
  it('holds the bow on the left and suppresses a duplicate empty hand or shield', () => {
    for (const shield of [false, true]) {
      const pose = handPresentation('bow', shield, 844, 390);
      expect(pose.weapon.side).toBe('left'); expect(pose.weapon.mirror).toBe(true); expect(pose.offhand).toBeNull();
    }
  });
  it('keeps all seven weapon layouts finite on portrait and landscape screens', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1366, 768]]) {
      for (const type of ['sword', 'dagger', 'axe', 'mace', 'staff', 'bow', 'unarmed'] as WeaponVisualType[]) {
        const pose = handPresentation(type, false, w, h);
        expect(pose.weapon.height).toBeGreaterThan(0); expect(pose.weapon.height).toBeLessThan(h);
        expect(Number.isFinite(pose.weapon.rotation)).toBe(true);
      }
    }
  });
});
