import { getUniqueItem, UNIQUE_ITEMS } from '../data/uniqueItems';
import { getItemBase } from '../data/itemBases';
import type { ItemInstance } from '../types';

export { getUniqueItem, UNIQUE_ITEMS };

/** Creates authored unique instances without rolling affixes or replacing Guardian rewards. */
export function createUniqueInstance(effectId: string, instanceId: string, itemLevel: number): ItemInstance {
  const definition = getUniqueItem(effectId);
  const base = definition ? getItemBase(definition.baseId) : undefined;
  if (!definition || !base) throw new Error('Unknown unique definition: ' + effectId);
  return {
    ...base,
    id: base.baseId,
    baseId: base.baseId,
    name: definition.name,
    description: definition.description,
    instanceId,
    itemLevel: Math.max(1, Math.floor(Number.isFinite(itemLevel) ? itemLevel : 1)),
    rarity: 'UNIQUE',
    affixes: [],
    uniqueEffectId: definition.effectId,
    quantity: 1,
    ...(base.armorWeight ? { armorWeight: base.armorWeight } : {}),
  };
}

export function isUniqueItem(item: ItemInstance): boolean {
  return item.rarity === 'UNIQUE' && Boolean(getUniqueItem(item.uniqueEffectId));
}
