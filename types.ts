

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

/** Persisted decoration codes. Codes 1–6 retain their existing meanings. Wall markers share a solid wall tile. */
export const DungeonDecoration = {
    WALL_TORCH: 1,
    AMPHORA: 2,
    BROKEN_AMPHORA: 3,
    LABYRINTH_TABLET: 4,
    OFFERING_ALTAR: 5,
    COLUMN_FRAGMENT: 6,
    OIL_BOWL: 7,
    PILLAR: 8,
    FRESCO_PANEL: 9,
    BULL_RELIEF: 10,
} as const;

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
  type: 'WEAPON' | 'ARMOR' | 'POTION' | 'SCROLL' | 'SHIELD' | 'ACCESSORY' | 'MATERIAL';
  value: number; // damage, armor, heal amount, or stat boost
  armorWeight?: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  statBonus?: 'STR' | 'DEX' | 'INT' | 'HP' | 'MP'; // For accessories
  consumableEffect?: 'HEALTH' | 'MANA' | 'ANTIDOTE';
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
export type MazeLawId = 'hall_of_echoes' | 'vault_of_tyche' | 'pillars_of_daedalus' | 'bronze_hounds' | 'arachnes_kin' | 'shades_of_styx' | 'oath_of_ares' | 'serpents_bargain' | 'broken_thread';
export type MazeLawCategory = 'ROOM' | 'CREATURE' | 'CURSE';
export type MazeLawSynergyId = 'echo_pack' | 'ares_pillar_arena' | 'venom_nest';
export type AriadneThreadAction = 'REVEAL_PASSAGE' | 'SEAL_PASSAGE';
export type AriadneThreadDirection = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';
export interface AriadneThreadRoute {
  id: string;
  action: AriadneThreadAction;
  direction: AriadneThreadDirection;
  fromRoomId: string;
  toRoomId: string;
  cells: Position[];
}
export interface AriadneThreadJunction {
  id: string;
  anchorRoomId: string;
  anchorPosition: Position;
  revealRoute: AriadneThreadRoute;
  sealRoute: AriadneThreadRoute;
}
export interface AriadneThreadAnchorState {
  junctionId: string;
  discovered: boolean;
  used: boolean;
}
export interface AriadneThreadJunctionChoice {
  junctionId: string;
  action: AriadneThreadAction;
  routeId: string;
  chargeCost: number;
  healthCost: number;
  topologyRevision: number;
}
export interface AriadneThreadProgress {
  version: 1;
  charges: number;
  maxCharges: 3;
  anchorStates: AriadneThreadAnchorState[];
  junctionChoices: AriadneThreadJunctionChoice[];
  topologyRevision: number;
  openJunctionId?: string;
}
export interface MazeLawDraft {
  version: 1;
  offerId: string;
  guardianId: string;
  floorLevel: number;
  poolVersion: number;
  lawIds: [MazeLawId, MazeLawId, MazeLawId];
  open: boolean;
  selectedLawId?: MazeLawId;
  pendingLawId?: MazeLawId;
  replacedLawId?: MazeLawId;
}
export interface ActiveMazeLaw {
  lawId: MazeLawId;
  selectedAtFloor: number;
  acquiredOrder: number;
  firstManifestedFloor: number | null;
  lastManifestedFloor: number | null;
  manifestationCount: number;
}
export interface MazeLawChoiceRecord {
  offerId: string;
  lawId: MazeLawId;
  replacedLawId?: MazeLawId;
  floorLevel: number;
}
export interface MazeLawProgress {
  version: 1;
  activeLaws: ActiveMazeLaw[];
  choiceHistory: MazeLawChoiceRecord[];
  draft?: MazeLawDraft;
}
export interface MazeLawSpawn {
  lawId: MazeLawId;
  roomId: string;
  definitionId: string;
  count: number;
  displayName?: string;
  rewardBaseId?: string;
}
export interface MazeLawHazard {
  id: string;
  lawId: MazeLawId;
  x: number;
  z: number;
  radius: number;
  damage: number;
  cooldownSeconds: number;
  cooldownRemaining: number;
  rewardBaseId?: string;
  roomId?: string;
  synergyId?: MazeLawSynergyId;
}
export type ArchitecturalRoomShape = 'ENTRY_HALL' | 'HALL' | 'GALLERY' | 'CROSSROADS' | 'PILLARED_HALL' | 'ROTUNDA' | 'GUARDIAN_ARENA' | 'WIDE_PASSAGE' | 'NARROW_PASSAGE';
export type ArchitecturalCombatSuitability = 'NONE' | 'LIMITED' | 'SUITABLE';
export type ArchitecturalLightingTheme = 'AMBER' | 'NEUTRAL' | 'COOL' | 'CHTHONIC';

