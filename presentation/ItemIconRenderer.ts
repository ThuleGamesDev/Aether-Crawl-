import { getItemIconKind, ITEM_ICON_PIXELS, getItemIconToneColor, getRarityColor } from '../data/itemIconRegistry';
import type { ItemInstance } from '../types';

/** Tiny deterministic pixel asset used by world drops; no external or generated-image dependency. */
export function createItemIconCanvas(item: ItemInstance): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  const border = getRarityColor(item.rarity);
  context.fillStyle = '#171416';
  context.fillRect(4, 4, 40, 40);
  context.fillStyle = border;
  context.fillRect(4, 4, 40, 2);
  context.fillRect(4, 42, 40, 2);
  context.fillRect(4, 6, 2, 36);
  context.fillRect(42, 6, 2, 36);
  for (const [x, y, width, height, tone] of ITEM_ICON_PIXELS[getItemIconKind(item)]) {
    context.fillStyle = getItemIconToneColor(tone, item.rarity);
    context.fillRect(8 + x * 2, 8 + y * 2, width * 2, height * 2);
  }
  if (item.rarity === 'UNIQUE') {
    context.fillStyle = '#fff1bd';
    context.fillRect(37, 7, 3, 3);
    context.fillRect(36, 8, 5, 1);
  }
  return canvas;
}
