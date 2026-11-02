

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
  LOCKED = 4,
  SECRET = 5,
}

export interface Stats {
  /** Base initiative; absent only in legacy saves. Equipment load is derived. */
  initiative?: number;
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
  /** Stable base definition ID. Missing only in pre-R4A saves and legacy authored items. */
  baseId?: string;
  name: string;
  description: string;
  type: 'WEAPON' | 'ARMOR' | 'POTION' | 'SCROLL' | 'SHIELD' | 'ACCESSORY';
  value: number; // damage, armor, heal amount, or stat boost
  armorWeight?: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  statBonus?: 'STR' | 'DEX' | 'INT' | 'HP' | 'MP'; // For accessories
  consumableEffect?: 'HEALTH' | 'MANA';
  icon?: string; 
  isEquipped?: boolean;
  quantity: number;
  visualType?: WeaponVisualType;
}

export type WeaponVisualType = 'unarmed' | 'sword' | 'dagger' | 'axe' | 'mace' | 'staff' | 'bow' | 'spear';

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
    /** Legacy authored timing metadata; round combat does not count down. */
    castTimeMs?: number;
    recoveryMs?: number;
    interruptResistance?: number;
}

export interface StatusEffect {
    id: string;
    type: StatusType;
    name: string;
    duration: number; // Own turns remaining (turn start for heroes, intent resolution for enemies)
    value: number; // Dmg per turn, or stat bonus amount
    icon: string;
}

export interface Skill {
  /** Legacy timing metadata, ignored by initiative-round combat. */
  recoveryMs?: number;
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
    initiative?: number;
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
    floor?: FloorState;
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

export type RoomEventStat = 'STR' | 'DEX' | 'INT';
export type RoomHazardType = 'TRAP' | 'MIST' | 'SPORES' | 'COLLAPSE' | 'ARCANE_SURGE' | 'FROST';

export interface RoomEventCheckModifier {
  label: string;
  value: number;
}

export interface CharacterEventCheckResult {
  characterId: string;
  characterName: string;
  classType: ClassType;
  baseStat: RoomEventStat;
  statValue: number;
  statBonus: number;
  modifiers: RoomEventCheckModifier[];
  roll: number;
  totalScore: number;
  difficultyClass: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
  hpChange: number;
  mpChange: number;
  statusApplied?: StatusType;
  statusDuration?: number;
  logSummary: string;
}

export interface RoomEventDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  primaryStat: RoomEventStat;
  hazardType: RoomHazardType;
  accentColor: string;
}

export interface ActiveRoomEvent {
  event: RoomEventDefinition;
  dungeonLevel: number;
  difficultyClass: number;
  results: CharacterEventCheckResult[];
  scrapsFound?: number;
  summary: string;
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
    activeRoomEvent?: ActiveRoomEvent | null;
    floor?: FloorState;
}


export type DungeonRoomType = 'NORMAL' | 'COMBAT' | 'ELITE' | 'TREASURE' | 'SHRINE' | 'TRAP' | 'SECRET' | 'REST' | 'LOCKED' | 'EVENT' | 'BOSS_ANTECHAMBER' | 'BOSS';
export interface DungeonRoom {
  id: string;
  type: DungeonRoomType;
  anchor: Position;
  cells: Position[];
  gate?: Position;
  discovered: boolean;
  visited: boolean;
  resolved: boolean;
  attempted?: boolean;
  unlocked?: boolean;
  shrine?: 'blood' | 'aether' | 'fortune';
  hazardId?: string;
}
export interface FloorState {
  version: 1;
  seed: number;
  level: number;
  biome: BiomeId;
  rooms: DungeonRoom[];
  visitedCells: string[];
  keys: number;
  pendingEncounterId: string | null;
  pendingEffects: Array<{ type: StatusType; value: number; duration: number }>;
  /** R2A required descent guardian; optional only while reading a legacy R1 floor for migration. */
  guardianId?: string | null;
  guardianState?: 'NOT_DISCOVERED' | 'ALIVE' | 'DEFEATED' | 'DESCENT_UNLOCKED';
}

/** Player-owned state for the active solo action-RPG runtime. */
export interface SoloCharacterStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  /** Unmodified progression caps. maxHp/maxMp are derived caches for the active FPS run. */
  baseMaxHp?: number;
  baseMaxMp?: number;
  str: number;
  dex: number;
  int: number;
  xp: number;
  level: number;
  damageBonus: number;
  /** Base armor for authored class progression. Equipment armor is derived separately. */
  baseArmor?: number;
  /** Legacy cached equipment armor. R4A recalculates it from equipment and never aggregates it. */
  armor: number;
}

