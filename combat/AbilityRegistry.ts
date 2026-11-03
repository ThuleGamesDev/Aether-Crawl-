import type { ClassType, MagicSchool, RealtimeStatusId, StatusApplication } from '../types';
import { isPeriodicRealtimeStatus } from './StatusSystem';

const PERCENT_TOOLTIP_STATUS_IDS: ReadonlySet<string> = new Set(['SLOW', 'WEAKNESS', 'GUARD', 'COUNTER', 'BLOOD_OATH', 'HASTE', 'PRECISION', 'CURSE']);

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
  /** Optional real-time stamina cost; spells remain usable when stamina is empty. */
  staminaCost?: number;
  /** Poise pressure per successful hit window before weapon-style scaling. */
  poiseDamage?: number;
  onHitStatus?: StatusApplication;
  selfStatuses?: StatusApplication[];
  selfEffect?: { type: 'HEAL' | 'GUARD'; amount?: number; durationSeconds?: number; magnitude?: number };
  healOnHit?: number;
  staggerSeconds?: number;
  /** Number of timed hit windows during the active phase. Costs and cooldowns do not scale with rank. */
  activeHitCount?: number;
  damagePerHitMultiplier?: number;
  /** Optional element tag used by Oracle's alternating-school passive. */
  element?: MagicSchool;
  /** Collision-safe player movement before a melee resolution. */
  dashDistance?: number;
  /** Bonus against a target already below this health ratio. */
  finisher?: { healthRatio: number; damageMultiplier: number };
  /** Bounded secondary targets; damage falls off from the first hit. */
  chain?: { maxJumps: number; jumpRange: number; damageMultiplier: number };
  /** Bounded projectile fan and hit-through behavior. */
  projectileCount?: number;
  projectileSpreadRadians?: number;
  damagePerProjectileMultiplier?: number;
  pierceCount?: number;
  statusDamageBonus?: { statusId: RealtimeStatusId; multiplier: number };
  cleanseStatuses?: RealtimeStatusId[];
  requiresCounterWindow?: boolean;
  knockbackDistance?: number;
  /** Utility actions apply their declared self effects and do not deal area damage. */
  utilityOnly?: boolean;
  targeting?: 'SELF' | 'AIMED_POINT';
  description: string;
}

/** Spell scaling is explicit by stable ability ID; weapon-style strikes remain physical. */
export function getAbilityDamageType(ability: AbilityDefinition): 'PHYSICAL' | 'SPELL' {
  if (ability.id === 'cleric_warhammer') return 'PHYSICAL';
  if (ability.id.startsWith('sorcerer_') || ability.id === 'paladin_consecration' || ability.id.startsWith('cleric_') || ability.id.startsWith('necromancer_')) return 'SPELL';
  return 'PHYSICAL';
}