/** Spatial presentation metadata; the tile grid remains authoritative for collision, pathing, and line of sight. */
export interface ArchitecturalRoom {
  id: string;
  cells: Position[];
  roomShape: ArchitecturalRoomShape;
  combatSuitability: ArchitecturalCombatSuitability;
  lightingTheme: ArchitecturalLightingTheme;
  landmarkIds: string[];
  /** Reserved for later ruleset-specific content such as R6D1; no such content is authored in R6A. */
  roomArchetype?: string;
  /** Stable identifier for a prepared Ariadne's Thread anchor room. */
  threadJunctionId?: string;
  synergyId?: MazeLawSynergyId;
}

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
  lawId?: MazeLawId;
  lawIds?: MazeLawId[];
  synergyId?: MazeLawSynergyId;
}
export interface FloorState {
  version: 1;
  seed: number;
  level: number;
  biome: BiomeId;
  rooms: DungeonRoom[];
  /** Optional on legacy R4 saves; new R6A floors persist their deterministic architecture descriptors. */
  architectureRooms?: ArchitecturalRoom[];
  visitedCells: string[];
  keys: number;
  pendingEncounterId: string | null;
  pendingEffects: Array<{ type: StatusType; value: number; duration: number }>;
  /** R2A required descent guardian; optional only while reading a legacy R1 floor for migration. */
  guardianId?: string | null;
  guardianState?: 'NOT_DISCOVERED' | 'ALIVE' | 'DEFEATED' | 'DESCENT_UNLOCKED';
  lawProgress?: MazeLawProgress;
  lawSpawns?: MazeLawSpawn[];
  lawHazards?: MazeLawHazard[];
  manifestedLawIds?: MazeLawId[];
  manifestedSynergyIds?: MazeLawSynergyId[];
  /** Seeded route-edit options prepared by the architectural floor generator. */
  threadJunctions?: AriadneThreadJunction[];
  /** Run-owned charges and per-floor, versioned route-edit history. */
  threadProgress?: AriadneThreadProgress;
}

export type MazeChronicleEvent =
  | { id: string; sequence: number; kind: 'LAW_CHOSEN'; floor: number; lawId: MazeLawId; offerId: string; replacedLawId?: MazeLawId }
  | { id: string; sequence: number; kind: 'LAW_MANIFESTED'; floor: number; lawId: MazeLawId }
  | { id: string; sequence: number; kind: 'SYNERGY_MANIFESTED'; floor: number; synergyId: MazeLawSynergyId }
  | { id: string; sequence: number; kind: 'THREAD_WOVEN'; floor: number; junctionId: string; routeId: string; action: AriadneThreadAction; chargeCost: number; healthCost: number }
  | { id: string; sequence: number; kind: 'ROOM_FAMILY_DISCOVERED'; floor: number; familyId: DungeonRoomType }
  | { id: string; sequence: number; kind: 'ENEMY_FAMILY_DISCOVERED'; floor: number; familyId: string };

/** A bounded, run-local record of choices and discoveries; it contains no telemetry or timestamps. */
export interface MazeChronicle {
  version: 1;
  nextSequence: number;
  events: MazeChronicleEvent[];
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
  /** Base stamina for real-time combat; omitted by pre-R6C version-5 saves. */
  baseMaxStamina?: number;
  /** Current R6C stamina; omitted by pre-R6C version-5 saves and restored to full once. */
  stamina?: number;
  /** Delay before stamina begins regenerating after an action or guard drain. */
  staminaRegenDelaySeconds?: number;
  /** Legacy cached equipment armor. R4A recalculates it from equipment and never aggregates it. */
  armor: number;
}

export type EquipmentSlot = 'mainHand' | 'offHand' | 'head' | 'torso' | 'arms' | 'legs' | 'feet' | 'neck' | 'ring1' | 'ring2' | 'divineSigil';
export type EquipmentLoadout = Record<EquipmentSlot, ItemInstance | null>;
/** R1–R4 saves use this shape and are converted before the active runtime receives them. */
export type LegacyEquipmentSlot = 'weapon' | 'armor' | 'offhand' | 'accessory';
export type LegacyEquipmentLoadout = Record<LegacyEquipmentSlot, ItemInstance | null>;
export type ItemRarity = 'COMMON' | 'MAGIC' | 'RARE' | 'UNIQUE';

export type ItemTag = 'WEAPON' | 'PHYSICAL' | 'SPELL' | 'MELEE' | 'PROJECTILE' | 'BOW' | 'DAGGER' | 'STAFF' | 'TWO_HANDED'
  | 'ARMOR' | 'SHIELD' | 'ACCESSORY' | 'RING' | 'AMULET' | 'FOCUS' | 'DIVINE_SIGIL' | 'CONSUMABLE' | 'MATERIAL';

