import React from 'react';
import { getItemIconKind, ITEM_ICON_PIXELS, getItemIconToneColor } from '../data/itemIconRegistry';
import type { ItemInstance } from '../types';

export const ItemIcon: React.FC<{ item: ItemInstance; className?: string }> = ({ item, className = '' }) => {
  const kind = getItemIconKind(item);
  const pixels = ITEM_ICON_PIXELS[kind];
  return <span className={'fps-pixel-item-icon ' + className} aria-hidden="true">
    <svg viewBox="0 0 16 16" role="presentation" shapeRendering="crispEdges">
      {pixels.map(([x, y, width, height, tone], index) => <rect key={index} x={x} y={y} width={width} height={height} fill={getItemIconToneColor(tone, item.rarity)} />)}
      {item.rarity === 'UNIQUE' && <path d="M13 1h1v1h1v1h-1v1h-1V3h-1V2h1z" fill="#fff1bd" />}
    </svg>
  </span>;
};

export default ItemIcon;
