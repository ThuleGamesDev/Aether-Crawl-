import type { ClassType, StatusApplication } from '../types';

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
  projectileRadius?: number;
  projectileColor?: string;
  chargeMinSeconds?: number;
  meleeStyle?: 'SWEEP' | 'THRUST' | 'BASH' | 'UNARMED';
  onHitStatus?: StatusApplication;
  selfEffect?: { type: 'HEAL' | 'GUARD'; amount?: number; durationSeconds?: number; magnitude?: number };
  healOnHit?: number;
  staggerSeconds?: number;
  targeting?: 'SELF' | 'AIMED_POINT';
  description: string;
}

export const ABILITY_REGISTRY: Record<string, AbilityDefinition> = {
  barbarian_cleave: { id: 'barbarian_cleave', name: 'Bronze Cleave', kind: 'MELEE', damage: 17, manaCost: 0, cooldownSeconds: 0.55, windupSeconds: 0.14, activeSeconds: 0.16, recoverySeconds: 0.2, range: 2.05, arcRadians: 1.35, meleeStyle: 'SWEEP', description: 'A quick, broad labrys swing.' },
  barbarian_heavy_strike: { id: 'barbarian_heavy_strike', name: 'Heroic Strike', kind: 'MELEE', damage: 34, manaCost: 0, cooldownSeconds: 1.2, windupSeconds: 0.42, activeSeconds: 0.18, recoverySeconds: 0.36, range: 2.3, arcRadians: 0.82, meleeStyle: 'SWEEP', staggerSeconds: 0.48, description: 'A committed labrys blow. The clear windup trades time for impact.' },
  barbarian_ground_slam: { id: 'barbarian_ground_slam', name: 'Ares’ Quake', kind: 'AOE', damage: 24, manaCost: 0, cooldownSeconds: 5, windupSeconds: 0.42, activeSeconds: 0.2, recoverySeconds: 0.38, range: 2.2, radius: 2.2, targeting: 'SELF', onHitStatus: { statusId: 'STAGGER', durationSeconds: 0.7, magnitude: 0.7 }, projectileColor: '#d98248', description: 'A short ground shock that damages and staggers nearby foes.' },
  sorcerer_arcane_bolt: { id: 'sorcerer_arcane_bolt', name: 'Oracle’s Spark', kind: 'PROJECTILE', damage: 13, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.06, activeSeconds: 0.08, recoverySeconds: 0.1, range: 18, projectileSpeed: 10, projectileRadius: 0.13, projectileColor: '#efd18a', description: 'A quick bolt of omen-lit bronze fire.' },
  sorcerer_charged_bolt: { id: 'sorcerer_charged_bolt', name: 'Fatebound Bolt', kind: 'PROJECTILE', damage: 34, manaCost: 4, cooldownSeconds: 1, windupSeconds: 0.13, activeSeconds: 0.08, recoverySeconds: 0.3, range: 20, projectileSpeed: 13, projectileRadius: 0.18, projectileColor: '#f1b45e', chargeMinSeconds: 0.32, onHitStatus: { statusId: 'STAGGER', durationSeconds: 0.28, magnitude: 0.28 }, description: 'Hold Secondary Attack briefly to charge a piercing oracle bolt.' },
  sorcerer_fireburst: { id: 'sorcerer_fireburst', name: 'Promethean Flame', kind: 'AOE', damage: 32, manaCost: 18, cooldownSeconds: 6, windupSeconds: 0.36, activeSeconds: 0.2, recoverySeconds: 0.42, range: 9, radius: 2.1, projectileColor: '#ef693d', onHitStatus: { statusId: 'BURN', durationSeconds: 4, magnitude: 3 }, description: 'A small fireburst at the aimed point. Burns enemies caught in the blast.' },
  paladin_arming_sword: { id: 'paladin_arming_sword', name: 'Dory Thrust', kind: 'MELEE', damage: 19, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.15, activeSeconds: 0.12, recoverySeconds: 0.18, range: 2.75, arcRadians: 0.34, meleeStyle: 'THRUST', description: 'A precise, long-reaching spear thrust with a narrow attack line.' },
  paladin_smite: { id: 'paladin_smite', name: 'Aspis Bash', kind: 'MELEE', damage: 22, manaCost: 0, cooldownSeconds: 2.8, windupSeconds: 0.18, activeSeconds: 0.12, recoverySeconds: 0.22, range: 1.75, arcRadians: 0.72, meleeStyle: 'BASH', staggerSeconds: 0.34, projectileColor: '#d4a550', description: 'Drive the Aspis into one foe to interrupt its attack.' },
  paladin_consecration: { id: 'paladin_consecration', name: 'Sacred Phalanx', kind: 'AOE', damage: 8, manaCost: 12, cooldownSeconds: 7, windupSeconds: 0.4, activeSeconds: 0.2, recoverySeconds: 0.35, range: 0, radius: 1.5, targeting: 'SELF', projectileColor: '#e9cb7a', selfEffect: { type: 'GUARD', durationSeconds: 3.5, magnitude: 0.48 }, description: 'A brief bronze ward that protects you and pushes nearby foes back.' },
  rogue_quick_stab: { id: 'rogue_quick_stab', name: 'Kopis Strike', kind: 'MELEE', damage: 16, manaCost: 0, cooldownSeconds: 0.34, windupSeconds: 0.08, activeSeconds: 0.12, recoverySeconds: 0.12, range: 1.75, arcRadians: 0.62, meleeStyle: 'SWEEP', description: 'A fast, close cut with a forward-curving blade.' },
  rogue_shadow_strike: { id: 'rogue_shadow_strike', name: 'Hermes’ Feint', kind: 'MELEE', damage: 29, manaCost: 8, cooldownSeconds: 4, windupSeconds: 0.18, activeSeconds: 0.12, recoverySeconds: 0.24, range: 2.25, arcRadians: 0.72, meleeStyle: 'THRUST', staggerSeconds: 0.3, description: 'A deceptive lunging strike that briefly staggers its target.' },
  rogue_knife_fan: { id: 'rogue_knife_fan', name: 'Kopis Fan', kind: 'PROJECTILE', damage: 16, manaCost: 10, cooldownSeconds: 4.5, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.3, range: 12, projectileSpeed: 14, projectileColor: '#d2d9e6', description: 'A thrown kopis aimed at the crosshair.' },
  ranger_shortbow: { id: 'ranger_shortbow', name: 'Artemis’ Arrow', kind: 'PROJECTILE', damage: 17, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.16, activeSeconds: 0.08, recoverySeconds: 0.2, range: 20, projectileSpeed: 18, projectileRadius: 0.09, projectileColor: '#d5b77a', description: 'A fast, direct arrow from the Hunter’s bow.' },
  ranger_piercing_arrow: { id: 'ranger_piercing_arrow', name: 'Boar-Spear Arrow', kind: 'PROJECTILE', damage: 31, manaCost: 5, cooldownSeconds: 2, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.32, range: 22, projectileSpeed: 18, projectileColor: '#efd18a', description: 'A heavier arrow with a longer windup.' },
  ranger_volley: { id: 'ranger_volley', name: 'Hunter’s Rain', kind: 'AOE', damage: 24, manaCost: 12, cooldownSeconds: 5, windupSeconds: 0.5, activeSeconds: 0.12, recoverySeconds: 0.36, range: 12, radius: 2, projectileColor: '#d5b77a', description: 'A focused burst of arrows at the aimed point.' },
  cleric_warhammer: { id: 'cleric_warhammer', name: 'Asclepiad Staff Strike', kind: 'MELEE', damage: 19, manaCost: 0, cooldownSeconds: 0.62, windupSeconds: 0.2, activeSeconds: 0.16, recoverySeconds: 0.25, range: 1.95, arcRadians: 0.78, meleeStyle: 'BASH', description: 'A deliberate blow with a bronze-capped ritual staff.' },
  cleric_holy_bolt: { id: 'cleric_holy_bolt', name: 'Temple Light', kind: 'PROJECTILE', damage: 20, manaCost: 4, cooldownSeconds: 1.1, windupSeconds: 0.2, activeSeconds: 0.08, recoverySeconds: 0.2, range: 16, projectileSpeed: 11, projectileColor: '#e9d391', description: 'A compact bolt of sacred light.' },
  cleric_restoration: { id: 'cleric_restoration', name: 'Asclepius’ Grace', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 8, windupSeconds: 0.4, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, projectileColor: '#8dbf8c', selfEffect: { type: 'HEAL', amount: 0.3 }, description: 'A self-directed rite that restores 30% of your maximum health.' },
  monk_palm_strike: { id: 'monk_palm_strike', name: 'Pankration Strike', kind: 'MELEE', damage: 14, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.06, activeSeconds: 0.1, recoverySeconds: 0.1, range: 1.55, arcRadians: 0.7, meleeStyle: 'UNARMED', description: 'A fast unarmed strike drawn from pankration.' },
  monk_flurry: { id: 'monk_flurry', name: 'Pankration Flurry', kind: 'MELEE', damage: 31, manaCost: 5, cooldownSeconds: 3.5, windupSeconds: 0.18, activeSeconds: 0.3, recoverySeconds: 0.24, range: 1.7, arcRadians: 0.95, description: 'A rapid sequence of close strikes.' },
  monk_flying_kick: { id: 'monk_flying_kick', name: 'Olympian Kick', kind: 'MELEE', damage: 32, manaCost: 8, cooldownSeconds: 4.5, windupSeconds: 0.34, activeSeconds: 0.16, recoverySeconds: 0.3, range: 2.4, arcRadians: 0.72, description: 'A forceful forward kick with extended reach.' },
  necromancer_bone_shard: { id: 'necromancer_bone_shard', name: 'Styx Shard', kind: 'PROJECTILE', damage: 15, manaCost: 0, cooldownSeconds: 0.36, windupSeconds: 0.1, activeSeconds: 0.08, recoverySeconds: 0.16, range: 18, projectileSpeed: 10, projectileColor: '#b9b5a1', description: 'A pale shard pulled from the river’s dark bank.' },
  necromancer_soul_drain: { id: 'necromancer_soul_drain', name: 'Hades’ Grasp', kind: 'PROJECTILE', damage: 25, manaCost: 8, cooldownSeconds: 3.2, windupSeconds: 0.26, activeSeconds: 0.08, recoverySeconds: 0.25, range: 14, projectileSpeed: 8, projectileRadius: 0.16, projectileColor: '#8c607d', healOnHit: 5, description: 'A slow chthonic bolt that restores 5 health when it strikes.' },
  necromancer_corpse_burst: { id: 'necromancer_corpse_burst', name: 'Underworld Eruption', kind: 'AOE', damage: 28, manaCost: 14, cooldownSeconds: 5.5, windupSeconds: 0.42, activeSeconds: 0.18, recoverySeconds: 0.35, range: 8, radius: 2, projectileColor: '#8c5369', description: 'Black-red force erupts at a point before the hero.' },
};