export const ABILITY_REGISTRY: Record<string, AbilityDefinition> = {
  barbarian_cleave: { id: 'barbarian_cleave', name: 'Bronze Cleave', kind: 'MELEE', damage: 17, manaCost: 0, cooldownSeconds: 0.55, windupSeconds: 0.14, activeSeconds: 0.16, recoverySeconds: 0.2, range: 2.05, arcRadians: 1.35, meleeStyle: 'SWEEP', description: 'A quick, broad labrys swing.' },
  barbarian_heavy_strike: { id: 'barbarian_heavy_strike', name: 'Heroic Strike', kind: 'MELEE', damage: 34, manaCost: 0, staminaCost: 18, poiseDamage: 32, cooldownSeconds: 1.2, windupSeconds: 0.42, activeSeconds: 0.18, recoverySeconds: 0.36, range: 2.3, arcRadians: 0.82, meleeStyle: 'SWEEP', staggerSeconds: 0.48, description: 'A committed labrys blow. The clear windup trades time for impact.' },
  barbarian_ground_slam: { id: 'barbarian_ground_slam', name: 'Ares’ Quake', kind: 'AOE', damage: 24, manaCost: 0, cooldownSeconds: 5, windupSeconds: 0.42, activeSeconds: 0.2, recoverySeconds: 0.38, range: 2.2, radius: 2.2, targeting: 'SELF', onHitStatus: { statusId: 'STAGGER', durationSeconds: 0.7, magnitude: 0.7 }, projectileColor: '#d98248', description: 'A short ground shock that damages and staggers nearby foes.' },
  sorcerer_arcane_bolt: { id: 'sorcerer_arcane_bolt', name: 'Oracle’s Spark', kind: 'PROJECTILE', damage: 13, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.06, activeSeconds: 0.08, recoverySeconds: 0.1, range: 18, projectileSpeed: 10, projectileRadius: 0.13, projectileColor: '#efd18a', element: 'ARCANE', description: 'A quick bolt of omen-lit bronze fire.' },
  sorcerer_charged_bolt: { id: 'sorcerer_charged_bolt', name: 'Fatebound Bolt', kind: 'PROJECTILE', damage: 34, manaCost: 4, cooldownSeconds: 1, windupSeconds: 0.13, activeSeconds: 0.08, recoverySeconds: 0.3, range: 20, projectileSpeed: 13, projectileRadius: 0.18, projectileColor: '#f1b45e', pierceCount: 1, chargeMinSeconds: 0.32, element: 'ARCANE', onHitStatus: { statusId: 'STAGGER', durationSeconds: 0.28, magnitude: 0.28 }, description: 'Hold Secondary Attack briefly to charge a bolt that pierces one additional foe.' },
  sorcerer_fireburst: { id: 'sorcerer_fireburst', name: 'Promethean Flame', kind: 'AOE', damage: 32, manaCost: 18, cooldownSeconds: 6, windupSeconds: 0.36, activeSeconds: 0.2, recoverySeconds: 0.42, range: 9, radius: 2.1, element: 'FIRE', projectileColor: '#ef693d', onHitStatus: { statusId: 'BURN', durationSeconds: 4, magnitude: 3 }, description: 'A small fireburst at the aimed point. Burns enemies caught in the blast.' },
  paladin_arming_sword: { id: 'paladin_arming_sword', name: 'Dory Thrust', kind: 'MELEE', damage: 19, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.15, activeSeconds: 0.12, recoverySeconds: 0.18, range: 2.75, arcRadians: 0.34, meleeStyle: 'THRUST', description: 'A precise, long-reaching spear thrust with a narrow attack line.' },
  paladin_smite: { id: 'paladin_smite', name: 'Aspis Bash', kind: 'MELEE', damage: 22, manaCost: 0, staminaCost: 12, poiseDamage: 26, cooldownSeconds: 2.8, windupSeconds: 0.18, activeSeconds: 0.12, recoverySeconds: 0.22, range: 1.75, arcRadians: 0.72, meleeStyle: 'BASH', staggerSeconds: 0.34, projectileColor: '#d4a550', description: 'Drive the Aspis into one foe to interrupt its attack.' },
  paladin_consecration: { id: 'paladin_consecration', name: 'Phalanx Stand', kind: 'AOE', damage: 0, manaCost: 12, cooldownSeconds: 7, windupSeconds: 0.4, activeSeconds: 0.2, recoverySeconds: 0.35, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, projectileColor: '#e9cb7a', selfEffect: { type: 'GUARD', durationSeconds: 3.5, magnitude: 0.48 }, description: 'Brace behind a bronze ward that reduces incoming damage for a short time.' },
  barbarian_bronze_cyclone: { id: 'barbarian_bronze_cyclone', name: 'Bronze Cyclone', kind: 'MELEE', damage: 15, manaCost: 0, poiseDamage: 14, cooldownSeconds: 4.8, windupSeconds: 0.18, activeSeconds: 0.36, recoverySeconds: 0.3, range: 1.9, arcRadians: Math.PI * 2, meleeStyle: 'SWEEP', activeHitCount: 3, damagePerHitMultiplier: 0.38, projectileColor: '#d89a55', description: 'Three measured full-circle sweeps resolve across a brief active window.' },
  barbarian_blood_oath: { id: 'barbarian_blood_oath', name: 'Blood Oath', kind: 'AOE', damage: 0, manaCost: 8, cooldownSeconds: 12, windupSeconds: 0.16, activeSeconds: 0.08, recoverySeconds: 0.2, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfStatuses: [{ statusId: 'BLOOD_OATH', durationSeconds: 6, magnitude: 0.25 }], projectileColor: '#9f3f3d', description: 'Gain 25% physical damage for 6 seconds and take 25% more incoming damage.' },
  barbarian_heroic_execution: { id: 'barbarian_heroic_execution', name: 'Heroic Execution', kind: 'MELEE', damage: 28, manaCost: 0, poiseDamage: 36, cooldownSeconds: 6.5, windupSeconds: 0.3, activeSeconds: 0.16, recoverySeconds: 0.35, range: 2.4, arcRadians: 0.68, meleeStyle: 'SWEEP', finisher: { healthRatio: 0.35, damageMultiplier: 1.6 }, projectileColor: '#d47a4b', description: 'A committed strike that deals 60% more damage to foes at or below 35% health.' },
  paladin_dory_impale: { id: 'paladin_dory_impale', name: 'Dory Impale', kind: 'MELEE', damage: 23, manaCost: 5, poiseDamage: 30, cooldownSeconds: 3.2, windupSeconds: 0.22, activeSeconds: 0.12, recoverySeconds: 0.22, range: 3.2, arcRadians: 0.2, meleeStyle: 'THRUST', staggerSeconds: 0.22, projectileColor: '#ddb85e', description: 'A narrow spear thrust reaches 3.2 metres and respects walls.' },
  paladin_bronze_reprisal: { id: 'paladin_bronze_reprisal', name: 'Bronze Reprisal', kind: 'AOE', damage: 0, manaCost: 6, cooldownSeconds: 8, windupSeconds: 0.12, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfStatuses: [{ statusId: 'GUARD', durationSeconds: 2.5, magnitude: 0.32 }, { statusId: 'COUNTER', durationSeconds: 3, magnitude: 0.24 }], projectileColor: '#e9cb7a', description: 'Guard for 2.5 seconds and empower one melee counter by up to 24%.' },
  paladin_aspis_charge: { id: 'paladin_aspis_charge', name: 'Aspis Charge', kind: 'MELEE', damage: 25, manaCost: 7, poiseDamage: 30, cooldownSeconds: 7, windupSeconds: 0.12, activeSeconds: 0.12, recoverySeconds: 0.3, range: 1.35, arcRadians: 0.72, meleeStyle: 'BASH', dashDistance: 1.15, staggerSeconds: 0.4, projectileColor: '#d4a550', description: 'Advance up to 1.15 metres without passing through walls, then bash.' },
  sorcerer_storm_invocation: { id: 'sorcerer_storm_invocation', name: 'Storm Invocation', kind: 'AOE', damage: 22, manaCost: 16, cooldownSeconds: 7.5, windupSeconds: 0.34, activeSeconds: 0.12, recoverySeconds: 0.32, range: 9, radius: 0.72, targeting: 'AIMED_POINT', chain: { maxJumps: 2, jumpRange: 3.2, damageMultiplier: 0.45 }, element: 'LIGHTNING', projectileColor: '#a5d8ff', description: 'Strike a small aimed area, then arc to at most two additional foes.' },
  sorcerer_prophetic_veil: { id: 'sorcerer_prophetic_veil', name: 'Prophetic Veil', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 10, windupSeconds: 0.12, activeSeconds: 0.08, recoverySeconds: 0.2, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, dashDistance: 1.1, selfEffect: { type: 'GUARD', durationSeconds: 2.5, magnitude: 0.22 }, element: 'ARCANE', projectileColor: '#b59ae8', description: 'Step up to 1.1 metres through open space and gain a brief defensive veil.' },
  sorcerer_omenfall: { id: 'sorcerer_omenfall', name: 'Omenfall', kind: 'AOE', damage: 26, manaCost: 18, cooldownSeconds: 8, windupSeconds: 0.32, activeSeconds: 0.12, recoverySeconds: 0.34, range: 10, radius: 1.35, targeting: 'AIMED_POINT', onHitStatus: { statusId: 'STAGGER', durationSeconds: 0.32, magnitude: 0.32 }, element: 'ARCANE', projectileColor: '#b59ae8', description: 'A precise arcane impact that staggers foes caught in its small blast.' },
  rogue_kopis_flurry: { id: 'rogue_kopis_flurry', name: 'Kopis Flurry', kind: 'MELEE', damage: 18, manaCost: 6, poiseDamage: 10, cooldownSeconds: 3.8, windupSeconds: 0.12, activeSeconds: 0.36, recoverySeconds: 0.22, range: 1.75, arcRadians: 0.82, meleeStyle: 'SWEEP', activeHitCount: 3, damagePerHitMultiplier: 0.35, projectileColor: '#c8d0df', description: 'Three quick cuts resolve across a short, focused active window.' },
  rogue_venomous_cut: { id: 'rogue_venomous_cut', name: 'Venomous Cut', kind: 'MELEE', damage: 12, manaCost: 4, cooldownSeconds: 3, windupSeconds: 0.08, activeSeconds: 0.12, recoverySeconds: 0.16, range: 1.85, arcRadians: 0.48, meleeStyle: 'THRUST', onHitStatus: { statusId: 'POISON', durationSeconds: 3, magnitude: 2, tickIntervalSeconds: 1 }, projectileColor: '#a8c65a', description: 'A precise thrust that applies poison over 3 seconds.' },
  rogue_shadow_lunge: { id: 'rogue_shadow_lunge', name: 'Shadow Lunge', kind: 'MELEE', damage: 22, manaCost: 8, poiseDamage: 22, cooldownSeconds: 5.5, windupSeconds: 0.12, activeSeconds: 0.12, recoverySeconds: 0.24, range: 1.3, arcRadians: 0.62, meleeStyle: 'THRUST', dashDistance: 1.35, staggerSeconds: 0.24, projectileColor: '#a9a5c8', description: 'Lunge a short distance through open space, then strike the target ahead.' },
  rogue_quick_stab: { id: 'rogue_quick_stab', name: 'Kopis Strike', kind: 'MELEE', damage: 16, manaCost: 0, cooldownSeconds: 0.34, windupSeconds: 0.08, activeSeconds: 0.12, recoverySeconds: 0.12, range: 1.75, arcRadians: 0.62, meleeStyle: 'SWEEP', description: 'A fast, close cut with a forward-curving blade.' },
  rogue_shadow_strike: { id: 'rogue_shadow_strike', name: 'Hermes’ Feint', kind: 'MELEE', damage: 29, manaCost: 8, staminaCost: 12, poiseDamage: 24, cooldownSeconds: 4, windupSeconds: 0.18, activeSeconds: 0.12, recoverySeconds: 0.24, range: 2.25, arcRadians: 0.72, meleeStyle: 'THRUST', staggerSeconds: 0.3, description: 'A deceptive lunging strike that briefly staggers its target.' },
  rogue_knife_fan: { id: 'rogue_knife_fan', name: 'Kopis Fan', kind: 'PROJECTILE', damage: 16, manaCost: 10, cooldownSeconds: 4.5, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.3, range: 12, projectileSpeed: 14, projectileColor: '#d2d9e6', description: 'A thrown kopis aimed at the crosshair.' },
  ranger_shortbow: { id: 'ranger_shortbow', name: 'Artemis’ Arrow', kind: 'PROJECTILE', damage: 17, manaCost: 0, cooldownSeconds: 0.48, windupSeconds: 0.16, activeSeconds: 0.08, recoverySeconds: 0.2, range: 20, projectileSpeed: 18, projectileRadius: 0.09, projectileColor: '#d5b77a', description: 'A fast, direct arrow from the Hunter’s bow.' },
  ranger_piercing_arrow: { id: 'ranger_piercing_arrow', name: 'Boar-Spear Arrow', kind: 'PROJECTILE', damage: 31, manaCost: 5, cooldownSeconds: 2, windupSeconds: 0.32, activeSeconds: 0.08, recoverySeconds: 0.32, range: 22, projectileSpeed: 18, projectileColor: '#efd18a', pierceCount: 1, description: 'A heavier arrow with a longer windup that pierces one additional foe.' },
  ranger_volley: { id: 'ranger_volley', name: 'Javelin Volley', kind: 'PROJECTILE', damage: 19, manaCost: 12, cooldownSeconds: 5.5, windupSeconds: 0.38, activeSeconds: 0.08, recoverySeconds: 0.34, range: 16, projectileSpeed: 15, projectileRadius: 0.13, projectileColor: '#d5b77a', projectileCount: 3, projectileSpreadRadians: 0.1, damagePerProjectileMultiplier: 0.62, description: 'Launch three deliberate javelins in a narrow fan; each spear deals 62% damage.' },
  ranger_piercing_hunt: { id: 'ranger_piercing_hunt', name: 'Piercing Hunt', kind: 'PROJECTILE', damage: 30, manaCost: 7, cooldownSeconds: 3.2, windupSeconds: 0.28, activeSeconds: 0.08, recoverySeconds: 0.3, range: 22, projectileSpeed: 21, projectileRadius: 0.11, projectileColor: '#ecd49b', pierceCount: 2, description: 'Loose a precise arrow that can pierce its first target and up to two more foes.' },
  ranger_hunters_snare: { id: 'ranger_hunters_snare', name: 'Hunter’s Snare', kind: 'AOE', damage: 8, manaCost: 10, cooldownSeconds: 6.5, windupSeconds: 0.26, activeSeconds: 0.12, recoverySeconds: 0.28, range: 10, radius: 1.45, projectileColor: '#a5b77d', onHitStatus: { statusId: 'SLOW', durationSeconds: 3, magnitude: 0.28 }, description: 'Set a small trap at the aimed point. It deals light damage and slows caught foes by 28% for 3 seconds.' },
  ranger_moonlit_pursuit: { id: 'ranger_moonlit_pursuit', name: 'Moonlit Pursuit', kind: 'AOE', damage: 0, manaCost: 8, cooldownSeconds: 9, windupSeconds: 0.12, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, dashDistance: 0.8, selfStatuses: [{ statusId: 'HASTE', durationSeconds: 3, magnitude: 0.18 }, { statusId: 'PRECISION', durationSeconds: 4, magnitude: 0.15 }], projectileColor: '#d5b77a', description: 'Step up to 0.8 metres through clear space; gain 18% movement and action speed for 3 seconds and 15% projectile damage for 4 seconds.' },
  cleric_warhammer: { id: 'cleric_warhammer', name: 'Asclepiad Staff Strike', kind: 'MELEE', damage: 19, manaCost: 0, cooldownSeconds: 0.62, windupSeconds: 0.2, activeSeconds: 0.16, recoverySeconds: 0.25, range: 1.95, arcRadians: 0.78, meleeStyle: 'BASH', description: 'A deliberate blow with a bronze-capped ritual staff.' },
  cleric_holy_bolt: { id: 'cleric_holy_bolt', name: 'Temple Light', kind: 'PROJECTILE', damage: 20, manaCost: 4, cooldownSeconds: 1.1, windupSeconds: 0.2, activeSeconds: 0.08, recoverySeconds: 0.2, range: 16, projectileSpeed: 11, projectileColor: '#e9d391', description: 'A compact bolt of sacred light.' },
  cleric_restoration: { id: 'cleric_restoration', name: 'Asclepius’ Grace', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 8, windupSeconds: 0.4, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, projectileColor: '#8dbf8c', selfEffect: { type: 'HEAL', amount: 0.3 }, description: 'A self-directed rite that restores 30% of your maximum health.' },
  cleric_serpents_renewal: { id: 'cleric_serpents_renewal', name: 'Serpent’s Renewal', kind: 'AOE', damage: 0, manaCost: 12, cooldownSeconds: 14, windupSeconds: 0.24, activeSeconds: 0.08, recoverySeconds: 0.2, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfStatuses: [{ statusId: 'REGEN', durationSeconds: 5, magnitude: 5 }], projectileColor: '#8dbf8c', description: 'Restore 5 health once per second for 5 seconds. The effect refreshes and does not stack.' },
  cleric_purifying_rite: { id: 'cleric_purifying_rite', name: 'Purifying Rite', kind: 'AOE', damage: 0, manaCost: 8, cooldownSeconds: 9, windupSeconds: 0.2, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, cleanseStatuses: ['POISON', 'BURN', 'BLEED', 'SLOW', 'WEAKNESS'], projectileColor: '#d9dfb3', description: 'Remove one poison, burn, bleed, slow, or weakness effect. Stagger and enemy curses are not cleansed.' },
  cleric_sacred_aegis: { id: 'cleric_sacred_aegis', name: 'Sacred Aegis', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 11, windupSeconds: 0.18, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfEffect: { type: 'GUARD', durationSeconds: 4, magnitude: 0.35 }, projectileColor: '#e9d391', description: 'Reduce incoming damage by 35% for 4 seconds.' },
  monk_palm_strike: { id: 'monk_palm_strike', name: 'Pankration Strike', kind: 'MELEE', damage: 14, manaCost: 0, cooldownSeconds: 0.28, windupSeconds: 0.06, activeSeconds: 0.1, recoverySeconds: 0.1, range: 1.55, arcRadians: 0.7, meleeStyle: 'UNARMED', description: 'A fast unarmed strike drawn from pankration.' },
  monk_flurry: { id: 'monk_flurry', name: 'Pankration Flurry', kind: 'MELEE', damage: 31, manaCost: 5, staminaCost: 14, poiseDamage: 14, cooldownSeconds: 3.5, windupSeconds: 0.18, activeSeconds: 0.3, recoverySeconds: 0.24, range: 1.7, arcRadians: 0.95, description: 'A rapid sequence of close strikes.' },
  monk_flying_kick: { id: 'monk_flying_kick', name: 'Olympian Kick', kind: 'MELEE', damage: 32, manaCost: 8, poiseDamage: 28, cooldownSeconds: 4.5, windupSeconds: 0.34, activeSeconds: 0.16, recoverySeconds: 0.3, range: 2.4, arcRadians: 0.72, dashDistance: 0.55, knockbackDistance: 0.65, staggerSeconds: 0.3, projectileColor: '#d5a366', description: 'Advance up to 0.55 metres without crossing walls, then kick one foe back up to 0.65 metres.' },
  monk_twin_palm: { id: 'monk_twin_palm', name: 'Twin Palm', kind: 'MELEE', damage: 24, manaCost: 6, cooldownSeconds: 3.6, windupSeconds: 0.12, activeSeconds: 0.28, recoverySeconds: 0.24, range: 1.7, arcRadians: 0.78, meleeStyle: 'UNARMED', activeHitCount: 2, damagePerHitMultiplier: 0.56, projectileColor: '#e2b87d', description: 'Two measured palm strikes resolve in separate active windows, each dealing 56% damage.' },
  monk_grapplers_counter: { id: 'monk_grapplers_counter', name: 'Grappler’s Counter', kind: 'AOE', damage: 0, manaCost: 6, cooldownSeconds: 7, windupSeconds: 0.08, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, requiresCounterWindow: true, selfStatuses: [{ statusId: 'GUARD', durationSeconds: 2, magnitude: 0.3 }, { statusId: 'COUNTER', durationSeconds: 3, magnitude: 0.28 }], projectileColor: '#ddb779', description: 'Time this during a dodge window or an enemy windup within 3 metres. Gain 30% guard for 2 seconds and empower one melee counter by 28% for 3 seconds.' },
  monk_champions_rush: { id: 'monk_champions_rush', name: 'Champion’s Rush', kind: 'AOE', damage: 0, manaCost: 8, cooldownSeconds: 10, windupSeconds: 0.12, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfStatuses: [{ statusId: 'HASTE', durationSeconds: 4, magnitude: 0.2 }], projectileColor: '#d6a96e', description: 'Gain 20% movement and action speed for 4 seconds.' },
  necromancer_bone_shard: { id: 'necromancer_bone_shard', name: 'Styx Shard', kind: 'PROJECTILE', damage: 15, manaCost: 0, cooldownSeconds: 0.36, windupSeconds: 0.1, activeSeconds: 0.08, recoverySeconds: 0.16, range: 18, projectileSpeed: 10, projectileColor: '#b9b5a1', description: 'A pale shard pulled from the river’s dark bank.' },
  necromancer_soul_drain: { id: 'necromancer_soul_drain', name: 'Hades’ Grasp', kind: 'PROJECTILE', damage: 25, manaCost: 8, cooldownSeconds: 3.2, windupSeconds: 0.26, activeSeconds: 0.08, recoverySeconds: 0.25, range: 14, projectileSpeed: 8, projectileRadius: 0.16, projectileColor: '#8c607d', healOnHit: 5, description: 'A slow chthonic bolt that restores 5 health when it strikes.' },
  necromancer_corpse_burst: { id: 'necromancer_corpse_burst', name: 'Underworld Eruption', kind: 'AOE', damage: 28, manaCost: 14, cooldownSeconds: 5.5, windupSeconds: 0.42, activeSeconds: 0.18, recoverySeconds: 0.35, range: 8, radius: 2, projectileColor: '#8c5369', description: 'Black-red force erupts at a point before the hero.' },
  necromancer_shade_mark: { id: 'necromancer_shade_mark', name: 'Shade Mark', kind: 'PROJECTILE', damage: 11, manaCost: 8, cooldownSeconds: 4.5, windupSeconds: 0.2, activeSeconds: 0.08, recoverySeconds: 0.22, range: 18, projectileSpeed: 11, projectileRadius: 0.14, projectileColor: '#72506f', onHitStatus: { statusId: 'CURSE', durationSeconds: 5, magnitude: 0.2 }, description: 'Curse one foe, causing it to take 20% more damage for 5 seconds. Bosses resist half the effect.' },
  necromancer_death_burst: { id: 'necromancer_death_burst', name: 'Death Burst', kind: 'AOE', damage: 25, manaCost: 13, cooldownSeconds: 6.5, windupSeconds: 0.38, activeSeconds: 0.16, recoverySeconds: 0.3, range: 8, radius: 2.1, projectileColor: '#8c5369', statusDamageBonus: { statusId: 'CURSE', multiplier: 1.35 }, description: 'Detonate a chthonic blast at the aimed point. Cursed foes take 35% additional damage from this blast.' },
  necromancer_soul_ward: { id: 'necromancer_soul_ward', name: 'Soul Ward', kind: 'AOE', damage: 0, manaCost: 10, cooldownSeconds: 10, windupSeconds: 0.14, activeSeconds: 0.08, recoverySeconds: 0.18, range: 0, radius: 0, targeting: 'SELF', utilityOnly: true, selfEffect: { type: 'GUARD', durationSeconds: 3, magnitude: 0.28 }, projectileColor: '#8c607d', description: 'Reduce incoming damage by 28% for 3 seconds.' },
};

