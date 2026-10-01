import type { EnemyRole } from '../types';

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  damage: number;
  xp: number;
  minLevel?: number;
  visualId: string;
  category: 'normal' | 'miniBoss' | 'biomeBoss';
  role?: EnemyRole;
  abilities?: string[];
}

export const enemyDefinitions: EnemyDefinition[] = [
  { id: 'giant_rat', name: 'Giant Rat', hp: 15, damage: 4, xp: 10, minLevel: 1, visualId: 'giant_rat', category: 'normal', role: 'STRIKER', abilities: ['rat_bite', 'rat_desperate_bite'] },
  { id: 'acid_spider', name: 'Acid Spider', hp: 25, damage: 6, xp: 15, minLevel: 1, visualId: 'acid_spider', category: 'normal', role: 'CONTROLLER', abilities: ['spider_venom_fang', 'spider_web'] },
  { id: 'goblin_scavenger', name: 'Goblin Scavenger', hp: 40, damage: 8, xp: 20, minLevel: 2, visualId: 'goblin_scavenger', category: 'normal', role: 'DISRUPTOR', abilities: ['goblin_stab', 'goblin_scavenge'] },
  { id: 'skeleton_warrior', name: 'Skeleton Warrior', hp: 60, damage: 10, xp: 30, minLevel: 3, visualId: 'skeleton_warrior', category: 'normal', role: 'TANK', abilities: ['skeleton_slash', 'skeleton_raise_shield'] },
  { id: 'bandit_rogue', name: 'Bandit Rogue', hp: 50, damage: 12, xp: 35, minLevel: 4, visualId: 'bandit_rogue', category: 'normal' },
  { id: 'orc_brute', name: 'Orc Brute', hp: 100, damage: 15, xp: 50, minLevel: 5, visualId: 'orc_brute', category: 'normal', role: 'SCALER', abilities: ['orc_slam', 'orc_wind_up', 'orc_crushing_blow', 'orc_recover'] },
  { id: 'dark_cultist', name: 'Dark Cultist', hp: 80, damage: 20, xp: 60, minLevel: 6, visualId: 'dark_cultist', category: 'normal', role: 'SUPPORT', abilities: ['cultist_dark_bolt', 'cultist_dark_chant'] },
  { id: 'green_slime', name: 'Green Slime', hp: 120, damage: 8, xp: 60, minLevel: 7, visualId: 'green_slime', category: 'normal', role: 'SCALER', abilities: ['slime_bounce', 'slime_unstable', 'slime_split'] },
  { id: 'cave_troll', name: 'Cave Troll', hp: 200, damage: 25, xp: 100, minLevel: 8, visualId: 'cave_troll', category: 'normal' },
  { id: 'fire_elemental', name: 'Fire Elemental', hp: 150, damage: 30, xp: 120, minLevel: 9, visualId: 'fire_elemental', category: 'normal' },
  { id: 'specter', name: 'Specter', hp: 100, damage: 30, xp: 110, minLevel: 10, visualId: 'specter', category: 'normal' },
  { id: 'stone_golem', name: 'Stone Golem', hp: 300, damage: 20, xp: 150, minLevel: 11, visualId: 'stone_golem', category: 'normal' },
  { id: 'vampire_spawn', name: 'Vampire Spawn', hp: 180, damage: 35, xp: 180, minLevel: 13, visualId: 'vampire_spawn', category: 'normal' },
  { id: 'beholder', name: 'Beholder', hp: 250, damage: 45, xp: 250, minLevel: 15, visualId: 'beholder', category: 'normal' },
  { id: 'ice_elemental', name: 'Ice Elemental', hp: 280, damage: 35, xp: 220, minLevel: 18, visualId: 'ice_elemental', category: 'normal' },
  { id: 'void_dragon', name: 'Void Dragon', hp: 500, damage: 40, xp: 500, minLevel: 20, visualId: 'void_dragon', category: 'normal' },
  { id: 'chaos_knight', name: 'Chaos Knight', hp: 600, damage: 60, xp: 600, minLevel: 25, visualId: 'chaos_knight', category: 'normal' },
  { id: 'dungeon_warden', name: 'Dungeon Warden', hp: 120, damage: 15, xp: 100, visualId: 'dungeon_warden', category: 'miniBoss' },
  { id: 'giant_slime', name: 'Giant Slime', hp: 150, damage: 12, xp: 100, visualId: 'giant_slime', category: 'miniBoss' },
  { id: 'cursed_knight', name: 'Cursed Knight', hp: 140, damage: 18, xp: 120, visualId: 'cursed_knight', category: 'miniBoss' },
  { id: 'bandit_king', name: 'Bandit King', hp: 130, damage: 20, xp: 130, visualId: 'bandit_king', category: 'miniBoss' },
  { id: 'mimic_queen', name: 'Mimic Queen', hp: 200, damage: 25, xp: 200, visualId: 'mimic_queen', category: 'miniBoss' },
  { id: 'the_necromancer', name: 'The Necromancer', hp: 400, damage: 25, xp: 500, visualId: 'the_necromancer', category: 'biomeBoss', role: 'SUPPORT', abilities: ['necromancer_soul_bolt', 'necromancer_summon_dead', 'necromancer_curse', 'necromancer_mass_raise_prepare', 'necromancer_mass_raise', 'necromancer_soul_harvest'] },
  { id: 'moss_golem', name: 'Moss Golem', hp: 600, damage: 30, xp: 800, visualId: 'moss_golem', category: 'biomeBoss' },
  { id: 'lich_lord', name: 'Lich Lord', hp: 800, damage: 40, xp: 1200, visualId: 'lich_lord', category: 'biomeBoss' },
  { id: 'frost_giant', name: 'Frost Giant', hp: 1000, damage: 45, xp: 1600, visualId: 'frost_giant', category: 'biomeBoss' },
  { id: 'golden_emperor', name: 'Golden Emperor', hp: 1500, damage: 55, xp: 2500, visualId: 'golden_emperor', category: 'biomeBoss' },
  { id: 'obsidian_lord', name: 'Obsidian Lord', hp: 2000, damage: 70, xp: 3000, visualId: 'obsidian_lord', category: 'biomeBoss' },
];

export const normalEnemyDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'normal');
export const miniBossDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'miniBoss');
export const biomeBossDefinitions = enemyDefinitions.filter(enemy => enemy.category === 'biomeBoss');
