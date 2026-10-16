import type { WeaponVisualType } from '../types';

export interface HandPlacement { side: 'left' | 'right'; mirror: boolean; rotation: number; height: number; x: number; y: number }
/** Source sprites are right-handed, except the shield, which is already left-handed. */
export function handPresentation(weapon: WeaponVisualType, shield: boolean, width: number, height: number) {
  const place = (side: 'left' | 'right', ratio: number, maxWidthRatio: number, mirror = false, rotation = 0): HandPlacement => {
    const h = Math.min(height * ratio, width * maxWidthRatio);
    return { side, mirror, rotation, height: h, x: side === 'left' ? 0 : width, y: height + 12 };
  };
  if (weapon === 'bow') return { weapon: place('left', 0.65, 1.1, true), offhand: null };
  return {
    weapon: place('right', weapon === 'sword' ? 0.78 : weapon === 'unarmed' ? 0.5 : 0.6, weapon === 'sword' ? 1.6 : weapon === 'unarmed' ? 0.9 : 1, false, weapon === 'sword' ? -0.22 : 0),
    offhand: shield ? place('left', 0.43, 0.7) : place('left', 0.5, 0.9, true),
  };
}
