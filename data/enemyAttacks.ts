export type EnemyAttackShape = 'MELEE' | 'CONE' | 'SLAM' | 'PROJECTILE' | 'DRAIN' | 'RITUAL';

export interface EnemyAttackDefinition {
  id: string;
  name: string;
  shape: EnemyAttackShape;
  range: number;
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
}

const melee = (id: string, name: string, range = 1.35, damageMultiplier = 1, windupSeconds = 0.58): EnemyAttackDefinition => ({
  id, name, shape: 'MELEE', range, windupSeconds, activeSeconds: 0.12, recoverySeconds: 0.56, cooldownSeconds: 1.3, damageMultiplier, telegraphColor: '#e65b42',
});

export const ENEMY_ATTACK_SETS: Record<string, readonly EnemyAttackDefinition[]> = {
  rat: [melee('rat_pounce', 'Pounce', 1.3, 0.85, 0.46)],
  revenant: [melee('revenant_xiphos', 'Xiphos Sweep', 1.55, 1, 0.65)],
  spider: [{ id: 'spider_lunge', name: 'Venomous Lunge', shape: 'MELEE', range: 1.65, windupSeconds: 0.72, activeSeconds: 0.12, recoverySeconds: 0.68, cooldownSeconds: 1.45, damageMultiplier: 0.9, telegraphColor: '#a4bd48' }],
  plunderer: [melee('plunderer_kopis', 'Kopis Cut')],
  raider: [melee('raider_spear', 'Spear Thrust', 1.8, 1.05, 0.7)],
  bull_enforcer: [melee('bull_horn_charge', 'Horn Rush', 2.2, 1.2, 0.9)],
  acolyte: [{ id: 'acolyte_ember', name: 'Offering Flame', shape: 'PROJECTILE', range: 8, windupSeconds: 0.9, activeSeconds: 0.12, recoverySeconds: 0.66, cooldownSeconds: 1.7, damageMultiplier: 0.8, projectileSpeed: 5.8, projectileColor: '#e8724c', telegraphColor: '#dc7651' }],
  ooze: [melee('ooze_surge', 'Stygian Surge', 1.2, 0.8, 0.82)],
  brute: [
    { id: 'brute_fist', name: 'Stone Fist', shape: 'SLAM', range: 1.9, radius: 1.4, windupSeconds: 0.88, activeSeconds: 0.12, recoverySeconds: 0.75, cooldownSeconds: 1.7, damageMultiplier: 1.05, telegraphColor: '#e3a54f' },
  ],
  forge_wraith: [{ id: 'forge_spark', name: 'Forge Spark', shape: 'PROJECTILE', range: 8, windupSeconds: 0.8, activeSeconds: 0.12, recoverySeconds: 0.6, cooldownSeconds: 1.5, damageMultiplier: 0.85, projectileSpeed: 6.4, projectileColor: '#ff8b45', telegraphColor: '#ef7048' }],
  shade: [{ id: 'shade_touch', name: 'Cold Touch', shape: 'DRAIN', range: 7, windupSeconds: 1.05, activeSeconds: 0.12, recoverySeconds: 0.7, cooldownSeconds: 2.1, damageMultiplier: 0.8, projectileSpeed: 5, projectileColor: '#8b6cba', telegraphColor: '#a379c7' }],
  automaton: [melee('automaton_bronze_fist', 'Bronze Fist', 1.6, 1.1, 0.76)],
  empusa: [melee('empusa_claw', 'Empusa Claw', 1.5, 1, 0.52)],
  gorgon: [{ id: 'gorgon_gaze', name: 'Petrifying Glint', shape: 'PROJECTILE', range: 9, windupSeconds: 1.0, activeSeconds: 0.12, recoverySeconds: 0.72, cooldownSeconds: 1.8, damageMultiplier: 0.9, projectileSpeed: 5.4, projectileColor: '#a8b56a', telegraphColor: '#c8b867' }],
  drake: [{ id: 'drake_cinder', name: 'Cinder Breath', shape: 'CONE', range: 4.2, radius: 4.2, arcRadians: 0.8, windupSeconds: 1.05, activeSeconds: 0.12, recoverySeconds: 0.88, cooldownSeconds: 2.0, damageMultiplier: 1.1, telegraphColor: '#ed6447' }],
  champion: [
    { id: 'champion_cleave', name: 'Cursed Cleave', shape: 'CONE', range: 2.8, radius: 2.8, arcRadians: 1.35, windupSeconds: 0.92, activeSeconds: 0.12, recoverySeconds: 0.78, cooldownSeconds: 1.9, damageMultiplier: 1.1, telegraphColor: '#b94e54' },
  ],
  gatekeeper: [
    { id: 'gatekeeper_shield_bash', name: 'Shield Bash', shape: 'MELEE', range: 1.65, windupSeconds: 0.74, activeSeconds: 0.12, recoverySeconds: 0.72, cooldownSeconds: 1.5, damageMultiplier: 1.05, telegraphColor: '#e9b955' },
    { id: 'gatekeeper_sweep', name: 'Slow Sweeping Strike', shape: 'CONE', range: 2.7, radius: 2.7, arcRadians: 1.55, windupSeconds: 1.08, activeSeconds: 0.12, recoverySeconds: 0.84, cooldownSeconds: 1.9, damageMultiplier: 1.2, telegraphColor: '#f06444' },
  ],
  serpent_priestess: [
    { id: 'priestess_venom_orb', name: 'Venom Orb', shape: 'PROJECTILE', range: 9, windupSeconds: 0.92, activeSeconds: 0.12, recoverySeconds: 0.7, cooldownSeconds: 1.65, damageMultiplier: 0.85, projectileSpeed: 6.2, projectileColor: '#9bb34b', telegraphColor: '#b1c452' },
    { id: 'priestess_fang_cone', name: 'Fang Fan', shape: 'CONE', range: 4.2, radius: 4.2, arcRadians: 0.95, windupSeconds: 1.12, activeSeconds: 0.12, recoverySeconds: 0.78, cooldownSeconds: 1.9, damageMultiplier: 1.05, telegraphColor: '#b1c452' },
  ],
  cyclopean_mason: [
    { id: 'mason_block_slam', name: 'Block Slam', shape: 'SLAM', range: 2.3, radius: 1.7, windupSeconds: 1.04, activeSeconds: 0.12, recoverySeconds: 0.88, cooldownSeconds: 1.85, damageMultiplier: 1.2, telegraphColor: '#e3a54f' },
    { id: 'mason_shockwave', name: 'Ground Shockwave', shape: 'SLAM', range: 3.4, radius: 3.1, windupSeconds: 1.32, activeSeconds: 0.12, recoverySeconds: 0.96, cooldownSeconds: 2.2, damageMultiplier: 0.9, telegraphColor: '#f06444' },
  ],
  lamia: [
    { id: 'lamia_lunge', name: 'Cistern Lunge', shape: 'MELEE', range: 2.9, windupSeconds: 0.58, activeSeconds: 0.12, recoverySeconds: 0.55, cooldownSeconds: 1.25, damageMultiplier: 1.0, telegraphColor: '#bc615f' },
    { id: 'lamia_drain', name: 'Life-Drain Bolt', shape: 'DRAIN', range: 8, windupSeconds: 1.0, activeSeconds: 0.12, recoverySeconds: 0.7, cooldownSeconds: 1.8, damageMultiplier: 0.68, projectileSpeed: 5.3, projectileColor: '#8b5a70', telegraphColor: '#c17488' },
  ],
  threadbound_warden: [
    { id: 'warden_thread_bolt', name: 'Thread Bolt', shape: 'PROJECTILE', range: 9, windupSeconds: 0.82, activeSeconds: 0.12, recoverySeconds: 0.64, cooldownSeconds: 1.6, damageMultiplier: 0.85, projectileSpeed: 6.0, projectileColor: '#d34e4e', telegraphColor: '#e35d5d' },
    { id: 'warden_ritual_curse', name: 'Red Thread Ritual', shape: 'RITUAL', range: 3.6, radius: 3.3, windupSeconds: 1.45, activeSeconds: 0.12, recoverySeconds: 1.0, cooldownSeconds: 2.3, damageMultiplier: 1.05, telegraphColor: '#bd3d4b' },
  ],
};

export const DEFAULT_ENEMY_ATTACKS = ENEMY_ATTACK_SETS.revenant;

export function getEnemyAttackSet(id?: string): readonly EnemyAttackDefinition[] {
  return id ? ENEMY_ATTACK_SETS[id] ?? DEFAULT_ENEMY_ATTACKS : DEFAULT_ENEMY_ATTACKS;
}

export function getEnemyAttackDefinition(attackSetId: string | undefined, attackId?: string): EnemyAttackDefinition | undefined {
  const attacks = getEnemyAttackSet(attackSetId);
  return attacks.find(attack => attack.id === attackId) ?? attacks[0];
}
