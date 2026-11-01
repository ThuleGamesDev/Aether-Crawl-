import type { ClassType } from '../types';

export type AbilityKind = 'MELEE' | 'PROJECTILE' | 'AOE';
export type AbilityPhase = 'WINDUP' | 'ACTIVE' | 'RECOVERY';

export interface AbilityDefinition {
  id: string;
  name: string;
  kind: AbilityKind;
  damage: number;
  manaCost: number;
  cooldownSeconds: number;
  windupSeconds: number;
  activeSeconds: number;
  recoverySeconds: number;
  range: number;
  arcRadians?: number;
  radius?: number;
  projectileSpeed?: number;
  projectileColor?: string;
  chargeMinSeconds?: number;
  description: string;
}

export const ABILITY_REGISTRY: Record<string, AbilityDefinition> = {
  barbarian_cleave: { id: 'barbarian_cleave', name: 'Cleave', kind: 'MELEE', damage: 17, manaCost: 0, cooldownSeconds: 0.55, windupSeconds: 0.14, activeSeconds: 0.16, recoverySeconds: 0.2, range: 1.9, arcRadians: 1.25, description: 'A quick, broad axe swing.' },
  barbarian_heavy_strike: { id: 'barbarian_heavy_strike', name: 'Heavy Strike', kind: 'MELEE', damage: 34, manaCost: 0, cooldownSeconds: 1.2, windupSeconds: 0.48, activeSeconds: 0.18, recoverySeconds: 0.42, range: 2.2, arcRadians: 0.8, description: 'A slow strike with a clear windup.' },
  barbarian_ground_slam: { id: 'barbarian_ground_slam', name: 'Ground Slam', kind: 'AOE', damage: 24, manaCost: 0, cooldownSeconds: 5, windupSeconds: 0.48, activeSeconds: 0.2, recoverySeconds: 0.42, range: 2.2, radius: 2.2, description: 'A close shockwave that staggers nearby foes.' },
  sorcerer_arcane_bolt: { id: 'sorcerer_arcane_bolt', name: 'Arcane Bolt', kind: 'PROJECTILE', damage: 13, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.08, activeSeconds: 0.08, recoverySeconds: 0.12, range: 18, projectileSpeed: 10, projectileColor: '#69d8ff', description: 'A quick, low-cost magic bolt.' },
  sorcerer_charged_bolt: { id: 'sorcerer_charged_bolt', name: 'Charged Bolt', kind: 'PROJECTILE', damage: 34, manaCost: 4, cooldownSeconds: 1, windupSeconds: 0.16, activeSeconds: 0.08, recoverySeconds: 0.34, range: 20, projectileSpeed: 13, projectileColor: '#c6a5ff', chargeMinSeconds: 0.32, description: 'Hold Secondary Attack briefly to charge a piercing arcane shot.' },
  sorcerer_fireburst: { id: 'sorcerer_fireburst', name: 'Fireburst', kind: 'AOE', damage: 32, manaCost: 18, cooldownSeconds: 6, windupSeconds: 0.42, activeSeconds: 0.2, recoverySeconds: 0.5, range: 9, radius: 2.1, projectileColor: '#ff6a35', description: 'A small fire explosion at the targeted point.' },
  paladin_arming_sword: { id: 'paladin_arming_sword', name: 'Arming Sword', kind: 'MELEE', damage: 18, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.16, activeSeconds: 0.14, recoverySeconds: 0.18, range: 1.8, arcRadians: 0.85, description: 'A balanced sword attack.' },
  paladin_smite: { id: 'paladin_smite', name: 'Shield Smite', kind: 'AOE', damage: 27, manaCost: 8, cooldownSeconds: 4, windupSeconds: 0.4, activeSeconds: 0.16, recoverySeconds: 0.3, range: 1.8, radius: 1.8, projectileColor: '#ffe58a', description: 'A short holy burst around the hero.' },
  paladin_consecration: { id: 'paladin_consecration', name: 'Consecration', kind: 'AOE', damage: 25, manaCost: 14, cooldownSeconds: 7, windupSeconds: 0.55, activeSeconds: 0.2, recoverySeconds: 0.42, range: 2, radius: 2, projectileColor: '#fff0a6', description: 'A ring of light sears nearby enemies.' },
  rogue_quick_stab: { id: 'rogue_quick_stab', name: 'Quick Stab', kind: 'MELEE', damage: 16, manaCost: 0, cooldownSeconds: 0.34, windupSeconds: 0.08, activeSeconds: 0.12, recoverySeconds: 0.12, range: 1.6, arcRadians: 0.62, description: 'A fast, narrow dagger thrust.' },
  rogue_shadow_strike: { id: 'rogue_shadow_strike', name: 'Shadow Strike', kind: 'MELEE', damage: 29, manaCost: 8, cooldownSeconds: 4, windupSeconds: 0.2, activeSeconds: 0.12, recoverySeconds: 0.26, range: 2.1, arcRadians: 0.9, description: 'A sudden forward lunge.' },
  rogue_knife_fan: { id: 'rogue_knife_fan', name: 'Knife Fan', kind: 'PROJECTILE', damage: 16, manaCost: 10, cooldownSeconds: 4.5, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.3, range: 12, projectileSpeed: 14, projectileColor: '#d2d9e6', description: 'A thrown knife aimed at the crosshair.' },
  ranger_shortbow: { id: 'ranger_shortbow', name: 'Shortbow Shot', kind: 'PROJECTILE', damage: 17, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.18, activeSeconds: 0.08, recoverySeconds: 0.22, range: 20, projectileSpeed: 15, projectileColor: '#d7a968', description: 'A direct arrow shot.' },
  ranger_piercing_arrow: { id: 'ranger_piercing_arrow', name: 'Piercing Arrow', kind: 'PROJECTILE', damage: 31, manaCost: 5, cooldownSeconds: 2, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.32, range: 22, projectileSpeed: 18, projectileColor: '#ffdb8a', description: 'A heavy arrow with a longer windup.' },
  ranger_volley: { id: 'ranger_volley', name: 'Volley', kind: 'AOE', damage: 24, manaCost: 12, cooldownSeconds: 5, windupSeconds: 0.5, activeSeconds: 0.12, recoverySeconds: 0.36, range: 12, radius: 2, projectileColor: '#d7a968', description: 'A short rain of arrows at the target.' },
  cleric_warhammer: { id: 'cleric_warhammer', name: 'War Hammer', kind: 'MELEE', damage: 19, manaCost: 0, cooldownSeconds: 0.62, windupSeconds: 0.2, activeSeconds: 0.16, recoverySeconds: 0.25, range: 1.85, arcRadians: 0.8, description: 'A deliberate hammer blow.' },
  cleric_holy_bolt: { id: 'cleric_holy_bolt', name: 'Holy Bolt', kind: 'PROJECTILE', damage: 20, manaCost: 4, cooldownSeconds: 1.1, windupSeconds: 0.2, activeSeconds: 0.08, recoverySeconds: 0.2, range: 16, projectileSpeed: 11, projectileColor: '#ffe88e', description: 'A simple bolt of consecrated light.' },
  cleric_restoration: { id: 'cleric_restoration', name: 'Restoration', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 8, windupSeconds: 0.45, activeSeconds: 0.08, recoverySeconds: 0.2, range: 0, radius: 0, projectileColor: '#87ecae', description: 'Restore a portion of the hero’s health.' },
  monk_palm_strike: { id: 'monk_palm_strike', name: 'Palm Strike', kind: 'MELEE', damage: 14, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.06, activeSeconds: 0.1, recoverySeconds: 0.1, range: 1.5, arcRadians: 0.7, description: 'A fast unarmed strike.' },
  monk_flurry: { id: 'monk_flurry', name: 'Flurry', kind: 'MELEE', damage: 31, manaCost: 5, cooldownSeconds: 3.5, windupSeconds: 0.18, activeSeconds: 0.3, recoverySeconds: 0.24, range: 1.7, arcRadians: 0.95, description: 'A rapid sequence of close strikes.' },
  monk_flying_kick: { id: 'monk_flying_kick', name: 'Flying Kick', kind: 'MELEE', damage: 32, manaCost: 8, cooldownSeconds: 4.5, windupSeconds: 0.34, activeSeconds: 0.16, recoverySeconds: 0.3, range: 2.4, arcRadians: 0.72, description: 'A short, forceful lunge.' },
  necromancer_bone_shard: { id: 'necromancer_bone_shard', name: 'Bone Shard', kind: 'PROJECTILE', damage: 15, manaCost: 0, cooldownSeconds: 0.36, windupSeconds: 0.1, activeSeconds: 0.08, recoverySeconds: 0.16, range: 18, projectileSpeed: 10, projectileColor: '#c5d1d6', description: 'A sharp fragment propelled by dark magic.' },
  necromancer_soul_drain: { id: 'necromancer_soul_drain', name: 'Soul Drain', kind: 'PROJECTILE', damage: 25, manaCost: 8, cooldownSeconds: 3.2, windupSeconds: 0.28, activeSeconds: 0.08, recoverySeconds: 0.28, range: 14, projectileSpeed: 8, projectileColor: '#a66cff', description: 'A slow bolt that restores a little health on impact.' },
  necromancer_corpse_burst: { id: 'necromancer_corpse_burst', name: 'Grave Burst', kind: 'AOE', damage: 28, manaCost: 14, cooldownSeconds: 5.5, windupSeconds: 0.42, activeSeconds: 0.18, recoverySeconds: 0.35, range: 8, radius: 2, projectileColor: '#8052ba', description: 'Dark energy bursts at a point in front of the hero.' },
};

