export type AugmentSlot = 'legs' | 'arms' | 'chest' | 'brain';

export interface AugmentLevelInfo {
  level: number;
  name: string;
  description: string;
  cost: number;
  statBonus: string;
}

export type WeaponCategory = 
  | 'PISTOL' 
  | 'SMG' 
  | 'SHOTGUN' 
  | 'RIFLE' 
  | 'MINIGUN' 
  | 'FLAMETHROWER' 
  | 'PLASMA' 
  | 'GAUSS' 
  | 'PERSUADER' 
  | 'BLADE' 
  | 'GRENADE' 
  | 'ORBITAL';

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  fireRate: number; // shots per sec
  range: number;
  ammo: number;
  maxAmmo: number;
  persuasionPower: number; // 0 for non-persuader
  unlocked: boolean;
  cost: number;
  color: string;
  iconName: string;
  description: string;
}

export interface AgentAugments {
  legs: number;  // 0, 1, 2, 3
  arms: number;  // 0, 1, 2, 3
  chest: number; // 0, 1, 2, 3
  brain: number; // 0, 1, 2, 3
}

export interface IPAState {
  adrenaline: number; // 0 - 100
  perception: number; // 0 - 100
  intelligence: number; // 0 - 100
}

export interface Agent {
  id: string;
  name: string;
  codeName: string;
  avatar: string;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ipa: IPAState;
  inventory: Weapon[];
  activeWeaponIndex: number;
  augments: AgentAugments;
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  selected: boolean;
  isFiring: boolean;
  direction: number; // 0-7
  vehicleId: string | null;
  status: 'ALIVE' | 'DOWN' | 'DEAD';
  kills: number;
  persuadedThralls: number;
}

export type EntityType = 'CIVILIAN' | 'POLICE' | 'GUARD' | 'ENEMY_AGENT' | 'VIP';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  direction: number;
  isPersuaded: boolean;
  persuadedByAgentId: string | null;
  weapon: Weapon | null;
  state: 'WANDER' | 'FLEE' | 'ATTACK' | 'FOLLOW' | 'PATROL';
  targetX: number | null;
  targetY: number | null;
  targetEntityId: string | null;
  speed: number;
  color: string;
}

export type VehicleType = 'SEDAN' | 'POLICE_CAR' | 'APC' | 'HOVER_CAR';

export interface Vehicle {
  id: string;
  type: VehicleType;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  direction: number; // 0-7
  passengers: string[]; // Agent IDs or Entity IDs
  driverId: string | null;
  color: string;
}

export interface Objective {
  id: string;
  text: string;
  type: 'ASSASSINATE' | 'PERSUADE' | 'DESTROY' | 'STEAL' | 'CLEAN_SWEEP';
  targetName?: string;
  completed: boolean;
  requiredCount?: number;
  currentCount?: number;
}

export interface Mission {
  id: string;
  title: string;
  territoryId: string;
  cityName: string;
  briefing: string;
  objectives: Objective[];
  rewardCredits: number;
  enemyFaction: string;
  threatLevel: 1 | 2 | 3 | 4 | 5;
  mapSize: { width: number; height: number };
  civilianCount: number;
  policeCount: number;
  enemyGuardCount: number;
  enemyAgentCount: number;
  vehicleCount: number;
  completed: boolean;
  unlocked: boolean;
}

export interface Territory {
  id: string;
  name: string;
  region: string;
  controlledBy: 'EUROCORP' | 'EXECUTIVE_ACTION' | 'CHURCH_OF_EPOCH' | 'NEUTRAL';
  taxRate: number; // 0 - 30%
  dailyIncome: number;
  rebellionRisk: number; // 0 - 100%
  missionId: string;
  coords: { x: number; y: number }; // percentage on global map
}

export interface ResearchProject {
  id: string;
  name: string;
  category: 'WEAPONS' | 'CYBERNETICS' | 'VEHICLES';
  description: string;
  cost: number;
  daysRequired: number;
  daysRemaining: number;
  active: boolean;
  completed: boolean;
  unlocksWeaponId?: string;
  unlocksAugmentSlot?: AugmentSlot;
}

export interface LaserBeam {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  life: number; // 0..1 countdown
}

export interface ParticleEffect {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: 'SPARK' | 'FLAME' | 'SMOKE' | 'PLASMA' | 'EXPLOSION' | 'PERSUADE_WAVE';
}

export type GamePhase = 
  | 'TITLE' 
  | 'GLOBAL_MAP' 
  | 'RESEARCH' 
  | 'ARMORY' 
  | 'MISSION_BRIEFING' 
  | 'TACTICAL' 
  | 'DEBRIEFING'
  | 'SETTINGS';