export interface ClassAbilityLoadout {
  primary: string;
  secondary: string;
  skill: string;
  skillSlots: [string | null, string | null, string | null, string | null];
}

export const CLASS_ABILITY_LOADOUT: Record<ClassType, ClassAbilityLoadout> = {
  BARBARIAN: { primary: 'barbarian_cleave', secondary: 'barbarian_heavy_strike', skill: 'barbarian_ground_slam', skillSlots: ['barbarian_ground_slam', 'barbarian_bronze_cyclone', 'barbarian_blood_oath', 'barbarian_heroic_execution'] },
  PALADIN: { primary: 'paladin_arming_sword', secondary: 'paladin_smite', skill: 'paladin_consecration', skillSlots: ['paladin_consecration', 'paladin_dory_impale', 'paladin_bronze_reprisal', 'paladin_aspis_charge'] },
  SORCERER: { primary: 'sorcerer_arcane_bolt', secondary: 'sorcerer_charged_bolt', skill: 'sorcerer_fireburst', skillSlots: ['sorcerer_fireburst', 'sorcerer_storm_invocation', 'sorcerer_prophetic_veil', 'sorcerer_omenfall'] },
  ROGUE: { primary: 'rogue_quick_stab', secondary: 'rogue_shadow_strike', skill: 'rogue_knife_fan', skillSlots: ['rogue_knife_fan', 'rogue_kopis_flurry', 'rogue_venomous_cut', 'rogue_shadow_lunge'] },
  RANGER: { primary: 'ranger_shortbow', secondary: 'ranger_piercing_arrow', skill: 'ranger_volley', skillSlots: ['ranger_volley', 'ranger_piercing_hunt', 'ranger_hunters_snare', 'ranger_moonlit_pursuit'] },
  CLERIC: { primary: 'cleric_warhammer', secondary: 'cleric_holy_bolt', skill: 'cleric_restoration', skillSlots: ['cleric_restoration', 'cleric_serpents_renewal', 'cleric_purifying_rite', 'cleric_sacred_aegis'] },
  MONK: { primary: 'monk_palm_strike', secondary: 'monk_flurry', skill: 'monk_flying_kick', skillSlots: ['monk_flying_kick', 'monk_twin_palm', 'monk_grapplers_counter', 'monk_champions_rush'] },
  NECROMANCER: { primary: 'necromancer_bone_shard', secondary: 'necromancer_soul_drain', skill: 'necromancer_corpse_burst', skillSlots: ['necromancer_corpse_burst', 'necromancer_shade_mark', 'necromancer_death_burst', 'necromancer_soul_ward'] },
};

