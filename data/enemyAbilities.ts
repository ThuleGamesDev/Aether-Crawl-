import type { EnemyIntentType, StatusType, VFXType } from '../types';

export type EnemyAbilityEffect =
  | { kind: 'damage'; multiplier: number; status?: { type: StatusType; duration: number; value: number; chance?: number } }
  | { kind: 'guard'; amount: number; protectAlly?: boolean }
  | { kind: 'buff_all'; type: StatusType; duration: number; value: number }
  | { kind: 'debuff'; type: StatusType; duration: number; value: number; multiplier?: number }
  | { kind: 'steal_scrap'; maxAmount: number }
  | { kind: 'prepare'; flag: string; consumeFlag?: string }
  | { kind: 'summon'; enemyId: string; count: number; scale: number; consumeFlag?: string; setFlag?: string }
  | { kind: 'split'; enemyId: string; count: number; scale: number; consumeFlag: string; setFlag: string }
  | { kind: 'harvest_summon'; heal: number; consumeFlag?: string };

export interface EnemyAbilityDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  intentType: EnemyIntentType;
  description: string;
  weight: number;
  cooldown?: number;
  damageMultiplier?: number;
  vfxType?: VFXType;
  interruptible?: boolean;
  afterAbilityId?: string;
  minPhase?: number;
  maxPhase?: number;
  minHpRatio?: number;
  maxHpRatio?: number;
  requiredFlag?: string;
  forbiddenFlag?: string;
  requiresSummon?: boolean;
  requiresScrap?: boolean;
  requiresCanSplit?: boolean;
  cancelFlagOnInterrupt?: string;
  consumeFlagOnResolve?: string;
  setFlagOnResolve?: string;
  effect: EnemyAbilityEffect;
}

