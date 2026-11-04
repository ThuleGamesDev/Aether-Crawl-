import type { WorldEnemy } from '../types';
import { ENEMY_CORPSE_SETTLE_SECONDS, ENEMY_DEATH_ANIMATION_SECONDS } from '../constants/enemyDeath';

export type EnemyCorpseVisualPhase = 'alive' | 'falling' | 'corpse';
export type EnemyVisualKind = 'legacy' | 'rig' | 'corpse';

export function getEnemyCorpseVisualPhase(enemy: WorldEnemy): EnemyCorpseVisualPhase {
  if (enemy.health > 0 && enemy.state !== 'DEAD') return 'alive';
  return enemy.stateTimer > ENEMY_CORPSE_SETTLE_SECONDS ? 'falling' : 'corpse';
}

export function getEnemyDeathProgress(enemy: WorldEnemy): number {
  if (enemy.health > 0 && enemy.state !== 'DEAD') return 0;
  return Math.max(0, Math.min(1, 1 - Math.max(0, enemy.stateTimer) / ENEMY_DEATH_ANIMATION_SECONDS));
}

export function shouldReplaceWithCorpse(currentVisualKind: EnemyVisualKind | null, enemy: WorldEnemy): boolean {
  return getEnemyCorpseVisualPhase(enemy) === 'corpse' && currentVisualKind !== 'corpse';
}
