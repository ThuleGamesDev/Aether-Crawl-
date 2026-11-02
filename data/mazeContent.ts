import type { BiomeId, WorldEnemyRole } from '../types';

export interface LabyrinthTheme {
  biomeId: BiomeId;
  name: string;
  epithet: string;
  stone: string;
  metal: string;
  accent: string;
}

/** The old biome IDs remain save-stable; only their in-world identity changes. */
export const LABYRINTH_THEMES: Record<BiomeId, LabyrinthTheme> = {
  dungeon: { biomeId: 'dungeon', name: 'Palace Foundations', epithet: 'The First Descent', stone: 'weathered Cretan limestone', metal: 'aged bronze', accent: 'oxblood red' },
  moss: { biomeId: 'moss', name: 'Serpent Galleries', epithet: 'The Green Coil', stone: 'salt-damp limestone', metal: 'verdigris bronze', accent: 'serpent green' },
  catacombs: { biomeId: 'catacombs', name: 'Cyclopean Halls', epithet: 'The Mason Kings', stone: 'monolithic grey stone', metal: 'blackened bronze', accent: 'deep coral red' },
  frost: { biomeId: 'frost', name: 'Forgotten Cisterns', epithet: 'The Still Water', stone: 'water-worn limestone', metal: 'blue-green bronze', accent: 'cold teal' },
  gilded: { biomeId: 'gilded', name: 'Chthonic Depths', epithet: 'The House Below', stone: 'charcoal-black basalt', metal: 'blood-dark bronze', accent: 'offering red' },
  obsidian: { biomeId: 'obsidian', name: 'Heart of the Maze', epithet: 'The Horned Silence', stone: 'black volcanic glass', metal: 'ancient bronze', accent: 'ember red' },
};

export type GuardianAttackSet = 'gatekeeper' | 'serpent_priestess' | 'cyclopean_mason' | 'lamia' | 'threadbound_warden';

export interface FloorGuardianDefinition {
  id: string;
  name: string;
  visualId: string;
  attackSetId: GuardianAttackSet;
  behaviorRole: WorldEnemyRole;
  health: number;
  damage: number;
  xpReward: number;
  floor: number;
  entranceLine: string;
  trophyName: string;
}

export const FLOOR_GUARDIANS: readonly FloorGuardianDefinition[] = [
  { id: 'guardian_bronze_gatekeeper', name: 'Bronze Gatekeeper', visualId: 'guardian_bronze_gatekeeper', attackSetId: 'gatekeeper', behaviorRole: 'HEAVY', health: 98, damage: 10, xpReward: 65, floor: 1, entranceLine: 'The Bronze Gatekeeper raises its shield. The descent is sealed.', trophyName: 'Gatekeeper’s Bronze Seal' },
  { id: 'guardian_serpent_priestess', name: 'Serpent Priestess', visualId: 'guardian_serpent_priestess', attackSetId: 'serpent_priestess', behaviorRole: 'CONTROLLER', health: 124, damage: 11, xpReward: 82, floor: 2, entranceLine: 'The Serpent Priestess coils around the stair. Venom beads along her blade.', trophyName: 'Serpent Priestess’ Votive Fang' },
  { id: 'guardian_cyclopean_mason', name: 'Cyclopean Mason', visualId: 'guardian_cyclopean_mason', attackSetId: 'cyclopean_mason', behaviorRole: 'HEAVY', health: 152, damage: 13, xpReward: 102, floor: 3, entranceLine: 'The Cyclopean Mason tears a block from the wall and turns toward you.', trophyName: 'Mason’s Bronze Plumb' },
  { id: 'guardian_lamia_cistern', name: 'Lamia of the Cistern', visualId: 'guardian_lamia_cistern', attackSetId: 'lamia', behaviorRole: 'SKIRMISHER', health: 164, damage: 12, xpReward: 120, floor: 4, entranceLine: 'The Lamia rises from the black water. Her shadow moves first.', trophyName: 'Lamia’s Cistern Laurel' },
  { id: 'guardian_threadbound_warden', name: 'Threadbound Warden', visualId: 'guardian_threadbound_warden', attackSetId: 'threadbound_warden', behaviorRole: 'CONTROLLER', health: 196, damage: 13, xpReward: 145, floor: 5, entranceLine: 'The Threadbound Warden draws a red line across the gate. The air tightens.', trophyName: 'Warden’s Labyrinth Thread' },
];

/** Later floors reuse the five non-Minotaur guardians until a deeper boss wave replaces them. */
export function getFloorGuardianDefinition(level: number): FloorGuardianDefinition {
  const safeLevel = Math.max(1, Math.floor(level));
  return FLOOR_GUARDIANS[(safeLevel - 1) % FLOOR_GUARDIANS.length];
}

export const FLOOR_ENEMY_ROSTERS: Record<number, readonly string[]> = {
  1: ['giant_rat', 'skeleton_warrior'],
  2: ['acid_spider', 'goblin_scavenger'],
  3: ['bandit_rogue', 'orc_brute'],
  4: ['dark_cultist', 'green_slime'],
  5: ['cave_troll', 'fire_elemental', 'specter'],
};
