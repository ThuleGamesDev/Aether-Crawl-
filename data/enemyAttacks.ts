import type { StatusApplication } from '../types';

export type EnemyAttackShape = 'MELEE' | 'CONE' | 'SLAM' | 'PROJECTILE' | 'DRAIN' | 'RITUAL' | 'CHARGE' | 'SIGIL' | 'BUFF' | 'CURSE';
export type EnemyAttackMotion = 'NONE' | 'LEAP' | 'CHARGE' | 'RETREAT' | 'REPOSITION';

export interface EnemyAttackDefinition {
  id: string;
  name: string;
  shape: EnemyAttackShape;
  range: number;
  minRange?: number;
  windupSeconds: number;
  activeSeconds: number;
  recoverySeconds: number;
  cooldownSeconds: number;
  damageMultiplier: number;
  radius?: number;
  arcRadians?: number;
  projectileSpeed?: number;
  projectileColor?: string;
  telegraphColor: string;
  statusEffect?: StatusApplication;
  motion?: EnemyAttackMotion;
  motionSpeed?: number;
  guardSeconds?: number;
  healOwnerRatio?: number;
  phase?: number;
  interruptible?: boolean;
  /** Only attacks explicitly marked here can be stopped by a timed shield parry. */
  parryable?: boolean;
}

const melee = (id: string, name: string, range = 1.35, damageMultiplier = 1, windupSeconds = 0.58): EnemyAttackDefinition => ({
  id, name, shape: 'MELEE', range, windupSeconds, activeSeconds: 0.12, recoverySeconds: 0.56, cooldownSeconds: 1.3, damageMultiplier, telegraphColor: '#e65b42', interruptible: true,
});

const projectile = (id: string, name: string, range: number, color: string, statusEffect?: StatusApplication): EnemyAttackDefinition => ({
  id, name, shape: 'PROJECTILE', range, minRange: 2.2, windupSeconds: 0.78, activeSeconds: 0.12, recoverySeconds: 0.62, cooldownSeconds: 1.7,
  damageMultiplier: 0.82, projectileSpeed: 6, projectileColor: color, telegraphColor: color, statusEffect, interruptible: true,
});