/** Immutable authored base; item instances store its stable baseId and rolled modifiers. */
export interface ItemBaseDefinition extends Omit<Item, 'isEquipped' | 'quantity' | 'baseId'> {
  baseId: string;
  tags: ItemTag[];
  /** Explicit compatible slots; rings may use either ring slot and one-handed weapons may use either hand. */
  equipmentSlots: EquipmentSlot[];
  requiredLevel: number;
  twoHanded?: boolean;
  legacyIds?: string[];
}

export type ItemAffixStat = 'strengthFlat' | 'dexterityFlat' | 'intelligenceFlat'
  | 'physicalDamageFlat' | 'physicalDamagePercent' | 'spellDamageFlat' | 'spellDamagePercent'
  | 'attackSpeedPercent' | 'castSpeedPercent' | 'criticalChancePercent' | 'criticalDamagePercent'
  | 'maxHealthFlat' | 'maxHealthPercent' | 'maxManaFlat' | 'maxManaPercent' | 'maxStaminaFlat' | 'staminaRegenPercent'
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

export type ClassPassiveId = 'war_momentum' | 'unbroken_line' | 'omen_weaving' | 'opportunist'
  | 'marked_prey' | 'measured_remedy' | 'flow_state' | 'soul_tribute';
export type MagicSchool = 'FIRE' | 'LIGHTNING' | 'ARCANE';
export type ClassPassiveState =
  | { passiveId: 'war_momentum'; stacks: number; remainingSeconds: number; cooldownRemaining: 0; charges: 0 }
  | { passiveId: 'unbroken_line'; stacks: 0; remainingSeconds: number; cooldownRemaining: number; charges: 0 | 1 }
  | { passiveId: 'omen_weaving'; stacks: 0; remainingSeconds: 0; cooldownRemaining: 0; charges: 0; lastSchool: MagicSchool | null }
  | { passiveId: 'opportunist'; stacks: 0; remainingSeconds: number; cooldownRemaining: number; charges: 0 | 1 }
  | { passiveId: 'marked_prey'; targetId: string | null; stacks: number; remainingSeconds: number; cooldownRemaining: 0; charges: 0 }
  | { passiveId: 'measured_remedy'; stacks: 0; remainingSeconds: 0; cooldownRemaining: number; charges: 0 }
  | { passiveId: 'flow_state'; stacks: number; remainingSeconds: number; cooldownRemaining: 0; charges: 0 }
  | { passiveId: 'soul_tribute'; stacks: number; remainingSeconds: number; cooldownRemaining: number; charges: 0 | 1 };

export interface ActiveStatus {
  id: string;
  statusId: string;
  durationSeconds: number;
  magnitude: number;
  /** Time until the next real-time tick for damage-over-time effects. */
  tickRemainingSeconds?: number;
}

export type RealtimeStatusId = 'BLEED' | 'POISON' | 'BURN' | 'SLOW' | 'STAGGER' | 'WEAKNESS' | 'GUARD' | 'COUNTER' | 'BLOOD_OATH'
  | 'REGEN' | 'HASTE' | 'PRECISION' | 'CURSE';

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
  equipment: EquipmentLoadout;
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

export type LegacyPlayerCharacter = Omit<PlayerCharacter, 'equipment'> & { equipment: LegacyEquipmentLoadout };

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
  /** R6C combat mastery state; optional so existing v5 saves remain valid. */
  poise?: number;
  maxPoise?: number;
  poiseRecoveryDelaySeconds?: number;
  poiseBreakRecoverySeconds?: number;
  staggerImmunitySeconds?: number;
  phaseTransitionLockSeconds?: number;
  repositionCooldownSeconds?: number;
  pathRefreshSeconds?: number;
  pathTargetCell?: { x: number; y: number };
  pathStep?: { x: number; y: number };
  telegraphPosition?: Vector3Like;
  rewardGranted: boolean;
  roomId?: string;
  lootTier?: 'NORMAL' | 'ELITE' | 'GUARDIAN';
  lawId?: MazeLawId;
  lawRewardBaseId?: string;
  attackCooldownMultiplier?: number;
  isBoss: boolean;
}

/** Single canonical output of player base stats, equipped bases, and validated affixes. */
export interface DerivedCharacterStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  staminaRegenPerSecond: number;
  armor: number;
  weaponPower: number;
  mainHandWeaponPower: number;
  offHandWeaponPower: number;
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
  /** Additional enemy hits after the first contact; capped by the projectile system. */
  pierceRemaining?: number;
  /** Targets already hit by this projectile, preventing repeated contact damage. */
  hitEnemyIds?: string[];
}

export interface WorldLootDrop {
  id: string;
  position: Vector3Like;
  item: ItemInstance;
}
