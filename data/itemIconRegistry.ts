import type { ItemInstance, ItemRarity } from '../types';

export type ItemIconKind = 'sword' | 'dagger' | 'axe' | 'hammer' | 'bow' | 'staff' | 'shield' | 'armor' | 'potion' | 'ring' | 'amulet' | 'scroll';
export type ItemIconTone = 'outline' | 'metal' | 'light' | 'dark' | 'accent' | 'glass';
export type ItemIconPixel = readonly [x: number, y: number, width: number, height: number, tone: ItemIconTone];

const baseIcon: Readonly<Record<string, ItemIconKind>> = Object.freeze({
  labrys: 'axe', cyclopean_hammer: 'hammer', dory_spear: 'sword', xiphos: 'sword', kopis: 'dagger', serpent_fang: 'dagger',
  labyrinth_bow: 'bow', oracle_staff: 'staff', asclepiad_staff: 'hammer', chthonic_staff: 'staff', pankration_wraps: 'armor',
  aspis: 'shield', guardian_aspis: 'shield', linothorax: 'armor', bronze_cuirass: 'armor', cretan_pelt: 'armor', greaves: 'armor',
  lamia_veil: 'armor', laurel_circlet: 'ring', ares_votive: 'amulet', chthonic_seal: 'amulet', threadbound_seal: 'amulet',
  serpent_ring: 'ring', bronze_signet: 'ring', threaded_amulet: 'amulet', healing_draught: 'potion', nectar_flask: 'potion',
});

export const ITEM_ICON_PIXELS: Readonly<Record<ItemIconKind, readonly ItemIconPixel[]>> = {
  sword: [[7,1,2,8,'light'],[9,2,2,7,'metal'],[6,8,5,2,'metal'],[7,10,2,4,'dark'],[5,13,6,1,'accent'],[7,14,2,1,'outline']],
  dagger: [[9,2,2,6,'light'],[7,6,4,2,'metal'],[8,8,2,4,'dark'],[6,11,6,1,'accent'],[8,12,2,2,'outline']],
  axe: [[7,4,2,10,'dark'],[2,3,6,2,'light'],[2,5,5,2,'metal'],[8,2,6,2,'light'],[10,4,4,2,'metal'],[4,14,7,1,'accent']],
  hammer: [[7,5,2,9,'dark'],[3,3,9,3,'light'],[4,6,7,1,'metal'],[6,14,5,1,'accent']],
  bow: [[10,1,3,2,'accent'],[8,3,2,2,'light'],[6,5,2,2,'metal'],[5,7,2,2,'light'],[6,9,2,2,'metal'],[8,11,2,2,'light'],[10,13,3,2,'accent'],[5,7,1,3,'dark']],
  staff: [[7,1,2,13,'dark'],[8,1,2,12,'light'],[5,1,2,2,'accent'],[10,1,2,2,'metal'],[6,14,5,1,'accent']],
  shield: [[5,2,6,2,'light'],[3,4,10,2,'metal'],[3,6,10,4,'light'],[4,10,8,2,'metal'],[6,12,4,2,'dark'],[7,5,2,8,'accent']],
  armor: [[5,2,6,2,'light'],[3,4,3,2,'metal'],[10,4,3,2,'metal'],[4,6,8,6,'light'],[6,12,4,2,'dark'],[7,5,2,7,'accent']],
  potion: [[6,2,4,2,'accent'],[7,4,2,2,'metal'],[5,6,6,6,'glass'],[6,12,4,2,'light'],[5,14,6,1,'outline']],
  ring: [[6,3,4,2,'light'],[4,5,2,5,'metal'],[10,5,2,5,'metal'],[6,10,4,2,'accent'],[7,5,2,3,'glass']],
  amulet: [[7,1,2,3,'accent'],[6,4,4,2,'light'],[5,6,6,5,'metal'],[7,11,2,3,'glass'],[6,14,4,1,'accent']],
  scroll: [[4,3,8,9,'light'],[5,2,6,1,'accent'],[5,5,6,1,'dark'],[5,8,6,1,'dark'],[5,11,4,1,'metal'],[11,4,2,7,'outline']],
};

export function getItemIconKind(item: Pick<ItemInstance, 'baseId' | 'id' | 'type' | 'visualType'>): ItemIconKind {
  const known = baseIcon[item.baseId ?? item.id];
  if (known) return known;
  if (item.type === 'POTION') return 'potion';
  if (item.type === 'SCROLL') return 'scroll';
  if (item.type === 'SHIELD') return 'shield';
  if (item.type === 'ARMOR') return 'armor';
  if (item.type === 'ACCESSORY') return 'amulet';
  if (item.visualType === 'bow') return 'bow';
  if (item.visualType === 'staff') return 'staff';
  if (item.visualType === 'axe') return 'axe';
  if (item.visualType === 'mace') return 'hammer';
  if (item.visualType === 'dagger') return 'dagger';
  return 'sword';
}

export function getRarityColor(rarity: ItemRarity): string {
  if (rarity === 'UNIQUE') return '#ffd675';
  if (rarity === 'RARE') return '#e9a84e';
  if (rarity === 'MAGIC') return '#82b7e4';
  return '#c3bba9';
}

export function getItemIconToneColor(tone: ItemIconTone, rarity: ItemRarity): string {
  const rarityColor = getRarityColor(rarity);
  const colors: Record<ItemIconTone, string> = {
    outline: '#171619', metal: '#ab7550', light: '#edcf96', dark: '#584235', accent: rarityColor, glass: '#77b99f',
  };
  return colors[tone];
}
