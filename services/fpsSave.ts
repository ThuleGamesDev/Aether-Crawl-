import type { FloorState, ItemInstance, PlayerCharacter, WorldEnemy, WorldLootDrop } from '../types';
import type { DungeonWorldState } from '../world/DungeonWorld';
import { isWorldSolid } from '../world/CollisionWorld';
import type { PlayerCombatSaveState } from '../player/PlayerCombat';
import { getAbility } from '../combat/AbilityRegistry';

export const FPS_SAVE_KEY = 'aether_crawl_fps_r1_save_v1';
export const FPS_SAVE_VERSION = 1;

export interface FPSRunSave {
  version: 1;
  savedAt: number;
  player: PlayerCharacter;
  world: DungeonWorldState;
  enemies: WorldEnemy[];
  loot: WorldLootDrop[];
  combat?: PlayerCombatSaveState;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function saveFPSGame(save: Omit<FPSRunSave, 'version' | 'savedAt'>, storage?: KeyValueStorage): boolean {
  try {
    const target = storage ?? defaultStorage();
    if (!target) return false;
    const envelope: FPSRunSave = { ...save, version: FPS_SAVE_VERSION, savedAt: Date.now() };
    target.setItem(FPS_SAVE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function loadFPSGame(storage?: KeyValueStorage): { save: FPSRunSave | null; invalid: boolean } {
  const target = storage ?? defaultStorage();
  if (!target) return { save: null, invalid: true };
  let raw: string | null;
  try { raw = target.getItem(FPS_SAVE_KEY); }
  catch { return { save: null, invalid: true }; }
  if (!raw) return { save: null, invalid: false };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isFPSRunSave(value)) return { save: null, invalid: true };
    return { save: value, invalid: false };
  } catch {
    return { save: null, invalid: true };
  }
}

export function hasFPSGame(storage?: KeyValueStorage): boolean {
  return loadFPSGame(storage).save !== null;
}

function defaultStorage(): KeyValueStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

export function isFPSRunSave(value: unknown): value is FPSRunSave {
  if (!isRecord(value) || value.version !== FPS_SAVE_VERSION || !Number.isFinite(value.savedAt)) return false;
  if (!isPlayerCharacter(value.player) || !isDungeonWorld(value.world)) return false;
  if (!Array.isArray(value.enemies) || !value.enemies.every(isWorldEnemy)) return false;
  if (!Array.isArray(value.loot) || !value.loot.every(isWorldLoot)) return false;
  if (value.combat !== undefined && !isPlayerCombatSaveState(value.combat)) return false;
  if (!isPositionInDungeon(value.world, value.player.position) || !value.enemies.every(enemy => isPositionInDungeon(value.world, enemy.position)) || !value.loot.every(drop => isPositionInDungeon(value.world, drop.position))) return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isPlayerCharacter(value: unknown): value is PlayerCharacter {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (!['BARBARIAN', 'PALADIN', 'SORCERER', 'ROGUE', 'RANGER', 'CLERIC', 'MONK', 'NECROMANCER'].includes(value.classId)) return false;
  if (!isRecord(value.position) || !Number.isFinite(value.position.x) || !Number.isFinite(value.position.y) || !Number.isFinite(value.position.z)) return false;
  if (!isRecord(value.rotation) || !Number.isFinite(value.rotation.yaw) || !Number.isFinite(value.rotation.pitch) || Math.abs(value.rotation.pitch) > 1.4) return false;
  if (!isRecord(value.stats)) return false;
  const statValues = ['hp', 'maxHp', 'mp', 'maxMp', 'str', 'dex', 'int', 'xp', 'level', 'damageBonus', 'armor'];
  if (!statValues.every(key => Number.isFinite(value.stats[key]))) return false;
  if (value.stats.maxHp <= 0 || value.stats.hp < 0 || value.stats.hp > value.stats.maxHp || value.stats.maxMp < 0 || value.stats.mp < 0 || value.stats.mp > value.stats.maxMp || value.stats.level < 1 || !Number.isInteger(value.stats.level) || value.stats.xp < 0) return false;
  if (!Array.isArray(value.inventory) || !value.inventory.every(isItemInstance)) return false;
  if (!isRecord(value.equipment)) return false;
  const slotTypes: Record<string, string> = { weapon: 'WEAPON', armor: 'ARMOR', offhand: 'SHIELD', accessory: 'ACCESSORY' };
  if (!Object.entries(slotTypes).every(([slot, type]) => value.equipment[slot] === null || isItemInstance(value.equipment[slot]) && value.equipment[slot].type === type)) return false;
  if (!Array.isArray(value.skills) || !value.skills.every(skill => isRecord(skill) && typeof skill.abilityId === 'string' && Number.isInteger(skill.rank) && skill.rank >= 1)) return false;
  return Array.isArray(value.statusEffects) && value.statusEffects.every(status => isRecord(status) && typeof status.id === 'string' && typeof status.statusId === 'string' && Number.isFinite(status.durationSeconds) && status.durationSeconds >= 0 && Number.isFinite(status.magnitude));
}

function isDungeonWorld(value: unknown): value is DungeonWorldState {
  if (!isRecord(value) || !Number.isFinite(value.level) || !Number.isFinite(value.seed)) return false;
  if (!Number.isInteger(value.level) || value.level < 1 || !Number.isInteger(value.worldRevision) || value.worldRevision < 1) return false;
  const biomes = ['dungeon', 'moss', 'catacombs', 'obsidian', 'frost', 'gilded'];
  if (!biomes.includes(value.biome)) return false;
  if (!Array.isArray(value.map) || value.map.length < 3 || value.map.length > 64) return false;
  const width = Array.isArray(value.map[0]) ? value.map[0].length : 0;
  if (width < 3 || width > 64 || !value.map.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((tile: unknown) => typeof tile === 'number' && Number.isInteger(tile) && tile >= 0 && tile <= 5))) return false;
  if (!Array.isArray(value.decorations) || value.decorations.length !== value.map.length || !value.decorations.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((tile: unknown) => Number.isInteger(tile)))) return false;
  if (!Array.isArray(value.explored) || value.explored.length !== value.map.length || !value.explored.every((row: unknown) => Array.isArray(row) && row.length === width && row.every((cell: unknown) => typeof cell === 'boolean')) || !isRecord(value.floor)) return false;
  const floor = value.floor as FloorState;
  return floor.version === 1 && floor.level === value.level && floor.biome === value.biome && Number.isFinite(floor.seed) && Array.isArray(floor.rooms)
    && Number.isFinite(floor.keys) && Array.isArray(floor.visitedCells) && Array.isArray(floor.pendingEffects)
    && (floor.pendingEncounterId === null || typeof floor.pendingEncounterId === 'string')
    && floor.rooms.every(room => isRecord(room) && typeof room.id === 'string' && typeof room.type === 'string' && isRecord(room.anchor) && Number.isFinite(room.anchor.x) && Number.isFinite(room.anchor.y) && Array.isArray(room.cells));
}

function isWorldEnemy(value: unknown): value is WorldEnemy {
  const states = ['IDLE', 'AGGRO', 'APPROACH', 'ATTACK_WINDUP', 'ATTACK', 'RECOVER', 'HURT', 'DEAD'];
  return isRecord(value) && typeof value.id === 'string' && typeof value.definitionId === 'string' && typeof value.name === 'string' && typeof value.visualId === 'string'
    && isRecord(value.position) && Number.isFinite(value.position.x) && Number.isFinite(value.position.y) && Number.isFinite(value.position.z)
    && Number.isFinite(value.health) && Number.isFinite(value.maxHealth) && value.maxHealth > 0 && value.health >= 0 && value.health <= value.maxHealth
    && Number.isFinite(value.damage) && value.damage >= 0 && Number.isFinite(value.xpReward) && value.xpReward >= 0
    && (value.collisionRadius === undefined || Number.isFinite(value.collisionRadius) && value.collisionRadius > 0)
    && states.includes(value.state) && Number.isFinite(value.stateTimer) && value.stateTimer >= 0 && Number.isFinite(value.attackCooldown) && value.attackCooldown >= 0
    && Number.isFinite(value.attackRange) && value.attackRange > 0 && Number.isFinite(value.attackTelegraphSeconds) && value.attackTelegraphSeconds >= 0
    && typeof value.rewardGranted === 'boolean' && typeof value.isBoss === 'boolean';
}

function isWorldLoot(value: unknown): value is WorldLootDrop {
  return isRecord(value) && typeof value.id === 'string' && isRecord(value.position) && Number.isFinite(value.position.x)
    && Number.isFinite(value.position.y) && Number.isFinite(value.position.z) && isItemInstance(value.item);
}

function isItemInstance(value: unknown): value is ItemInstance {
  const rarities = ['COMMON', 'MAGIC', 'RARE', 'UNIQUE'];
  const types = ['WEAPON', 'ARMOR', 'POTION', 'SCROLL', 'SHIELD', 'ACCESSORY'];
  return isRecord(value) && typeof value.instanceId === 'string' && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.description === 'string' && types.includes(value.type) && Number.isFinite(value.value) && value.value >= 0
    && Number.isInteger(value.quantity) && value.quantity >= 1 && Number.isInteger(value.itemLevel) && value.itemLevel >= 1
    && rarities.includes(value.rarity) && Array.isArray(value.affixes)
    && value.affixes.every(affix => isRecord(affix) && typeof affix.id === 'string' && Number.isFinite(affix.value))
    && (value.uniqueEffectId === undefined || typeof value.uniqueEffectId === 'string');
}

function isPlayerCombatSaveState(value: unknown): value is PlayerCombatSaveState {
  const phases = ['WINDUP', 'ACTIVE', 'RECOVERY'];
  return isRecord(value) && isRecord(value.cooldowns)
    && Object.entries(value.cooldowns).every(([id, cooldown]) => Boolean(getAbility(id)) && Number.isFinite(cooldown) && cooldown >= 0)
    && (value.action === null || isRecord(value.action) && typeof value.action.abilityId === 'string' && Boolean(getAbility(value.action.abilityId))
      && phases.includes(value.action.phase) && Number.isFinite(value.action.remainingSeconds) && value.action.remainingSeconds >= 0
      && Number.isFinite(value.action.damageMultiplier) && value.action.damageMultiplier > 0);
}

function isPositionInDungeon(world: DungeonWorldState, position: { x: number; y: number; z: number }): boolean {
  if (position.x < 0 || position.z < 0 || position.z >= world.map.length || position.x >= (world.map[0]?.length ?? 0)) return false;
  return !isWorldSolid(world.map[Math.floor(position.z)]?.[Math.floor(position.x)]);
}