export const enemyAbilities: Record<string, EnemyAbilityDefinition> = {
  basic_attack: {
    id: 'basic_attack', name: 'Attack', shortName: 'Attack', icon: '⚔', intentType: 'ATTACK',
    description: 'A straightforward attack against one party member.', weight: 1, damageMultiplier: 1,
    effect: { kind: 'damage', multiplier: 1 },
  },
  rat_bite: {
    id: 'rat_bite', name: 'Bite', shortName: 'Bite', icon: '⚔', intentType: 'ATTACK',
    description: 'The rat bites one party member.', weight: 5, damageMultiplier: 1,
    effect: { kind: 'damage', multiplier: 1 },
  },
  rat_desperate_bite: {
    id: 'rat_desperate_bite', name: 'Desperate Bite', shortName: 'Desperate', icon: '💥', intentType: 'HEAVY_ATTACK',
    description: 'A wounded rat lunges with a harder bite.', weight: 3, cooldown: 3, maxHpRatio: 0.35, damageMultiplier: 1.45,
    effect: { kind: 'damage', multiplier: 1.45 },
  },
  spider_venom_fang: {
    id: 'spider_venom_fang', name: 'Venom Fang', shortName: 'Venom', icon: '☠', intentType: 'DEBUFF',
    description: 'A fang strike deals damage and inflicts poison for two turns.', weight: 4, cooldown: 1, damageMultiplier: 0.72,
    effect: { kind: 'damage', multiplier: 0.72, status: { type: 'POISON', duration: 2, value: 3, chance: 1 } },
  },
  spider_web: {
    id: 'spider_web', name: 'Web', shortName: 'Web', icon: '🕸', intentType: 'DEBUFF',
    description: 'Sticky webbing weakens one party member for their next action.', weight: 2, cooldown: 2,
    effect: { kind: 'debuff', type: 'WEAKNESS', duration: 2, value: 3 },
  },
  goblin_stab: {
    id: 'goblin_stab', name: 'Shiv', shortName: 'Shiv', icon: '⚔', intentType: 'ATTACK',
    description: 'A quick stab against one party member.', weight: 4, damageMultiplier: 0.8,
    effect: { kind: 'damage', multiplier: 0.8 },
  },
  goblin_scavenge: {
    id: 'goblin_scavenge', name: 'Scavenge', shortName: 'Scavenge', icon: '🪙', intentType: 'SPECIAL',
    description: 'Steals up to three scrap. Defeating the goblin returns what it took.', weight: 2, cooldown: 2, requiresScrap: true,
    effect: { kind: 'steal_scrap', maxAmount: 3 },
  },
  skeleton_slash: {
    id: 'skeleton_slash', name: 'Slash', shortName: 'Slash', icon: '⚔', intentType: 'ATTACK',
    description: 'A measured sword slash.', weight: 4, damageMultiplier: 1,
    effect: { kind: 'damage', multiplier: 1 },
  },
  skeleton_raise_shield: {
    id: 'skeleton_raise_shield', name: 'Raise Shield', shortName: 'Guard', icon: '🛡', intentType: 'DEFEND',
    description: 'Gains guard and shields a nearby ally when one is present.', weight: 2, cooldown: 2,
    effect: { kind: 'guard', amount: 10, protectAlly: true },
  },
  orc_slam: {
    id: 'orc_slam', name: 'Slam', shortName: 'Slam', icon: '⚔', intentType: 'ATTACK',
    description: 'A direct, heavy-handed attack.', weight: 2, damageMultiplier: 1.05,
    effect: { kind: 'damage', multiplier: 1.05 },
  },
  orc_wind_up: {
    id: 'orc_wind_up', name: 'Wind Up', shortName: 'Winding', icon: '👁', intentType: 'PREPARE',
    description: 'The Orc Brute is preparing a Crushing Blow. Stun it or defend before the next enemy phase.', weight: 3, cooldown: 2, interruptible: true, vfxType: 'ATTACK',
    effect: { kind: 'prepare', flag: 'orc_wind_up' },
  },
  orc_crushing_blow: {
    id: 'orc_crushing_blow', name: 'Crushing Blow', shortName: 'Crush!', icon: '💥', intentType: 'HEAVY_ATTACK',
    description: 'A crushing strike follows the wind-up. Defend or interrupt it to cut the damage.', weight: 1, damageMultiplier: 1.9,
    requiredFlag: 'orc_wind_up', afterAbilityId: 'orc_wind_up', interruptible: true, cancelFlagOnInterrupt: 'orc_wind_up', consumeFlagOnResolve: 'orc_wind_up', setFlagOnResolve: 'orc_recover',
    effect: { kind: 'damage', multiplier: 1.9 },
  },
  orc_recover: {
    id: 'orc_recover', name: 'Recover', shortName: 'Recover', icon: '🛡', intentType: 'DEFEND',
    description: 'The brute regains its footing and briefly guards.', weight: 1, requiredFlag: 'orc_recover', afterAbilityId: 'orc_crushing_blow', consumeFlagOnResolve: 'orc_recover',
    effect: { kind: 'guard', amount: 5 },
  },
  cultist_dark_bolt: {
    id: 'cultist_dark_bolt', name: 'Dark Bolt', shortName: 'Dark Bolt', icon: '✦', intentType: 'ATTACK',
    description: 'A bolt of dark energy strikes one party member.', weight: 3, damageMultiplier: 0.75,
    effect: { kind: 'damage', multiplier: 0.75 },
  },
  cultist_dark_chant: {
    id: 'cultist_dark_chant', name: 'Dark Chant', shortName: 'Chant', icon: '✨', intentType: 'BUFF',
    description: 'Strengthens all living enemies for two turns.', weight: 2, cooldown: 3,
    effect: { kind: 'buff_all', type: 'STRENGTH', duration: 3, value: 4 },
  },
  slime_bounce: {
    id: 'slime_bounce', name: 'Bounce', shortName: 'Bounce', icon: '⚔', intentType: 'ATTACK',
    description: 'A body-check against one party member.', weight: 4, damageMultiplier: 0.9,
    effect: { kind: 'damage', multiplier: 0.9 },
  },
  slime_unstable: {
    id: 'slime_unstable', name: 'Unstable', shortName: 'Unstable', icon: '👁', intentType: 'PREPARE',
    description: 'The slime is wobbling apart. Its next intent will show whether it can split.', weight: 2, cooldown: 99, maxHpRatio: 0.45, requiresCanSplit: true, forbiddenFlag: 'slime_split_done', interruptible: true, vfxType: 'POISON',
    effect: { kind: 'prepare', flag: 'slime_split_ready' },
  },
  slime_split: {
    id: 'slime_split', name: 'Split', shortName: 'Split', icon: '🫧', intentType: 'SUMMON',
    description: 'Breaks into two weaker slimes. Child slimes never split again.', weight: 1, requiredFlag: 'slime_split_ready', requiresCanSplit: true, vfxType: 'POISON',
    effect: { kind: 'split', enemyId: 'green_slime', count: 2, scale: 0.42, consumeFlag: 'slime_split_ready', setFlag: 'slime_split_done' },
  },
  necromancer_soul_bolt: {
    id: 'necromancer_soul_bolt', name: 'Soul Bolt', shortName: 'Soul Bolt', icon: '☠', intentType: 'ATTACK',
    description: 'A bolt of necrotic energy targets one party member.', weight: 4, damageMultiplier: 1,
    effect: { kind: 'damage', multiplier: 1 },
  },
  necromancer_summon_dead: {
    id: 'necromancer_summon_dead', name: 'Summon Dead', shortName: 'Summon', icon: '💀', intentType: 'SUMMON',
    description: 'Calls one weak skeleton to the fight, up to the combat enemy cap.', weight: 2, cooldown: 3, maxPhase: 1,
    effect: { kind: 'summon', enemyId: 'skeleton_warrior', count: 1, scale: 0.75 },
  },
  necromancer_curse: {
    id: 'necromancer_curse', name: 'Curse', shortName: 'Curse', icon: '☠', intentType: 'DEBUFF',
    description: 'Weakens one party member for their next action.', weight: 2, cooldown: 2, maxPhase: 1,
    effect: { kind: 'debuff', type: 'WEAKNESS', duration: 2, value: 4 },
  },
  necromancer_mass_raise_prepare: {
    id: 'necromancer_mass_raise_prepare', name: 'Mass Raise', shortName: 'Mass Raise', icon: '👁', intentType: 'PREPARE',
    description: 'The Necromancer begins a mass ritual. Stun can interrupt it before the skeletons rise.', weight: 1, minPhase: 2, maxPhase: 2, requiredFlag: 'necromancer_mass_due', forbiddenFlag: 'necromancer_mass_raised', cooldown: 99, interruptible: true, consumeFlagOnResolve: 'necromancer_mass_due', vfxType: 'DARK',
    effect: { kind: 'prepare', flag: 'necromancer_mass_ready' },
  },
  necromancer_mass_raise: {
    id: 'necromancer_mass_raise', name: 'Mass Raise', shortName: 'Raise Dead', icon: '💀', intentType: 'SUMMON',
    description: 'Raises up to two skeletons, limited by the enemy cap.', weight: 1, minPhase: 2, maxPhase: 2, requiredFlag: 'necromancer_mass_ready', interruptible: true, cancelFlagOnInterrupt: 'necromancer_mass_ready',
    effect: { kind: 'summon', enemyId: 'skeleton_warrior', count: 2, scale: 0.85, consumeFlag: 'necromancer_mass_ready', setFlag: 'necromancer_mass_raised' },
  },
  necromancer_soul_harvest: {
    id: 'necromancer_soul_harvest', name: 'Soul Harvest', shortName: 'Harvest', icon: '🩸', intentType: 'HEAL',
    description: 'Consumes one summoned skeleton to restore 24 HP.', weight: 2, cooldown: 3, minPhase: 2, requiresSummon: true,
    effect: { kind: 'harvest_summon', heal: 24 },
  },
};
