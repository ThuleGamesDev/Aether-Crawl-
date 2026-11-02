import type { EnemyAttackDefinition } from './enemyAttacks';
import type { PixelEffectId } from '../presentation/vfxDefinitions';

export interface EnemyAttackTelegraphDescriptor {
  center: 'enemy' | 'target';
  radius: number;
  arcRadians: number;
  kind: 'circle' | 'arc' | 'line';
  groundProjection: true;
}

/** Keeps warning geometry on the exact extent used by FPSGameRuntime's hit tests. */
export function getEnemyAttackTelegraphDescriptor(attack: EnemyAttackDefinition): EnemyAttackTelegraphDescriptor {
  if (attack.shape === 'SIGIL') {
    return { center: 'target', radius: attack.radius ?? 1.6, arcRadians: Math.PI * 2, kind: 'circle', groundProjection: true };
  }
  if (attack.shape === 'CONE' || attack.shape === 'CHARGE') {
    return { center: 'enemy', radius: attack.range + 0.28, arcRadians: attack.arcRadians ?? 1.35, kind: 'arc', groundProjection: true };
  }
  if (attack.shape === 'PROJECTILE' || attack.shape === 'DRAIN') {
    return { center: 'enemy', radius: attack.range, arcRadians: 0.11, kind: 'line', groundProjection: true };
  }
  if (attack.shape === 'SLAM' || attack.shape === 'RITUAL') {
    return { center: 'enemy', radius: attack.radius ?? attack.range, arcRadians: Math.PI * 2, kind: 'circle', groundProjection: true };
  }
  if (attack.shape === 'CURSE') {
    return { center: 'enemy', radius: attack.radius ?? attack.range, arcRadians: Math.PI * 2, kind: 'circle', groundProjection: true };
  }
  if (attack.shape === 'BUFF') {
    return { center: 'enemy', radius: Math.min(1.4, Math.max(0.8, attack.range * 0.16)), arcRadians: Math.PI * 2, kind: 'circle', groundProjection: true };
  }
  return { center: 'enemy', radius: attack.range + 0.28, arcRadians: Math.PI * 2, kind: 'circle', groundProjection: true };
}

/** Selects the authored Guardian tell that complements the exact persistent warning geometry. */
export function getGuardianTelegraphEffect(attackSetId: string | undefined, attack: EnemyAttackDefinition): PixelEffectId {
  if (attackSetId === 'serpent_priestess' && attack.id === 'priestess_fang_cone') return 'serpent_cone';
  if (attackSetId === 'cyclopean_mason' && attack.id === 'mason_shockwave') return 'cyclopean_shockwave';
  if (attackSetId === 'lamia' && attack.id === 'lamia_lunge') return 'lamia_lunge_trace';
  if (attackSetId === 'threadbound_warden' && attack.id === 'warden_thread_sigil') return 'warden_delayed_sigil';
  return 'guardian_sigil';
}