export const ENEMY_ATTACK_SETS: Record<string, readonly EnemyAttackDefinition[]> = {
  // The six early-floor families teach spacing, defense, and attack timing before damage scales up.
  rat: [
    { ...melee('rat_bite', 'Bite', 1.2, 0.72, 0.42), parryable: true, telegraphColor: '#57b9a9' },
    { ...melee('rat_leap', 'Coiled Leap', 2.6, 0.95, 0.72), shape: 'CHARGE', motion: 'LEAP', motionSpeed: 5.2, recoverySeconds: 0.65, cooldownSeconds: 2.0, telegraphColor: '#e6a452' },
  ],
  revenant: [
    { ...melee('revenant_xiphos', 'Xiphos Slash', 1.65, 1.0, 0.62), shape: 'CONE', arcRadians: 1.22, parryable: true, telegraphColor: '#57b9a9' },
    { id: 'revenant_shield_guard', name: 'Shield Guard', shape: 'BUFF', range: 1.85, windupSeconds: 0.48, activeSeconds: 0.1, recoverySeconds: 0.3, cooldownSeconds: 3.2, damageMultiplier: 0, guardSeconds: 0.9, statusEffect: { statusId: 'GUARD', durationSeconds: 0.9, magnitude: 0.65 }, telegraphColor: '#d7a853' },
    { ...melee('revenant_shield_bash', 'Prepared Shield Bash', 1.45, 0.82, 0.86), parryable: true, statusEffect: { statusId: 'STAGGER', durationSeconds: 0.38, magnitude: 0.38 }, telegraphColor: '#57b9a9' },
  ],
  spider: [
    { ...melee('spider_venom_fang', 'Venom Fang', 1.5, 0.82, 0.58), statusEffect: { statusId: 'POISON', durationSeconds: 4, magnitude: 2 }, telegraphColor: '#a4bd48' },
    projectile('spider_web_projectile', 'Web Spit', 7, '#b8c96d', { statusId: 'SLOW', durationSeconds: 2.4, magnitude: 0.42 }),
    { ...melee('spider_side_lunge', 'Side Lunge', 2.1, 0.72, 0.52), shape: 'CHARGE', motion: 'REPOSITION', motionSpeed: 3.2, telegraphColor: '#91a94a' },
  ],
  plunderer: [
    melee('plunderer_kopis', 'Kopis Cut', 1.4, 0.78, 0.42),
    projectile('plunderer_javelin', 'Javelin Throw', 8, '#c9a468'),
  ],
  raider: [
    melee('raider_spear', 'Spear Thrust', 2.25, 1.0, 0.62),
    projectile('raider_javelin', 'Javelin Throw', 7, '#d2aa70'),
  ],
  bull_enforcer: [
    { ...melee('enforcer_heavy_cleave', 'Heavy Cleave', 2.1, 1.05, 0.8), shape: 'CONE', arcRadians: 1.45, recoverySeconds: 0.72, cooldownSeconds: 1.8, telegraphColor: '#e0a04b' },
    { ...melee('enforcer_charge', 'Bull Charge', 5.3, 1.32, 0.94), shape: 'CHARGE', motion: 'CHARGE', motionSpeed: 5.4, recoverySeconds: 0.88, cooldownSeconds: 2.8, telegraphColor: '#e76b43' },
    { id: 'enforcer_roar', name: 'Oath-Roar', shape: 'CURSE', range: 4.8, radius: 4.8, windupSeconds: 0.7, activeSeconds: 0.1, recoverySeconds: 0.8, cooldownSeconds: 4.5, damageMultiplier: 0, statusEffect: { statusId: 'WEAKNESS', durationSeconds: 2.2, magnitude: 0.18 }, telegraphColor: '#bb6845' },
  ],
  acolyte: [
    projectile('acolyte_underworld_bolt', 'Underworld Bolt', 9, '#9a70b7'),
    { id: 'acolyte_curse', name: 'Ashen Curse', shape: 'CURSE', range: 7.2, minRange: 2.8, windupSeconds: 0.98, activeSeconds: 0.1, recoverySeconds: 0.75, cooldownSeconds: 3.6, damageMultiplier: 0.3, statusEffect: { statusId: 'WEAKNESS', durationSeconds: 3, magnitude: 0.22 }, telegraphColor: '#b25c79' },
    { id: 'acolyte_votive_ward', name: 'Votive Ward', shape: 'BUFF', range: 7.5, windupSeconds: 0.72, activeSeconds: 0.1, recoverySeconds: 0.55, cooldownSeconds: 5.2, damageMultiplier: 0, statusEffect: { statusId: 'GUARD', durationSeconds: 2.8, magnitude: 0.3 }, telegraphColor: '#c3a85b' },
  ],
  ooze: [melee('ooze_surge', 'Stygian Surge', 1.3, 0.8, 0.74)],
  brute: [
    { id: 'brute_fist', name: 'Stone Fist', shape: 'SLAM', range: 2.3, radius: 1.45, windupSeconds: 0.88, activeSeconds: 0.12, recoverySeconds: 0.75, cooldownSeconds: 1.7, damageMultiplier: 1.05, telegraphColor: '#e3a54f' },
  ],
  forge_wraith: [projectile('forge_spark', 'Forge Spark', 8, '#ff8b45', { statusId: 'BURN', durationSeconds: 3, magnitude: 2 })],
  shade: [projectile('shade_cold_touch', 'Cold Touch', 7, '#8b6cba', { statusId: 'SLOW', durationSeconds: 1.8, magnitude: 0.3 })],
  automaton: [melee('automaton_bronze_fist', 'Bronze Fist', 1.75, 1.1, 0.72)],
  empusa: [melee('empusa_claw', 'Empusa Claw', 1.5, 1, 0.52)],
  gorgon: [projectile('gorgon_glint', 'Petrifying Glint', 9, '#a8b56a', { statusId: 'SLOW', durationSeconds: 1.7, magnitude: 0.28 })],
  drake: [{ id: 'drake_cinder', name: 'Cinder Breath', shape: 'CONE', range: 4.2, radius: 4.2, arcRadians: 0.8, windupSeconds: 1.05, activeSeconds: 0.12, recoverySeconds: 0.88, cooldownSeconds: 2, damageMultiplier: 1.1, statusEffect: { statusId: 'BURN', durationSeconds: 3, magnitude: 3 }, telegraphColor: '#ed6447' }],
  champion: [{ id: 'champion_cleave', name: 'Oath-Breaker Cleave', shape: 'CONE', range: 2.8, radius: 2.8, arcRadians: 1.35, windupSeconds: 0.92, activeSeconds: 0.12, recoverySeconds: 0.78, cooldownSeconds: 1.9, damageMultiplier: 1.1, telegraphColor: '#b94e54' }],
  gatekeeper: [
    { ...melee('gatekeeper_shield_bash', 'Shield Bash', 1.8, 0.95, 0.72), parryable: true, statusEffect: { statusId: 'STAGGER', durationSeconds: 0.38, magnitude: 0.38 }, telegraphColor: '#57b9a9' },
    { ...melee('gatekeeper_sweep', 'Broad Sword Sweep', 2.75, 1.1, 1.0), shape: 'CONE', arcRadians: 1.65, parryable: true, recoverySeconds: 0.78, cooldownSeconds: 1.9, telegraphColor: '#57b9a9' },
    { id: 'gatekeeper_guard', name: 'Short Guard', shape: 'BUFF', range: 2.8, windupSeconds: 0.58, activeSeconds: 0.1, recoverySeconds: 0.32, cooldownSeconds: 3.4, damageMultiplier: 0, statusEffect: { statusId: 'GUARD', durationSeconds: 0.85, magnitude: 0.62 }, telegraphColor: '#d7a853' },
  ],
  serpent_priestess: [
    { ...projectile('priestess_venom_orb', 'Venom Orb', 9, '#9bb34b', { statusId: 'POISON', durationSeconds: 4.2, magnitude: 2 }), projectileSpeed: 6.2, windupSeconds: 0.88 },
    { id: 'priestess_fang_cone', name: 'Poison Fan', shape: 'CONE', range: 4.2, radius: 4.2, arcRadians: 0.95, windupSeconds: 1.02, activeSeconds: 0.12, recoverySeconds: 0.76, cooldownSeconds: 1.9, damageMultiplier: 1, statusEffect: { statusId: 'POISON', durationSeconds: 3, magnitude: 1 }, telegraphColor: '#b1c452' },
    { id: 'priestess_coil_ritual', name: 'Serpent Coil', shape: 'RITUAL', range: 3.4, radius: 2.3, windupSeconds: 0.68, activeSeconds: 0.1, recoverySeconds: 0.72, cooldownSeconds: 3.8, damageMultiplier: 0.45, motion: 'REPOSITION', motionSpeed: 2.7, telegraphColor: '#86a545' },
  ],
  cyclopean_mason: [
    { id: 'mason_block_slam', name: 'Heavy Slam', shape: 'SLAM', range: 2.4, radius: 1.8, windupSeconds: 0.98, activeSeconds: 0.12, recoverySeconds: 0.82, cooldownSeconds: 1.85, damageMultiplier: 1.2, statusEffect: { statusId: 'STAGGER', durationSeconds: 0.35, magnitude: 0.35 }, telegraphColor: '#e3a54f' },
    { ...projectile('mason_boulder_throw', 'Boulder Throw', 8, '#b68d68'), projectileSpeed: 4.6, windupSeconds: 1.12, recoverySeconds: 0.78 },
    { id: 'mason_shockwave', name: 'Ground Shockwave', shape: 'SLAM', range: 3.7, radius: 3.2, windupSeconds: 1.28, activeSeconds: 0.12, recoverySeconds: 0.92, cooldownSeconds: 2.25, damageMultiplier: 0.92, telegraphColor: '#f06444' },
  ],
  lamia: [
    { ...melee('lamia_lunge', 'Fast Lunge', 2.9, 0.94, 0.54), shape: 'CHARGE', motion: 'LEAP', motionSpeed: 4.6, recoverySeconds: 0.55, cooldownSeconds: 1.25, telegraphColor: '#bc615f' },
    { ...projectile('lamia_drain', 'Life Drain', 8, '#8b5a70'), shape: 'DRAIN', damageMultiplier: 0.68, projectileSpeed: 5.3, healOwnerRatio: 0.28, telegraphColor: '#c17488' },
    { id: 'lamia_retreat', name: 'Cistern Slip', shape: 'BUFF', range: 2.6, windupSeconds: 0.42, activeSeconds: 0.1, recoverySeconds: 0.46, cooldownSeconds: 3.8, damageMultiplier: 0, motion: 'RETREAT', motionSpeed: 3.1, telegraphColor: '#987079' },
  ],
  threadbound_warden: [
    { ...projectile('warden_thread_bolt', 'Curse Bolt', 9, '#d34e4e', { statusId: 'WEAKNESS', durationSeconds: 2.6, magnitude: 0.2 }), projectileSpeed: 6.1, windupSeconds: 0.75, recoverySeconds: 0.58 },
    { id: 'warden_ritual_shield', name: 'Ritual Shield', shape: 'BUFF', range: 8, windupSeconds: 0.72, activeSeconds: 0.1, recoverySeconds: 0.5, cooldownSeconds: 4.8, damageMultiplier: 0, statusEffect: { statusId: 'GUARD', durationSeconds: 2.2, magnitude: 0.42 }, telegraphColor: '#bd3d4b', phase: 1 },
    { id: 'warden_thread_sigil', name: 'Delayed Sigil', shape: 'SIGIL', range: 8, radius: 1.65, windupSeconds: 1.42, activeSeconds: 0.12, recoverySeconds: 0.78, cooldownSeconds: 2.35, damageMultiplier: 1.12, telegraphColor: '#e35d5d', phase: 2 },
    { id: 'warden_phase_two_curse', name: 'Red Thread Curse', shape: 'CURSE', range: 7.5, radius: 7.5, windupSeconds: 0.88, activeSeconds: 0.1, recoverySeconds: 0.62, cooldownSeconds: 2.9, damageMultiplier: 0.44, statusEffect: { statusId: 'WEAKNESS', durationSeconds: 3.2, magnitude: 0.2 }, telegraphColor: '#bd3d4b', phase: 2 },
  ],
};