export type EquipmentSlot = 'weapon' | 'armor' | 'offhand' | 'accessory';
export type ItemRarity = 'COMMON' | 'MAGIC' | 'RARE' | 'UNIQUE';

export type ItemTag = 'WEAPON' | 'PHYSICAL' | 'SPELL' | 'MELEE' | 'PROJECTILE' | 'BOW' | 'DAGGER' | 'STAFF' | 'TWO_HANDED'
  | 'ARMOR' | 'SHIELD' | 'ACCESSORY' | 'RING' | 'AMULET' | 'CONSUMABLE';

/** Immutable authored base; item instances store its stable baseId and rolled modifiers. */
export interface ItemBaseDefinition extends Omit<Item, 'isEquipped' | 'quantity' | 'baseId'> {
  baseId: string;
  tags: ItemTag[];
  requiredLevel: number;
  twoHanded?: boolean;
  legacyIds?: string[];
}

export type ItemAffixStat = 'strengthFlat' | 'dexterityFlat' | 'intelligenceFlat'
  | 'physicalDamageFlat' | 'physicalDamagePercent' | 'spellDamageFlat' | 'spellDamagePercent'
  | 'attackSpeedPercent' | 'castSpeedPercent' | 'criticalChancePercent' | 'criticalDamagePercent'
  | 'maxHealthFlat' | 'maxHealthPercent' | 'maxManaFlat' | 'maxManaPercent'
  | 'armorFlat' | 'armorPercent' | 'movementSpeedPercent' | 'cooldownReductionPercent' | 'manaCostReductionPercent'
  | 'projectileDamagePercent' | 'projectileSpeedPercent'
  | 'bleedChancePercent' | 'bleedPowerPercent' | 'poisonChancePercent' | 'poisonPowerPercent'
  | 'fireChancePercent' | 'firePowerPercent' | 'lifeOnHit' | 'lifeOnKill';

export interface ItemAffixDefinition {
  id: string;
  name: string;
  side: 'PREFIX' | 'SUFFIX';
  stat: ItemAffixStat;
  tier: number;
  minLevel: number;
  validItemTags: ItemTag[];
  minValue: number;
  maxValue: number;
  /** Affixes with the same group cannot appear together on one item. */
  group: string;
}

export interface ItemAffixInstance {
  id: string;
  value: number;
  tier?: number;
}

export interface ItemInstance extends Omit<Item, 'quantity' | 'isEquipped'> {
  /** Required on R4A-created/saved items; optional in TypeScript for lossless legacy reads. */
  baseId?: string;
  instanceId: string;
  itemLevel: number;
  rarity: ItemRarity;
  affixes: ItemAffixInstance[];
  uniqueEffectId?: string;
  quantity: number;
}

export interface LearnedSkill {
  abilityId: string;
  rank: number;
}

export type ClassPassiveId = 'war_momentum' | 'unbroken_line' | 'omen_weaving' | 'opportunist';
export type MagicSchool = 'FIRE' | 'LIGHTNING' | 'ARCANE';
export type ClassPassiveState =
  | { passiveId: 'war_momentum'; stacks: number; remainingSeconds: number; cooldownRemaining: 0; charges: 0 }
  | { passiveId: 'unbroken_line'; stacks: 0; remainingSeconds: number; cooldownRemaining: number; charges: 0 | 1 }
  | { passiveId: 'omen_weaving'; stacks: 0; remainingSeconds: 0; cooldownRemaining: 0; charges: 0; lastSchool: MagicSchool | null }
  | { passiveId: 'opportunist'; stacks: 0; remainingSeconds: number; cooldownRemaining: number; charges: 0 | 1 };

export interface ActiveStatus {
  id: string;
  statusId: string;
  durationSeconds: number;
  magnitude: number;
  /** Time until the next real-time tick for damage-over-time effects. */
  tickRemainingSeconds?: number;
}

export type RealtimeStatusId = 'BLEED' | 'POISON' | 'BURN' | 'SLOW' | 'STAGGER' | 'WEAKNESS' | 'GUARD' | 'COUNTER' | 'BLOOD_OATH';