export interface ClassAbilityLoadout {
  primary: string;
  secondary: string;
  skill: string;
  skillSlots: [string | null, string | null, string | null, string | null];
}

export const CLASS_ABILITY_LOADOUT: Record<ClassType, ClassAbilityLoadout> = {
  BARBARIAN: { primary: 'barbarian_cleave', secondary: 'barbarian_heavy_strike', skill: 'barbarian_ground_slam', skillSlots: ['barbarian_ground_slam', null, null, null] },
  PALADIN: { primary: 'paladin_arming_sword', secondary: 'paladin_smite', skill: 'paladin_consecration', skillSlots: ['paladin_consecration', null, null, null] },
  SORCERER: { primary: 'sorcerer_arcane_bolt', secondary: 'sorcerer_charged_bolt', skill: 'sorcerer_fireburst', skillSlots: ['sorcerer_fireburst', null, null, null] },
  ROGUE: { primary: 'rogue_quick_stab', secondary: 'rogue_shadow_strike', skill: 'rogue_knife_fan', skillSlots: ['rogue_knife_fan', null, null, null] },
  RANGER: { primary: 'ranger_shortbow', secondary: 'ranger_piercing_arrow', skill: 'ranger_volley', skillSlots: ['ranger_volley', null, null, null] },
  CLERIC: { primary: 'cleric_warhammer', secondary: 'cleric_holy_bolt', skill: 'cleric_restoration', skillSlots: ['cleric_restoration', null, null, null] },
  MONK: { primary: 'monk_palm_strike', secondary: 'monk_flurry', skill: 'monk_flying_kick', skillSlots: ['monk_flying_kick', null, null, null] },
  NECROMANCER: { primary: 'necromancer_bone_shard', secondary: 'necromancer_soul_drain', skill: 'necromancer_corpse_burst', skillSlots: ['necromancer_corpse_burst', null, null, null] },
};