export const DEFAULT_ENEMY_ATTACKS = ENEMY_ATTACK_SETS.revenant;

/** Stable translations for attack IDs saved by the R2A combat snapshot. */
export const LEGACY_ENEMY_ATTACK_ALIASES: Readonly<Record<string, string>> = {
  rat_pounce: 'rat_bite',
  spider_lunge: 'spider_venom_fang',
  spider_web: 'spider_web_projectile',
  bull_horn_charge: 'enforcer_charge',
  acolyte_ember: 'acolyte_underworld_bolt',
  shade_touch: 'shade_cold_touch',
  gorgon_gaze: 'gorgon_glint',
  warden_ritual_curse: 'warden_ritual_shield',
};

export function getEnemyAttackSet(id?: string, phase = 1): readonly EnemyAttackDefinition[] {
  const all = id ? ENEMY_ATTACK_SETS[id] ?? DEFAULT_ENEMY_ATTACKS : DEFAULT_ENEMY_ATTACKS;
  const available = all.filter(attack => (attack.phase ?? 1) <= phase);
  return available.length ? available : all;
}

export function getEnemyAttackDefinition(attackSetId: string | undefined, attackId?: string, phase = 1): EnemyAttackDefinition | undefined {
  const attacks = getEnemyAttackSet(attackSetId, phase);
  const canonicalId = attackId ? LEGACY_ENEMY_ATTACK_ALIASES[attackId] ?? attackId : undefined;
  return attacks.find(attack => attack.id === canonicalId) ?? attacks[0];
}

export function isEnemyAttackParryable(attackSetId: string | undefined, attackId: string | undefined, phase = 1): boolean {
  if (!attackId) return false;
  const canonicalId = LEGACY_ENEMY_ATTACK_ALIASES[attackId] ?? attackId;
  return getEnemyAttackSet(attackSetId, phase).some(attack => attack.id === canonicalId && attack.parryable === true);
}