export const getAbility = (id: string): AbilityDefinition | undefined => ABILITY_REGISTRY[id];

export function getSkillAbilityId(classId: ClassType, slot: number): string | null {
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) return null;
  return CLASS_ABILITY_LOADOUT[classId].skillSlots[slot - 1];
}

export function abilityTooltip(ability: AbilityDefinition, overrides?: { manaCost?: number; cooldownSeconds?: number; staminaCost?: number | string }): string {
  const perHit = ability.activeHitCount && ability.activeHitCount > 1
    ? `${ability.damage} × ${Math.round((ability.damagePerHitMultiplier ?? 1 / ability.activeHitCount) * 100)}% · ${ability.activeHitCount} hits`
    : `${ability.damage} damage`;
  const effect = ability.utilityOnly ? ability.dashDistance ? `Move up to ${ability.dashDistance.toFixed(1)}m` : ability.cleanseStatuses?.length ? 'Cleanse one listed effect' : 'Self effect'
    : ability.selfEffect?.type === 'HEAL' ? `Heal ${Math.round((ability.selfEffect.amount ?? 0) * 100)}% of max health`
    : ability.selfEffect?.type === 'GUARD' ? `Guard for ${(ability.selfEffect.durationSeconds ?? 0).toFixed(1)}s`
    : ability.kind === 'MELEE' ? `${perHit} · ${ability.range.toFixed(1)}m range`
    : ability.kind === 'PROJECTILE' ? `${perHit} · ${ability.range}m range`
    : `${perHit} · ${ability.radius ?? 0}m radius`;
  const status = ability.onHitStatus ? ` · ${formatTooltipStatus(ability.onHitStatus)}` : '';
  const charge = ability.chargeMinSeconds ? ` · charge ${(ability.chargeMinSeconds * 1000).toFixed(0)}ms+` : '';
  const hits = ability.activeHitCount && ability.activeHitCount > 1 ? ` · timed hit windows` : '';
  const projectile = ability.kind === 'PROJECTILE' && (ability.projectileCount ?? 1) > 1
    ? ` · ${Math.min(7, Math.floor(ability.projectileCount!))} projectiles${ability.projectileSpreadRadians ? ` · ${(ability.projectileSpreadRadians * 2 * 180 / Math.PI).toFixed(0)}° total fan` : ''}${ability.damagePerProjectileMultiplier ? ` · ${Math.round(ability.damagePerProjectileMultiplier * 100)}% each` : ''}` : '';
  const pierce = ability.pierceCount ? ` · pierces up to ${Math.min(3, Math.floor(ability.pierceCount))} additional target${ability.pierceCount === 1 ? '' : 's'}` : '';
  const selfStatuses = ability.selfStatuses?.length ? ` · self: ${ability.selfStatuses.map(formatTooltipStatus).join(', ')}` : '';
  const cleanse = ability.cleanseStatuses?.length ? ` · may cleanse: ${ability.cleanseStatuses.map(statusId => statusId.toLowerCase()).join(', ')}` : '';
  const synergy = ability.statusDamageBonus ? ` · +${Math.round((ability.statusDamageBonus.multiplier - 1) * 100)}% vs ${ability.statusDamageBonus.statusId.toLowerCase()}` : '';
  const manaCost = overrides?.manaCost ?? ability.manaCost;
  const cooldownSeconds = overrides?.cooldownSeconds ?? ability.cooldownSeconds;
  const staminaValue = overrides?.staminaCost !== undefined ? overrides.staminaCost : ability.staminaCost;
  const staminaCost = staminaValue ? ` · ${typeof staminaValue === 'number' ? staminaValue.toFixed(staminaValue % 1 ? 1 : 0) : staminaValue} stamina` : '';
  return `${ability.name} — ${effect}${projectile}${pierce}${synergy}${status}${selfStatuses}${cleanse}${hits}${staminaCost} · ${manaCost.toFixed(manaCost % 1 ? 1 : 0)} MP · ${cooldownSeconds.toFixed(1)}s cooldown${charge}. ${ability.description}`;
}

function formatTooltipStatus(status: StatusApplication): string {
  const amount = PERCENT_TOOLTIP_STATUS_IDS.has(status.statusId) ? ` ${Math.round(status.magnitude * 100)}%`
    : isPeriodicRealtimeStatus(status.statusId) ? ` ${Math.round(status.magnitude)} per tick` : '';
  return `${status.statusId.toLowerCase()}${amount} · ${status.durationSeconds.toFixed(1)}s`;
}
