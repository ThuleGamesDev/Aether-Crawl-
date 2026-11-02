export type CombatCue =
  | 'blade' | 'spear' | 'shield' | 'cast' | 'projectile' | 'enemyHit' | 'playerHit' | 'poison'
  | 'bossTelegraph' | 'bossPhase' | 'bossDeath' | 'pickup' | 'dodge' | 'heal' | 'levelUp'
  | 'stoneImpact' | 'bronzeImpact' | 'waterImpact' | 'magicImpact';

export type CombatAudioCategory = 'impact' | 'action' | 'telegraph' | 'phase' | 'death' | 'reward' | 'movement';

export const COMBAT_AUDIO_COOLDOWNS: Readonly<Record<CombatAudioCategory, number>> = {
  impact: 0.065,
  action: 0.085,
  telegraph: 0.24,
  phase: 0.3,
  death: 0.45,
  reward: 0.11,
  movement: 0.08,
};

export function combatAudioCategory(cue: CombatCue): CombatAudioCategory {
  if (cue === 'bossTelegraph') return 'telegraph';
  if (cue === 'bossPhase') return 'phase';
  if (cue === 'bossDeath') return 'death';
  if (cue === 'pickup' || cue === 'levelUp' || cue === 'heal') return 'reward';
  if (cue === 'dodge') return 'movement';
  if (cue === 'cast' || cue === 'projectile' || cue === 'poison') return 'action';
  return 'impact';
}

export function shouldPlayCombatCue(
  cue: CombatCue,
  audioTimeSeconds: number,
  lastPlayedByCategory: ReadonlyMap<CombatAudioCategory, number>,
): boolean {
  if (!Number.isFinite(audioTimeSeconds) || audioTimeSeconds < 0) return false;
  const category = combatAudioCategory(cue);
  const lastPlayed = lastPlayedByCategory.get(category);
  return lastPlayed === undefined || audioTimeSeconds - lastPlayed >= COMBAT_AUDIO_COOLDOWNS[category];
}

/** Stable, quiet pitch drift from a world position; this does not use wall-clock time. */
export function getWorldCuePitchScale(position?: { x: number; z: number }): number {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return 1;
  const wave = Math.sin(position.x * 12.9898 + position.z * 78.233) * 43758.5453;
  const fraction = wave - Math.floor(wave);
  return 0.99 + fraction * 0.02;
}
