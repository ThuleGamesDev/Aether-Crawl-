import type { Character, ClassType, Enemy, Item, Player } from '../types';

export const CLASS_INITIATIVE: Record<ClassType, number> = {
  BARBARIAN: 9, PALADIN: 8, SORCERER: 10, ROGUE: 14,
  RANGER: 13, CLERIC: 9, MONK: 14, NECROMANCER: 9,
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const baseInitiative = (value: number | undefined, fallback = 10): number =>
  Number.isFinite(value) && value! > 0 ? clamp(value!, 1, 30) : fallback;

/** Rarity/defense does not imply weight. Legacy armor defaults to medium. */
export function equipmentInitiativePenalty(item: Item | null | undefined): number {
  if (item?.type === 'SHIELD') return 1;
  if (item?.type !== 'ARMOR') return 0;
  return item.armorWeight === 'LIGHT' ? 1 : item.armorWeight === 'HEAVY' ? 4 : 2;
}
export function characterInitiative(character: Character): number {
  const load = Object.values(character.equipment).reduce((total, item) => total + equipmentInitiativePenalty(item), 0);
  return Math.max(1, baseInitiative(character.stats.initiative, CLASS_INITIATIVE[character.classType] ?? 10) - load);
}
export const enemyInitiative = (enemy: Enemy): number => baseInitiative(enemy.initiative);
export const normalizePlayerInitiative = (player: Player): Player => ({
  ...player,
  party: player.party.map(character => ({ ...character, stats: {
    ...character.stats, initiative: baseInitiative(character.stats.initiative, CLASS_INITIATIVE[character.classType] ?? 10),
  } })),
});