export const getAbility = (id: string): AbilityDefinition | undefined => ABILITY_REGISTRY[id];

export function getSkillAbilityId(classId: ClassType, slot: number): string | null {
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) return null;
  return CLASS_ABILITY_LOADOUT[classId].skillSlots[slot - 1];
}

export function abilityTooltip(ability: AbilityDefinition): string {
  const effect = ability.selfEffect?.type === 'HEAL' ? `Heal ${Math.round((ability.selfEffect.amount ?? 0) * 100)}% of max health`
    : ability.selfEffect?.type === 'GUARD' ? `Guard for ${(ability.selfEffect.durationSeconds ?? 0).toFixed(1)}s`
    : ability.kind === 'MELEE' ? `${ability.damage} damage · ${ability.range.toFixed(1)}m range`
    : ability.kind === 'PROJECTILE' ? `${ability.damage} damage · ${ability.range}m range`
    : `${ability.damage} damage · ${ability.radius ?? 0}m radius`;
  const status = ability.onHitStatus ? ` · ${ability.onHitStatus.statusId.toLowerCase()} ${ability.onHitStatus.durationSeconds}s` : '';
  const charge = ability.chargeMinSeconds ? ` · charge ${(ability.chargeMinSeconds * 1000).toFixed(0)}ms+` : '';
  return `${ability.name} — ${effect}${status} · ${ability.manaCost} MP · ${ability.cooldownSeconds.toFixed(1)}s cooldown${charge}. ${ability.description}`;
}
