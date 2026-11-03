import type { MazeLawCategory, MazeLawId } from '../types';

export interface MazeLawDefinition {
  lawId: MazeLawId;
  category: MazeLawCategory;
  prerequisites: readonly string[];
  incompatibilities: readonly MazeLawId[];
  spawnBudgetChange: { enemies: number; hazards: number };
  visualCue: string;
  whatChanges: string;
  danger: string;
  reward: string;
  trigger: string;
  modifier: Readonly<Record<string, string | number | boolean | undefined>>;
  maxStack: 1;
}

/** This registry is plain data so saved runs never capture executable behavior. */
export const MAZE_LAWS: readonly MazeLawDefinition[] = Object.freeze([
  { lawId: 'hall_of_echoes', category: 'ROOM', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 1, hazards: 0 }, visualCue: 'ECHO_CHAMBER', whatChanges: 'One combat room becomes an echo chamber with an Elite rematch.', danger: 'The remnant fights beside the chamber guardian.', reward: 'The remnant always leaves a rare item.', trigger: 'NEXT_FLOOR_GENERATION', modifier: { room: 'COMBAT_TO_ELITE', extraEnemy: 'specter', rareDrop: true }, maxStack: 1 },
  { lawId: 'vault_of_tyche', category: 'ROOM', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 0, hazards: 0 }, visualCue: 'SEALED_TYCHIAN_VAULT', whatChanges: 'A sealed side treasury gains Tyche’s trapped cache.', danger: 'Claiming it costs health or risks a failed disarm.', reward: 'A rare item is guaranteed after the trial.', trigger: 'LOCKED_ROOM_OPENED', modifier: { room: 'LOCKED_TYCHE_VAULT', trial: 'SACRIFICE_OR_DISARM', rareDrop: true }, maxStack: 1 },
  { lawId: 'pillars_of_daedalus', category: 'ROOM', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 1, hazards: 0 }, visualCue: 'DAEDALUS_PILLARS', whatChanges: 'A combat hall gains a blocking pillar and an extra guard.', danger: 'Pillars break line of sight and narrow firing lanes.', reward: 'The extra guard always leaves rare equipment.', trigger: 'NEXT_FLOOR_GENERATION', modifier: { room: 'PILLARED_HALL', lineOfSightBlocker: true, extraEnemy: 'skeleton_warrior' }, maxStack: 1 },
  { lawId: 'bronze_hounds', category: 'CREATURE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 2, hazards: 0 }, visualCue: 'BRONZE_HOUND_PACK', whatChanges: 'A chamber is hunted by a pack of two bronze hounds.', danger: 'The hounds close distance quickly and attack together.', reward: 'One hound always leaves a bronze tooth.', trigger: 'COMBAT_ROOM_SPAWN', modifier: { enemy: 'giant_rat', variant: 'bronze_hound', count: 2, reward: 'bronze_hound_tooth' }, maxStack: 1 },
  { lawId: 'arachnes_kin', category: 'CREATURE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 2, hazards: 0 }, visualCue: 'ARACHNE_NEST', whatChanges: 'A nest chamber spawns two venomous Arachne’s Brood.', danger: 'Their venom can poison an unprepared pilgrim.', reward: 'The brood always leaves an antidote flask.', trigger: 'COMBAT_ROOM_SPAWN', modifier: { enemy: 'acid_spider', count: 2, reward: 'antidote_flask' }, maxStack: 1 },
  { lawId: 'shades_of_styx', category: 'CREATURE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 1, hazards: 0 }, visualCue: 'STYGIAN_SHADE', whatChanges: 'A chamber draws one additional Stygian Shade.', danger: 'The shade pursues through narrow passages.', reward: 'Its defeat yields a soul essence.', trigger: 'COMBAT_ROOM_SPAWN', modifier: { enemy: 'specter', count: 1, reward: 'styx_soul_essence' }, maxStack: 1 },
  { lawId: 'oath_of_ares', category: 'CURSE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 0, hazards: 0 }, visualCue: 'ARES_RED_SIGIL', whatChanges: 'Ordinary enemies recover faster and attack more often.', danger: 'Shorter recovery leaves less time between attacks.', reward: 'Parrying a marked attack restores extra stamina and damages poise.', trigger: 'ENEMY_ATTACK_CYCLE', modifier: { attackCooldownMultiplier: 0.82, parryStaminaBonus: 5, poiseDamageBonus: 8 }, maxStack: 1 },
  { lawId: 'serpents_bargain', category: 'CURSE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 0, hazards: 1 }, visualCue: 'POISON_MIST', whatChanges: 'A venom pool forms in a side chamber and periodically poisons nearby pilgrims.', danger: 'Standing in the marked pool applies poison.', reward: 'An antidote flask waits beside the pool.', trigger: 'PLAYER_ENTERS_HAZARD', modifier: { hazard: 'POISON_ZONE', damage: 2, cooldownSeconds: 4, reward: 'antidote_flask' }, maxStack: 1 },
  { lawId: 'broken_thread', category: 'CURSE', prerequisites: [], incompatibilities: [], spawnBudgetChange: { enemies: 0, hazards: 0 }, visualCue: 'FRACTURED_SECRET_SEAM', whatChanges: 'A hidden branch opens into a richer but harder secret cache.', danger: 'The seam is harder to find and one failed attempt costs health.', reward: 'Opening the branch guarantees a rare item.', trigger: 'SECRET_GATE_ATTEMPT', modifier: { secret: true, difficulty: 19, attempts: 1, failureDamagePercent: 0.1, rareDrop: true }, maxStack: 1 },
]);

export const MAZE_LAW_POOL_VERSION = 1;
export const INITIAL_MAZE_LAW_POOL: readonly MazeLawId[] = Object.freeze(MAZE_LAWS.map(law => law.lawId));
export const MAZE_LAW_CATEGORIES: readonly MazeLawCategory[] = ['ROOM', 'CREATURE', 'CURSE'];
export const MAZE_LAW_META_SAVE_KEY = 'maze_of_the_minotaur_meta_v1';

/** Future meta unlocks add draft options only; this contract grants no expedition stats. */
export interface MazeLawMetaUnlockState {
  version: 1;
  unlockPoolVersion: number;
  discoveredLawIds: MazeLawId[];
}

export function getUnlockedMazeLawPool(meta?: MazeLawMetaUnlockState): MazeLawId[] {
  const unlocked = new Set<MazeLawId>(INITIAL_MAZE_LAW_POOL);
  for (const lawId of meta?.discoveredLawIds ?? []) if (getMazeLaw(lawId)) unlocked.add(lawId);
  return [...unlocked].sort();
}

export function getMazeLaw(lawId: string): MazeLawDefinition | undefined {
  return MAZE_LAWS.find(law => law.lawId === lawId);
}

export function isMazeLawId(value: unknown): value is MazeLawId {
  return typeof value === 'string' && MAZE_LAWS.some(law => law.lawId === value);
}
