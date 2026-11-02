import type { EnemyRole } from '../types';

export interface EnemyDefinition {
  /** Canonical id and legacy fields remain compatible with archived initiative-combat data. */
  id: string;
  name: string;
  initiative: number;
  hp: number;
  damage: number;
  xp: number;
  minLevel?: number;
  visualId: string;
  category: 'normal' | 'miniBoss' | 'biomeBoss';
  role?: EnemyRole;
  abilities?: string[];
  /** Presentation and attack data consumed only by the active Maze FPS runtime. */
  fpsName: string;
  fpsDescription: string;
  fpsVisualId: string;
  attackSetId: string;
  fpsHp: number;
  fpsDamage: number;
  fpsXp: number;
}

/**
 * Stable ids and legacy display fields are retained for inactive party-game modules.
 * The active FPS reads the explicitly named fps* presentation fields and attackSetId.
 */
export const enemyDefinitions: EnemyDefinition[] = [
  { id: 'giant_rat', initiative: 16, name: 'Giant Rat', hp: 15, damage: 4, xp: 10, minLevel: 1, visualId: 'giant_rat', category: 'normal', role: 'STRIKER', abilities: ['rat_bite', 'rat_desperate_bite'], fpsHp: 16, fpsDamage: 4, fpsXp: 10, fpsName: 'Cretan Cave Rat', fpsDescription: 'A pale, sharp-toothed scavenger drawn to old offerings.', fpsVisualId: 'cretan_cave_rat', attackSetId: 'rat' },
  { id: 'acid_spider', initiative: 15, name: 'Acid Spider', hp: 25, damage: 6, xp: 15, minLevel: 1, visualId: 'acid_spider', category: 'normal', role: 'CONTROLLER', abilities: ['spider_venom_fang', 'spider_web'], fpsHp: 24, fpsDamage: 6, fpsXp: 15, fpsName: 'Arachne’s Brood', fpsDescription: 'A bronze-marked cave spider that spits bitter venom.', fpsVisualId: 'arachne_brood', attackSetId: 'spider' },
  { id: 'goblin_scavenger', initiative: 14, name: 'Goblin Scavenger', hp: 40, damage: 8, xp: 20, minLevel: 2, visualId: 'goblin_scavenger', category: 'normal', role: 'DISRUPTOR', abilities: ['goblin_stab', 'goblin_scavenge'], fpsHp: 38, fpsDamage: 7, fpsXp: 20, fpsName: 'Tomb Plunderer', fpsDescription: 'A desperate tomb-robber wrapped in stolen linen and trinkets.', fpsVisualId: 'tomb_plunderer', attackSetId: 'plunderer' },
  { id: 'skeleton_warrior', initiative: 8, name: 'Skeleton Warrior', hp: 60, damage: 10, xp: 30, minLevel: 3, visualId: 'skeleton_warrior', category: 'normal', role: 'TANK', abilities: ['skeleton_slash', 'skeleton_raise_shield'], fpsHp: 40, fpsDamage: 8, fpsXp: 25, fpsName: 'Bronze Revenant', fpsDescription: 'An oath-bound warrior returned in corroded bronze and bone.', fpsVisualId: 'bronze_revenant', attackSetId: 'revenant' },
  { id: 'bandit_rogue', initiative: 15, name: 'Bandit Rogue', hp: 50, damage: 12, xp: 35, minLevel: 4, visualId: 'bandit_rogue', category: 'normal', fpsHp: 46, fpsDamage: 9, fpsXp: 30, fpsName: 'Labyrinth Raider', fpsDescription: 'A quick raider who knows where the old passages narrow.', fpsVisualId: 'labyrinth_raider', attackSetId: 'raider' },
  { id: 'orc_brute', initiative: 7, name: 'Orc Brute', hp: 100, damage: 15, xp: 50, minLevel: 5, visualId: 'orc_brute', category: 'normal', role: 'SCALER', abilities: ['orc_slam', 'orc_wind_up', 'orc_crushing_blow', 'orc_recover'], fpsHp: 84, fpsDamage: 13, fpsXp: 45, fpsName: 'Bull-Cult Enforcer', fpsDescription: 'A masked cult bruiser carrying a heavy, horn-shaped club.', fpsVisualId: 'bull_cult_enforcer', attackSetId: 'bull_enforcer' },
  { id: 'dark_cultist', initiative: 10, name: 'Dark Cultist', hp: 80, damage: 20, xp: 60, minLevel: 6, visualId: 'dark_cultist', category: 'normal', role: 'SUPPORT', abilities: ['cultist_dark_bolt', 'cultist_dark_chant'], fpsHp: 70, fpsDamage: 15, fpsXp: 52, fpsName: 'Chthonic Acolyte', fpsDescription: 'A keeper of offerings who hurls embers from the world below.', fpsVisualId: 'chthonic_acolyte', attackSetId: 'acolyte' },
  { id: 'green_slime', initiative: 6, name: 'Green Slime', hp: 120, damage: 8, xp: 60, minLevel: 7, visualId: 'green_slime', category: 'normal', role: 'SCALER', abilities: ['slime_bounce', 'slime_unstable', 'slime_split'], fpsHp: 92, fpsDamage: 7, fpsXp: 52, fpsName: 'Stygian Ooze', fpsDescription: 'A black-green pool of underworld matter that gathers into a body.', fpsVisualId: 'stygian_ooze', attackSetId: 'ooze' },
  { id: 'cave_troll', initiative: 6, name: 'Cave Troll', hp: 200, damage: 25, xp: 100, minLevel: 8, visualId: 'cave_troll', category: 'normal', fpsHp: 145, fpsDamage: 19, fpsXp: 82, fpsName: 'Cyclopean Brute', fpsDescription: 'A one-eyed stone-hauler with a builder’s strength and a broken temper.', fpsVisualId: 'cyclopean_brute', attackSetId: 'brute' },
  { id: 'fire_elemental', initiative: 12, name: 'Fire Elemental', hp: 150, damage: 30, xp: 120, minLevel: 9, visualId: 'fire_elemental', category: 'normal', fpsHp: 118, fpsDamage: 21, fpsXp: 94, fpsName: 'Forge Wraith', fpsDescription: 'A coal-red spirit kindled in the buried foundries.', fpsVisualId: 'forge_wraith', attackSetId: 'forge_wraith' },
  { id: 'specter', initiative: 15, name: 'Specter', hp: 100, damage: 30, xp: 110, minLevel: 10, visualId: 'specter', category: 'normal', fpsHp: 86, fpsDamage: 19, fpsXp: 88, fpsName: 'Restless Shade', fpsDescription: 'A broken echo of someone who never found the way out.', fpsVisualId: 'restless_shade', attackSetId: 'shade' },
  { id: 'stone_golem', initiative: 5, name: 'Stone Golem', hp: 300, damage: 20, xp: 150, minLevel: 11, visualId: 'stone_golem', category: 'normal', fpsHp: 220, fpsDamage: 17, fpsXp: 120, fpsName: 'Bronze Automaton', fpsDescription: 'A jointed guardian machine left to obey a vanished king.', fpsVisualId: 'bronze_automaton', attackSetId: 'automaton' },
  { id: 'vampire_spawn', initiative: 15, name: 'Vampire Spawn', hp: 180, damage: 35, xp: 180, minLevel: 13, visualId: 'vampire_spawn', category: 'normal', fpsHp: 140, fpsDamage: 25, fpsXp: 150, fpsName: 'Empusa', fpsDescription: 'A night-haunting shape that slips between shadow and flame.', fpsVisualId: 'empusa', attackSetId: 'empusa' },
  { id: 'beholder', initiative: 10, name: 'Beholder', hp: 250, damage: 45, xp: 250, minLevel: 15, visualId: 'beholder', category: 'normal', fpsHp: 180, fpsDamage: 32, fpsXp: 205, fpsName: 'Gorgon Seer', fpsDescription: 'A many-eyed oracle whose gaze hardens flesh and courage alike.', fpsVisualId: 'gorgon_seer', attackSetId: 'gorgon' },
  { id: 'ice_elemental', initiative: 8, name: 'Ice Elemental', hp: 280, damage: 35, xp: 220, minLevel: 18, visualId: 'ice_elemental', category: 'normal', fpsHp: 208, fpsDamage: 28, fpsXp: 190, fpsName: 'Cistern Nereid', fpsDescription: 'A cold water-spirit formed where the cistern has never seen the sun.', fpsVisualId: 'cistern_nereid', attackSetId: 'shade' },
  { id: 'void_dragon', initiative: 9, name: 'Void Dragon', hp: 500, damage: 40, xp: 500, minLevel: 20, visualId: 'void_dragon', category: 'normal', fpsHp: 360, fpsDamage: 34, fpsXp: 420, fpsName: 'Chthonic Drake', fpsDescription: 'A scaled underworld predator, far smaller than the horned master below.', fpsVisualId: 'chthonic_drake', attackSetId: 'drake' },
  { id: 'chaos_knight', initiative: 7, name: 'Chaos Knight', hp: 600, damage: 60, xp: 600, minLevel: 25, visualId: 'chaos_knight', category: 'normal', fpsHp: 430, fpsDamage: 48, fpsXp: 520, fpsName: 'Cursed Champion', fpsDescription: 'A fallen champion whose bronze armor bears a broken oath.', fpsVisualId: 'cursed_champion', attackSetId: 'champion' },
  { id: 'dungeon_warden', initiative: 8, name: 'Dungeon Warden', hp: 120, damage: 15, xp: 100, visualId: 'dungeon_warden', category: 'miniBoss', fpsHp: 110, fpsDamage: 13, fpsXp: 82, fpsName: 'Bronze Gateward', fpsDescription: 'An older automaton built to guard a sealed treasury.', fpsVisualId: 'bronze_gateward', attackSetId: 'automaton' },
  { id: 'giant_slime', initiative: 5, name: 'Giant Slime', hp: 150, damage: 12, xp: 100, visualId: 'giant_slime', category: 'miniBoss', fpsHp: 138, fpsDamage: 10, fpsXp: 86, fpsName: 'Stygian Ooze Matriarch', fpsDescription: 'A deep cistern mass that swallows bronze and bone alike.', fpsVisualId: 'stygian_ooze_matriarch', attackSetId: 'ooze' },
  { id: 'cursed_knight', initiative: 7, name: 'Cursed Knight', hp: 140, damage: 18, xp: 120, visualId: 'cursed_knight', category: 'miniBoss', fpsHp: 132, fpsDamage: 16, fpsXp: 104, fpsName: 'Vow-Broken Champion', fpsDescription: 'A champion bound to the maze by an oath spoken in blood.', fpsVisualId: 'vow_broken_champion', attackSetId: 'champion' },
  { id: 'bandit_king', initiative: 12, name: 'Bandit King', hp: 130, damage: 20, xp: 130, visualId: 'bandit_king', category: 'miniBoss', fpsHp: 124, fpsDamage: 17, fpsXp: 112, fpsName: 'Tomb-Robber Archon', fpsDescription: 'A plunderer who has crowned himself lord of the buried halls.', fpsVisualId: 'tomb_robber_archon', attackSetId: 'raider' },
  { id: 'mimic_queen', initiative: 9, name: 'Mimic Queen', hp: 200, damage: 25, xp: 200, visualId: 'mimic_queen', category: 'miniBoss', fpsHp: 186, fpsDamage: 22, fpsXp: 172, fpsName: 'Labyrinth Maw', fpsDescription: 'A hungry stone-and-bronze mimic shaped like a votive chest.', fpsVisualId: 'labyrinth_maw', attackSetId: 'brute' },
  { id: 'the_necromancer', initiative: 10, name: 'The Necromancer', hp: 400, damage: 25, xp: 500, visualId: 'the_necromancer', category: 'biomeBoss', role: 'SUPPORT', abilities: ['necromancer_soul_bolt', 'necromancer_summon_dead', 'necromancer_curse', 'necromancer_mass_raise_prepare', 'necromancer_mass_raise', 'necromancer_soul_harvest'], fpsHp: 360, fpsDamage: 23, fpsXp: 460, fpsName: 'Chthonic Hierophant', fpsDescription: 'A high priest of the buried rites, not the master of the maze.', fpsVisualId: 'chthonic_hierophant', attackSetId: 'threadbound_warden' },
  { id: 'moss_golem', initiative: 5, name: 'Moss Golem', hp: 600, damage: 30, xp: 800, visualId: 'moss_golem', category: 'biomeBoss', fpsHp: 540, fpsDamage: 27, fpsXp: 720, fpsName: 'Serpent Gate Colossus', fpsDescription: 'A carved sentinel overgrown with roots and serpent reliefs.', fpsVisualId: 'serpent_gate_colossus', attackSetId: 'brute' },
  { id: 'lich_lord', initiative: 10, name: 'Lich Lord', hp: 800, damage: 40, xp: 1200, visualId: 'lich_lord', category: 'biomeBoss', fpsHp: 720, fpsDamage: 36, fpsXp: 1040, fpsName: 'Restless King', fpsDescription: 'A dead ruler still demanding tribute from empty chambers.', fpsVisualId: 'restless_king', attackSetId: 'shade' },
  { id: 'frost_giant', initiative: 6, name: 'Frost Giant', hp: 1000, damage: 45, xp: 1600, visualId: 'frost_giant', category: 'biomeBoss', fpsHp: 880, fpsDamage: 40, fpsXp: 1380, fpsName: 'Cistern Titan', fpsDescription: 'A towering water-worn figure carved before the first palace.', fpsVisualId: 'cistern_titan', attackSetId: 'cyclopean_mason' },
  { id: 'golden_emperor', initiative: 8, name: 'Golden Emperor', hp: 1500, damage: 55, xp: 2500, visualId: 'golden_emperor', category: 'biomeBoss', fpsHp: 1260, fpsDamage: 48, fpsXp: 2100, fpsName: 'Bronze Tyrant', fpsDescription: 'A king-shaped automaton plated in tarnished votive bronze.', fpsVisualId: 'bronze_tyrant', attackSetId: 'gatekeeper' },
  { id: 'obsidian_lord', initiative: 7, name: 'Obsidian Lord', hp: 2000, damage: 70, xp: 3000, visualId: 'obsidian_lord', category: 'biomeBoss', fpsHp: 1700, fpsDamage: 60, fpsXp: 2600, fpsName: 'Basalt Lord', fpsDescription: 'A deep-maze champion of black stone, never the Minotaur himself.', fpsVisualId: 'basalt_lord', attackSetId: 'champion' },
];

export const normalEnemyDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'normal');
export const miniBossDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'miniBoss');
export const biomeBossDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'biomeBoss');

export function getEnemyDefinition(id: string): EnemyDefinition | undefined {
  return enemyDefinitions.find(enemy => enemy.id === id);
}