export const CLASS_ABILITY_LOADOUT: Record<ClassType, { primary: string; secondary: string; skill: string }> = {
  BARBARIAN: { primary: 'barbarian_cleave', secondary: 'barbarian_heavy_strike', skill: 'barbarian_ground_slam' },
  PALADIN: { primary: 'paladin_arming_sword', secondary: 'paladin_smite', skill: 'paladin_consecration' },
  SORCERER: { primary: 'sorcerer_arcane_bolt', secondary: 'sorcerer_charged_bolt', skill: 'sorcerer_fireburst' },
  ROGUE: { primary: 'rogue_quick_stab', secondary: 'rogue_shadow_strike', skill: 'rogue_knife_fan' },
  RANGER: { primary: 'ranger_shortbow', secondary: 'ranger_piercing_arrow', skill: 'ranger_volley' },
  CLERIC: { primary: 'cleric_warhammer', secondary: 'cleric_holy_bolt', skill: 'cleric_restoration' },
  MONK: { primary: 'monk_palm_strike', secondary: 'monk_flurry', skill: 'monk_flying_kick' },
  NECROMANCER: { primary: 'necromancer_bone_shard', secondary: 'necromancer_soul_drain', skill: 'necromancer_corpse_burst' },
};

export const getAbility = (id: string): AbilityDefinition | undefined => ABILITY_REGISTRY[id];