export interface StatusApplication {
  statusId: RealtimeStatusId;
  durationSeconds: number;
  magnitude: number;
  tickIntervalSeconds?: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface PlayerCharacter {
  id: string;
  classId: ClassType;
  name: string;
  position: Vector3Like;
  rotation: { yaw: number; pitch: number };
  stats: SoloCharacterStats;
  equipment: Record<EquipmentSlot, ItemInstance | null>;
  inventory: ItemInstance[];
  /** Persisted 10×5 bag positions; items without a position remain safe in overflow storage. */
  inventoryGrid?: InventoryGridPlacement[];
  /** Runtime timers/charges for equipped Unique rules. */
  uniqueEffectStates?: UniqueEffectState[];
  skills: LearnedSkill[];
  /** Earned, unspent R5A skill choices; persisted so delayed choices are never lost. */
  skillPoints?: number;
  /** Marks migration of legacy R4B runs into the class-skill progression. */
  skillProgressionVersion?: 1;
  /** Bounded class-passive state is part of the solo run save. */
  classPassiveState?: ClassPassiveState;
  statusEffects: ActiveStatus[];
}

export interface InventoryGridPlacement {
  instanceId: string;
  x: number;
  y: number;
}

export type UniqueEffectId = 'ariadnes_thread' | 'aspis_bronze_gate' | 'serpent_queen_fang' | 'promethean_ember'
  | 'stygian_seal' | 'artemis_mark' | 'cyclopean_mallet' | 'laurel_asclepius';

export interface UniqueEffectState {
  effectId: UniqueEffectId;
  cooldownRemaining: number;
  durationRemaining: number;
  charges: number;
}

export type WorldEnemyState = 'IDLE' | 'ALERT' | 'AGGRO' | 'APPROACH' | 'CHASE' | 'REPOSITION' | 'RETREAT' | 'ATTACK_WINDUP' | 'ATTACK_ACTIVE' | 'ATTACK' | 'RECOVER' | 'HURT' | 'STAGGER' | 'DEAD';
export type WorldEnemyRole = 'CHASER' | 'TANK' | 'SKIRMISHER' | 'CONTROLLER' | 'HEAVY' | 'SUPPORT';

export interface WorldEnemy {
  id: string;
  definitionId: string;
  name: string;
  visualId: string;
  position: Vector3Like;
  /** Horizontal collision radius used by the solo world controller. */
  collisionRadius?: number;
  health: number;
  maxHealth: number;
  damage: number;
  xpReward: number;
  state: WorldEnemyState;
  stateTimer: number;
  attackCooldown: number;
  attackRange: number;
  attackTelegraphSeconds: number;
  attackSetId?: string;
  attackIndex?: number;
  activeAttackId?: string;
  lastAttackId?: string;
  facingYaw?: number;
  behaviorRole?: WorldEnemyRole;
  statusEffects?: ActiveStatus[];
  phase?: number;
  phaseTransitioned?: boolean;
  repositionCooldownSeconds?: number;
  pathRefreshSeconds?: number;
  pathTargetCell?: { x: number; y: number };
  pathStep?: { x: number; y: number };
  telegraphPosition?: Vector3Like;
  rewardGranted: boolean;
  roomId?: string;
  lootTier?: 'NORMAL' | 'ELITE' | 'GUARDIAN';
  isBoss: boolean;
}

/** Single canonical output of player base stats, equipped bases, and validated affixes. */
export interface DerivedCharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  maxHealth: number;
  maxMana: number;
  armor: number;
  weaponPower: number;
  physicalDamageFlat: number;
  physicalDamageMultiplier: number;
  spellDamageFlat: number;
  spellDamageMultiplier: number;
  attackSpeedMultiplier: number;
  castSpeedMultiplier: number;
  criticalChance: number;
  criticalDamageMultiplier: number;
  movementSpeedMultiplier: number;
  cooldownMultiplier: number;
  manaCostMultiplier: number;
  projectileDamageMultiplier: number;
  projectileSpeedMultiplier: number;
  bleedChance: number;
  bleedPowerMultiplier: number;
  poisonChance: number;
  poisonPowerMultiplier: number;
  fireChance: number;
  firePowerMultiplier: number;
  lifeOnHit: number;
  lifeOnKill: number;
}

export interface WorldProjectile {
  id: number;
  position: Vector3Like;
  velocity: Vector3Like;
  radius: number;
  damage: number;
  remainingSeconds: number;
  sourceAbilityId: string;
  color: string;
  faction?: 'PLAYER' | 'ENEMY';
  ownerEnemyId?: string;
  statusEffect?: StatusApplication;
  healOwnerRatio?: number;
}

export interface WorldLootDrop {
  id: string;
  position: Vector3Like;
  item: ItemInstance;
}
