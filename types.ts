

export type Direction = 'N' | 'E' | 'S' | 'W';

export interface Position {
  x: number;
  y: number;
}

export interface PlayerTransform {
  /** World coordinates: integer cells are tile boundaries, not tile centers. */
  x: number;
  y: number;
  /** Horizontal look angle in radians; 0 faces east and positive turns clockwise. */
  angle: number;
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOOR = 2,
  EXIT = 3,
}

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  str: number;
  dex: number;
  int: number;
  xp: number;
  level: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'WEAPON' | 'ARMOR' | 'POTION' | 'SCROLL' | 'SHIELD' | 'ACCESSORY';
  value: number; // damage, armor, heal amount, or stat boost
  statBonus?: 'STR' | 'DEX' | 'INT' | 'HP' | 'MP'; // For accessories
  icon?: string; 
  isEquipped?: boolean;
  quantity: number;
  visualType?: WeaponVisualType;
}

export type WeaponVisualType = 'unarmed' | 'sword' | 'dagger' | 'axe' | 'mace' | 'staff' | 'bow';

export type BiomeId = 'dungeon' | 'moss' | 'catacombs' | 'obsidian' | 'frost' | 'gilded';

export interface BiomeVisualDefinition {
  wall: string;
  floor: string;
  ceiling: string;
  door: string;
  exit: string;
  torch: string;
  props: {
    barrel: string;
    crate: string;
    bones: string;
    extra: [string, string];
  };
  ambientColor: string;
}

export interface EnemyVisualDefinition {
  sprite: string;
  scale: number;
  offsetY?: number;
}

export type StatusType = 'POISON' | 'BURN' | 'REGEN' | 'SHIELD' | 'STRENGTH' | 'WEAKNESS' | 'STUN';

export type EnemyRole = 'STRIKER' | 'TANK' | 'CONTROLLER' | 'SUPPORT' | 'SCALER' | 'DISRUPTOR';

export type EnemyIntentType = 'ATTACK' | 'HEAVY_ATTACK' | 'DEFEND' | 'BUFF' | 'DEBUFF' | 'HEAL' | 'SPECIAL' | 'PREPARE' | 'SUMMON';

export interface EnemyIntent {
    type: EnemyIntentType;
    label: string;
    shortLabel: string;
    icon: string;
    minDamage?: number;
    maxDamage?: number;
    description?: string;
    abilityId: string;
    interruptible?: boolean;
}

export interface StatusEffect {
    id: string;
    type: StatusType;
    name: string;
    duration: number; // Turns remaining
    value: number; // Dmg per turn, or stat bonus amount
    icon: string;
}

export interface Skill {
  id: string;
  name: string;
  type: 'DAMAGE' | 'HEAL' | 'DRAIN' | 'BUFF' | 'DEBUFF';
  targetType: 'SINGLE' | 'MULTI' | 'SELF' | 'ALLY'; 
  cost: number;
  basePower: number;
  scaling: number; 
  scalingStat: 'INT' | 'STR' | 'DEX';
  description: string;
  level: number;
  maxLevel: number;
  vfxType: VFXType;
  effect?: {
      type: StatusType;
      duration: number;
      chance: number; // 0-1
      val: number; // Base value for effect
  }
}

export interface Perk {
    id: string;
    title: string;
    description: string;
    skillId: string;
    type: 'NEW' | 'UPGRADE';
    cost: number;
}

export interface Prop {
    id: string;
    type: 'BARREL' | 'CRATE' | 'BONES' | 'THEMED';
    pos: Position;
    assetId: string;
}

export interface Enemy {
    id: string; 
    name: string;
    hp: number;
    maxHp: number;
    damage: number;
    xpReward: number;
    visualId: string;
    isBoss?: boolean;
    statusEffects: StatusEffect[];
    /** Canonical data ID; instance IDs remain unique for targets and summons. */
    definitionId?: string;
    role?: EnemyRole;
    abilityIds?: string[];
    intent?: EnemyIntent;
    abilityCooldowns?: Record<string, number>;
    previousAbilityId?: string;
    combatFlags?: string[];
    phase?: number;
    /** Temporary damage absorption granted by guard abilities. */
    guard?: number;
    stolenScrap?: number;
    isSummoned?: boolean;
    summonedBy?: string;
    canSplit?: boolean;
    /** Fraction of incoming STUN applications resisted by bosses. */
    stunResistance?: number;
}

export type GamePhase = 'MENU' | 'CLASS_SELECT' | 'INIT' | 'EXPLORE' | 'COMBAT' | 'INVENTORY' | 'SKILLS' | 'STATS' | 'CRAFTING' | 'GAME_OVER' | 'LEVEL_UP' | 'OPTIONS';
export type CombatMenu = 'MAIN' | 'SKILLS' | 'ITEMS';

export type VFXType = 'DAMAGE' | 'HEAL' | 'ATTACK' | 'FIREBALL' | 'ENEMY_DEATH' | 'ICE' | 'LIGHTNING' | 'BUFF' | 'POISON' | 'HOLY' | 'DARK' | 'DEBUFF' | 'CRITICAL';

export interface VFXEvent {
    type: VFXType;
    id: number;
    targetId?: string; // Which enemy/player was hit?
}

export interface DungeonData {
    map: number[][];
    decorations: number[][];
}

export type ClassType = 'BARBARIAN' | 'PALADIN' | 'SORCERER' | 'ROGUE' | 'RANGER' | 'CLERIC' | 'MONK' | 'NECROMANCER';

export interface Character {
    id: string;
    name: string;
    classType: ClassType;
    stats: Stats;
    equipment: {
        weapon: Item | null;
        armor: Item | null;
        offhand: Item | null;
        accessory: Item | null;
    };
    skills: Skill[];
    statusEffects: StatusEffect[];
    isDefending: boolean;
}

export interface Player {
  /** Legacy grid cell retained for old saves and tile-based gameplay systems. */
  pos: Position;
  /** Legacy nearest-cardinal heading; the renderer uses transform.angle. */
  dir: Direction;
  /** Continuous first-person world transform. Missing only in pre-migration saves. */
  transform?: PlayerTransform;
  party: Character[];
  inventory: Item[]; // Shared inventory
  scrap: number;
}

export interface CharacterTemplate {
    name: string;
    description: string;
    stats: Stats;
    startItems: Item[];
    startSkills: Skill[];
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'combat' | 'loot' | 'story' | 'levelup';
}

export interface HighScore {
    name: string;
    class: string;
    dungeonLevel: number;
    charLevel: number;
    xp: number;
    date: string;
}

export interface SaveData {
    player: Player;
    map: number[][];
    decorations: number[][];
    explored: boolean[][];
    clearedTiles: string[]; 
    dungeonLevel: number;
    logs: LogEntry[];
    date: number;
    levelBossDefeated?: boolean;
}
